import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Gift } from 'lucide-react';

export function PromotionSettings() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [enabled, setEnabled] = useState(true);
  const [amount, setAmount] = useState(100);

  useEffect(() => {
    async function fetch() {
      const { data } = await supabase
        .from('app_settings')
        .select('*')
        .eq('id', 'default')
        .single();
      if (data) {
        setEnabled(data.welcome_bonus_enabled);
        setAmount(data.welcome_bonus_amount);
      }
      setLoading(false);
    }
    fetch();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from('app_settings')
        .update({
          welcome_bonus_enabled: enabled,
          welcome_bonus_amount: amount,
          updated_at: new Date().toISOString(),
        })
        .eq('id', 'default');
      if (error) throw error;
      toast({ title: 'Guardado', description: 'Configuración de promoción actualizada.' });
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Gift className="h-5 w-5" />
          Promoción de bienvenida
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <Label htmlFor="promo-toggle" className="text-base font-medium">Promoción activa</Label>
            <p className="text-sm text-muted-foreground">
              Los nuevos usuarios recibirán créditos gratis al registrarse.
            </p>
          </div>
          <Switch
            id="promo-toggle"
            checked={enabled}
            onCheckedChange={setEnabled}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="bonus-amount">Monto del bono (créditos)</Label>
          <Input
            id="bonus-amount"
            type="number"
            min={1}
            value={amount}
            onChange={(e) => setAmount(Number(e.target.value))}
            disabled={!enabled}
          />
        </div>

        <Button onClick={handleSave} disabled={saving} className="w-full">
          {saving ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Guardando...
            </>
          ) : (
            'Guardar configuración'
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
