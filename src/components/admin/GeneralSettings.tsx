import { useEffect, useState } from 'react';
import { Coins, Globe2, Loader2, Save, Smartphone } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';

export function GeneralSettings() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [usBettingEnabled, setUsBettingEnabled] = useState(false);
  const [economyMode, setEconomyMode] = useState<'points' | 'real_money'>('points');
  const [phoneRequired, setPhoneRequired] = useState(false);

  useEffect(() => {
    async function loadSettings() {
      const { data, error } = await supabase
        .from('app_settings')
        .select('*')
        .eq('id', 'default')
        .single();

      if (error) {
        toast({ title: 'Error', description: error.message, variant: 'destructive' });
      } else {
        setUsBettingEnabled((data as any).us_betting_enabled ?? false);
        setEconomyMode((data as any).economy_mode === 'real_money' ? 'real_money' : 'points');
        setPhoneRequired((data as any).phone_required_on_signup ?? false);
      }
      setLoading(false);
    }

    loadSettings();
  }, [toast]);

  const handleSave = async () => {
    setSaving(true);
    const { error } = await supabase
      .from('app_settings')
      .update({
        us_betting_enabled: usBettingEnabled,
        economy_mode: economyMode,
        phone_required_on_signup: phoneRequired,
        updated_at: new Date().toISOString(),
      } as any)
      .eq('id', 'default');

    setSaving(false);
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
      return;
    }

    queryClient.invalidateQueries({ queryKey: ['economy-settings'] });
    toast({ title: 'Configuración guardada', description: 'La configuración general fue actualizada.' });
  };

  if (loading) {
    return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Coins className="h-5 w-5" />
            Economía de la plataforma
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="flex items-center justify-between gap-6">
            <div>
              <Label htmlFor="real-money-mode" className="text-base font-medium">Modo dinero real</Label>
              <p className="mt-1 text-sm text-muted-foreground">
                Desactivado: puntos internos no canjeables. Activado: importes monetarios y retiros.
              </p>
            </div>
            <Switch
              id="real-money-mode"
              checked={economyMode === 'real_money'}
              onCheckedChange={(checked) => setEconomyMode(checked ? 'real_money' : 'points')}
            />
          </div>
          <Alert variant={economyMode === 'real_money' ? 'destructive' : 'default'}>
            <AlertDescription>
              {economyMode === 'real_money'
                ? 'Activar dinero real habilita retiros. Hazlo únicamente cuando estén listas las licencias, verificación de identidad, pagos y controles regulatorios.'
                : 'Modo recomendado para pruebas: los puntos no representan dinero, no se compran y no se pueden retirar ni canjear.'}
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Smartphone className="h-5 w-5" />
            Registro de cuentas
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between gap-6">
            <div>
              <Label htmlFor="phone-required" className="text-base font-medium">Teléfono obligatorio</Label>
              <p className="mt-1 text-sm text-muted-foreground">
                Exige un número en formato internacional al crear cuentas nuevas.
              </p>
            </div>
            <Switch id="phone-required" checked={phoneRequired} onCheckedChange={setPhoneRequired} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Globe2 className="h-5 w-5" />
            Restricciones geográficas
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="flex items-center justify-between gap-6">
            <div>
              <Label htmlFor="us-betting" className="text-base font-medium">Permitir apuestas desde Estados Unidos</Label>
              <p className="mt-1 text-sm text-muted-foreground">
                Cuando está desactivado, los visitantes detectados en Estados Unidos no pueden confirmar apuestas.
              </p>
            </div>
            <Switch id="us-betting" checked={usBettingEnabled} onCheckedChange={setUsBettingEnabled} />
          </div>

          <Alert variant="destructive" className="bg-destructive/5">
            <AlertDescription>
              Este control solo cambia el bloqueo técnico. Activarlo no confirma que la operación sea legal; valida licencias, jurisdicción y requisitos regulatorios antes de habilitar apuestas con dinero real.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Configuraciones futuras</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Los próximos controles generales de la plataforma se administrarán desde esta sección.
          </p>
        </CardContent>
      </Card>

      <Button className="w-full" size="lg" onClick={handleSave} disabled={saving}>
        {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
        Guardar configuración
      </Button>
    </div>
  );
}
