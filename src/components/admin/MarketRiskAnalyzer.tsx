import { useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, Sparkles, Square } from 'lucide-react';

export function MarketRiskAnalyzer() {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [output, setOutput] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const run = async () => {
    setOutput('');
    setError('');
    setLoading(true);
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/market-risk-analysis`,
        {
          method: 'POST',
          signal: controller.signal,
          headers: {
            'Content-Type': 'application/json',
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            Authorization: `Bearer ${session?.access_token ?? ''}`,
          },
          body: JSON.stringify({ title, description }),
        }
      );
      if (!res.ok || !res.body) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `Error ${res.status}`);
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let got = false;
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';
        for (const line of lines) {
          if (!line.startsWith('data:')) continue;
          const payload = line.slice(5).trim();
          if (!payload || payload === '[DONE]') continue;
          try {
            const evt = JSON.parse(payload);
            if (evt.type === 'response.output_text.delta' && evt.delta) {
              got = true;
              setOutput((o) => o + evt.delta);
            } else if (evt.type === 'response.failed' || evt.type === 'error') {
              throw new Error(evt.response?.error?.message || evt.message || 'La IA no pudo completar el análisis');
            }
          } catch (e) {
            if (e instanceof SyntaxError) continue;
            throw e;
          }
        }
      }
      if (!got) setError('La IA no devolvió contenido.');
    } catch (e: any) {
      if (e?.name !== 'AbortError') setError(e?.message || 'Error');
    } finally {
      setLoading(false);
      abortRef.current = null;
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" /> Análisis de riesgos con IA
        </CardTitle>
        <CardDescription>
          Pega la descripción de un mercado y obtén un resumen de riesgos y posibles ambigüedades.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <Input placeholder="Título (opcional)" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={300} />
        <Textarea
          placeholder="Descripción del mercado y criterios de resolución..."
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={6}
          maxLength={8000}
        />
        <div className="flex gap-2">
          <Button onClick={run} disabled={loading || description.trim().length < 10}>
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
            Analizar
          </Button>
          {loading && (
            <Button variant="outline" onClick={() => abortRef.current?.abort()}>
              <Square className="mr-2 h-4 w-4" /> Detener
            </Button>
          )}
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        {output && (
          <div className="whitespace-pre-wrap rounded-md border bg-muted/40 p-4 text-sm">{output}</div>
        )}
      </CardContent>
    </Card>
  );
}
