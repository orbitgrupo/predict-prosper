import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Dices } from 'lucide-react';

// Santo Domingo siempre es UTC-4 (sin horario de verano).
const SD_OFFSET_MS = 4 * 60 * 60 * 1000;
// Días sin sorteo (mes, día): 24 y 25 de diciembre, 31 de diciembre, 1 de enero, 21 de enero.
const NO_DRAW: Array<[number, number]> = [[12, 24], [12, 25], [12, 31], [1, 1], [1, 21]];
const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

function sdNow(): Date {
  // Fecha/hora actual en Santo Domingo, con los campos UTC del Date.
  return new Date(Date.now() - SD_OFFSET_MS);
}

function fechaLarga(d: Date): string {
  return `${DIAS[d.getUTCDay()]}, ${d.getUTCDate()} de ${MESES[d.getUTCMonth()]} de ${d.getUTCFullYear()}`;
}

function nextDraw(): { drawDate: Date; closesAtISO: string; drawTime: string; closeTime: string } {
  const now = sdNow();
  let y = now.getUTCFullYear();
  let m = now.getUTCMonth();
  let d = now.getUTCDate();
  for (;;) {
    const isNoDraw = NO_DRAW.some(([mm, dd]) => mm === m + 1 && dd === d);
    if (isNoDraw) {
      const next = new Date(Date.UTC(y, m, d + 1));
      y = next.getUTCFullYear(); m = next.getUTCMonth(); d = next.getUTCDate();
      continue;
    }
    const weekday = new Date(Date.UTC(y, m, d)).getUTCDay();
    const isSunday = weekday === 0;
    const closes = new Date(Date.UTC(y, m, d, isSunday ? 17 : 20, 49));
    if (y === now.getUTCFullYear() && m === now.getUTCMonth() && d === now.getUTCDate() && now.getTime() >= closes.getTime()) {
      const next = new Date(Date.UTC(y, m, d + 1));
      y = next.getUTCFullYear(); m = next.getUTCMonth(); d = next.getUTCDate();
      continue;
    }
    const drawDate = new Date(Date.UTC(y, m, d));
    // closes_at en UTC real: la hora de cierre de SD + 4h.
    const closesAtISO = new Date(closes.getTime() + SD_OFFSET_MS).toISOString();
    return {
      drawDate,
      closesAtISO,
      drawTime: isSunday ? '6:00 PM' : '9:00 PM',
      closeTime: isSunday ? '5:49 PM' : '8:49 PM',
    };
  }
}

export function LotteryQuickCreate({ onCreated }: { onCreated?: () => void }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [creating, setCreating] = useState(false);
  const [rollover, setRollover] = useState<number | null>(null);
  const [existing, setExisting] = useState(false);
  const [checking, setChecking] = useState(true);

  const draw = nextDraw();
  const title = `Lotería Nacional — ${fechaLarga(draw.drawDate)}`;

  useEffect(() => {
    const load = async () => {
      setChecking(true);
      try {
        const { data: settings } = await supabase
          .from('app_settings')
          .select('lottery_rollover')
          .eq('id', 'default')
          .maybeSingle();
        setRollover(Number((settings as any)?.lottery_rollover ?? 0));
        // ¿Ya existe un mercado activo de Lotería para este sorteo?
        const dayStart = new Date(draw.drawDate.getTime() + SD_OFFSET_MS).toISOString();
        const dayEnd = new Date(draw.drawDate.getTime() + SD_OFFSET_MS + 24 * 60 * 60 * 1000).toISOString();
        const { data: markets } = await supabase
          .from('markets')
          .select('id')
          .eq('category', 'Lotería')
          .eq('status', 'active')
          .gte('closes_at', dayStart)
          .lt('closes_at', dayEnd);
        setExisting((markets?.length ?? 0) > 0);
      } catch {
        setRollover(0);
        setExisting(false);
      } finally {
        setChecking(false);
      }
    };
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCreate = async () => {
    setCreating(true);
    try {
      const description = [
        'Sorteo nocturno de la Quiniela Nacional (Lotería Nacional Dominicana).',
        '',
        'Apuesta al número del 00 al 99 que crees que saldrá como primer premio. Los que acierten se reparten el pozo en proporción a lo jugado. Si nadie acierta, el pozo se acumula para el próximo sorteo.',
        '',
        `Sorteo: ${fechaLarga(draw.drawDate)} a las ${draw.drawTime}.`,
      ].join('\n');
      const { data: marketData, error: marketError } = await supabase
        .from('markets')
        .insert({
          title,
          description,
          category: 'Lotería',
          closes_at: draw.closesAtISO,
          created_by: user?.id,
          allow_cashout: true,
          favorite_probability: 1,
        } as any)
        .select()
        .single();
      if (marketError) throw marketError;
      const options = Array.from({ length: 100 }, (_, n) => ({
        market_id: marketData.id,
        option_name: String(n).padStart(2, '0'),
      }));
      const { error: optionsError } = await supabase.from('market_options').insert(options);
      if (optionsError) throw optionsError;
      toast({ title: 'Lotería creada', description: `${title} ya está activa con los números del 00 al 99.` });
      setExisting(true);
      queryClient.invalidateQueries({ queryKey: ['markets'] });
      onCreated?.();
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } finally {
      setCreating(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Dices className="h-5 w-5 text-primary" />
          Lotería diaria
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-1 text-sm">
          <p><span className="text-muted-foreground">Próximo sorteo: </span><span className="font-medium">{fechaLarga(draw.drawDate)} · {draw.drawTime}</span></p>
          <p><span className="text-muted-foreground">Cierre de apuestas: </span><span className="font-medium">{draw.closeTime}</span></p>
          <p><span className="text-muted-foreground">Pozo acumulado: </span><span className="font-medium">${(rollover ?? 0).toLocaleString('es-ES', { minimumFractionDigits: 2 })}</span></p>
          <p className="text-xs text-muted-foreground pt-1">
            Crea el mercado con los números del 00 al 99. El ganador es el primer premio de la Quiniela Nacional Noche. Si nadie acierta, el pozo se acumula para el próximo sorteo.
          </p>
        </div>
        {checking ? (
          <Button className="w-full" disabled>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Verificando...
          </Button>
        ) : existing ? (
          <p className="rounded-lg bg-success/10 border border-success/20 px-3 py-2 text-sm text-success">
            Ya existe un mercado de Lotería para este sorteo.
          </p>
        ) : (
          <Button className="w-full" onClick={handleCreate} disabled={creating}>
            {creating ? (
              <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Creando...</>
            ) : (
              'Crear mercado de Lotería'
            )}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
