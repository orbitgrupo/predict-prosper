import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Trophy } from 'lucide-react';
import { LIDOM_TEAMS, LidomTeam } from '@/data/lidomTeams';
import { cn } from '@/lib/utils';

function TeamGrid({
  label,
  selected,
  onSelect,
  disabledId,
}: {
  label: string;
  selected: LidomTeam | null;
  onSelect: (t: LidomTeam) => void;
  disabledId?: string | null;
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div className="grid grid-cols-3 gap-2">
        {LIDOM_TEAMS.map((team) => {
          const isSelected = selected?.id === team.id;
          const isDisabled = disabledId === team.id;
          return (
            <button
              key={team.id}
              type="button"
              disabled={isDisabled}
              onClick={() => onSelect(team)}
              className={cn(
                'flex flex-col items-center gap-1 rounded-lg border p-2 transition-all',
                isSelected
                  ? 'border-primary ring-2 ring-primary/40 bg-primary/5'
                  : 'border-border hover:border-primary/50 hover:bg-muted/50',
                isDisabled && 'opacity-30 cursor-not-allowed'
              )}
            >
              <img
                src={team.logo}
                alt={team.name}
                className="h-12 w-12 rounded-full bg-white object-contain p-0.5 shadow-sm"
              />
              <span className="text-[11px] font-medium leading-tight text-center">{team.shortName}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function LidomQuickCreate({ onCreated }: { onCreated?: () => void }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [home, setHome] = useState<LidomTeam | null>(null);
  const [away, setAway] = useState<LidomTeam | null>(null);
  const [gameTime, setGameTime] = useState('');
  const [creating, setCreating] = useState(false);

  const handleCreate = async () => {
    if (!home || !away) {
      toast({ title: 'Error', description: 'Selecciona los dos equipos.', variant: 'destructive' });
      return;
    }
    if (home.id === away.id) {
      toast({ title: 'Error', description: 'Los equipos deben ser diferentes.', variant: 'destructive' });
      return;
    }
    if (!gameTime) {
      toast({ title: 'Error', description: 'Indica la fecha y hora del partido.', variant: 'destructive' });
      return;
    }
    setCreating(true);
    try {
      const gameDate = new Date(gameTime);
      const dateStr = gameDate.toLocaleDateString('es-DO', {
        weekday: 'long', day: 'numeric', month: 'long',
      });
      const timeStr = gameDate.toLocaleTimeString('es-DO', { hour: 'numeric', minute: '2-digit' });
      const { data: marketData, error: marketError } = await supabase
        .from('markets')
        .insert({
          title: `¿Quién gana? ${home.name} vs ${away.name}`,
          description: `Partido de la Liga Dominicana de Béisbol (LIDOM). ${home.name} (local) vs ${away.name} (visitante). Juego del ${dateStr} a las ${timeStr}.`,
          category: 'Deportes',
          closes_at: gameDate.toISOString(),
          created_by: user?.id,
          image_url: home.logo,
          allow_cashout: true,
          favorite_probability: 50,
        } as any)
        .select()
        .single();
      if (marketError) throw marketError;
      const { error: optionsError } = await supabase.from('market_options').insert([
        { market_id: marketData.id, option_name: home.name },
        { market_id: marketData.id, option_name: away.name },
      ]);
      if (optionsError) throw optionsError;
      toast({ title: 'Predicción creada', description: `${home.shortName} vs ${away.shortName} ya está en Deportes.` });
      setHome(null);
      setAway(null);
      setGameTime('');
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
          <Trophy className="h-5 w-5 text-primary" />
          Partido LIDOM
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <TeamGrid label="Equipo local" selected={home} onSelect={setHome} disabledId={away?.id} />
        <div className="flex items-center gap-3">
          <div className="h-px flex-1 bg-border" />
          <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">vs</span>
          <div className="h-px flex-1 bg-border" />
        </div>
        <TeamGrid label="Equipo visitante" selected={away} onSelect={setAway} disabledId={home?.id} />
        <div className="space-y-2">
          <Label htmlFor="lidom-gametime">Fecha y hora del partido *</Label>
          <Input
            id="lidom-gametime"
            type="datetime-local"
            value={gameTime}
            onChange={(e) => setGameTime(e.target.value)}
          />
        </div>
        <Button className="w-full" onClick={handleCreate} disabled={creating}>
          {creating ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Creando...
            </>
          ) : (
            'Crear predicción'
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
