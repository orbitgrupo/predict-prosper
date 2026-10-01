import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-lovable-aig-run-id",
  "Access-Control-Expose-Headers": "x-lovable-aig-run-id",
};

const json = (body: unknown, status: number) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: { user } } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""));
    if (!user) return json({ error: "No autenticado" }, 401);
    const { data: isAdmin } = await supabase.rpc("has_role", { _user_id: user.id, _role: "admin" });
    if (!isAdmin) return json({ error: "Solo administradores" }, 403);

    const { title, description } = await req.json();
    if (typeof description !== "string" || description.trim().length < 10 || description.length > 8000) {
      return json({ error: "La descripción debe tener entre 10 y 8000 caracteres" }, 400);
    }

    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) return json({ error: "Falta configurar la clave de IA" }, 500);

    const prompt = `Eres un analista de mercados de predicción. Analiza este mercado y responde en español, en Markdown, máximo 300 palabras, con estas secciones:
## Riesgos
## Ambigüedades
## Recomendaciones de redacción

Título: ${typeof title === "string" ? title.slice(0, 300) : "(sin título)"}
Descripción:
${description}`;

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "Lovable-API-Key": apiKey,
      "X-Lovable-AIG-SDK": "fetch",
    };
    const runId = req.headers.get("x-lovable-aig-run-id");
    if (runId) headers["X-Lovable-AIG-Run-ID"] = runId;

    const upstream = await fetch("https://ai.gateway.lovable.dev/v1/responses", {
      method: "POST",
      signal: req.signal,
      headers,
      body: JSON.stringify({
        model: "openai/gpt-6-astra",
        input: prompt,
        stream: true,
        store: false,
        reasoning: { effort: "low", summary: "auto" },
        include: ["reasoning.encrypted_content"],
      }),
    });

    const outHeaders = new Headers(corsHeaders);
    const rid = upstream.headers.get("X-Lovable-AIG-Run-ID");
    if (rid) outHeaders.set("X-Lovable-AIG-Run-ID", rid);

    if (!upstream.ok) {
      const text = await upstream.text();
      let message = "Error del servicio de IA";
      try { message = JSON.parse(text)?.error?.message ?? JSON.parse(text)?.message ?? message; } catch { /* ignore */ }
      if (upstream.status === 429) message = "Demasiadas solicitudes, inténtalo más tarde.";
      if (upstream.status === 402) message = message || "Créditos de IA insuficientes.";
      outHeaders.set("Content-Type", "application/json");
      return new Response(JSON.stringify({ error: message }), { status: upstream.status, headers: outHeaders });
    }

    outHeaders.set("Content-Type", "text/event-stream");
    return new Response(upstream.body, { status: 200, headers: outHeaders });
  } catch (e) {
    if (req.signal.aborted) return new Response(null, { status: 499, headers: corsHeaders });
    return json({ error: e instanceof Error ? e.message : "Error desconocido" }, 500);
  }
});
