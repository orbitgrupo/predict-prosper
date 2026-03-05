import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Gift, Users } from 'lucide-react';

export function PromotionSettings() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  // Welcome bonus
  const [welcomeEnabled, setWelcomeEnabled] = useState(true);
  const [welcomeAmount, setWelcomeAmount] = useState(100);
  
  // Referral
  const [referralEnabled, setReferralEnabled] = useState(true);
  const [referralBonusReferrer, setReferralBonusReferrer] = useState(50);
  const [referralBonusReferred, setReferralBonusReferred] = useState(25);

  useEffect(() => {
    async function fetch() {
      const { data } = await supabase
        .from('app_settings')
        .select('*')
        .eq('id', 'default')
        .single();
      if (data) {
        setWelcomeEnabled(data.welcome_bonus_enabled);
        setWelcomeAmount(data.welcome_bonus_amount);
        setReferralEnabled((data as any).referral_enabled ?? true);
        setReferralBonusReferrer((data as any).referral_bonus_referrer ?? 50);
        setReferralBonusReferred((data as any).referral_bonus_referred ?? 25);
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
          welcome_bonus_enabled: welcomeEnabled,
          welcome_bonus_amount: welcomeAmount,
          referral_enabled: referralEnabled,
          referral_bonus_referrer: referralBonusReferrer,
          referral_bonus_referred: referralBonusReferred,
          updated_at: new Date().toISOString(),
        } as any)
        .eq('id', 'default');
      if (error) throw error;
      toast({ title: 'Guardado', description: 'Configuración de promociones actualizada.' });
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
    <div className="space-y-6">
      {/* Welcome Bonus */}
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
            <Switch id="promo-toggle" checked={welcomeEnabled} onCheckedChange={setWelcomeEnabled} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="bonus-amount">Monto del bono (créditos)</Label>
            <Input
              id="bonus-amount"
              type="number"
              min={1}
              value={welcomeAmount}
              onChange={(e) => setWelcomeAmount(Number(e.target.value))}
              disabled={!welcomeEnabled}
            />
          </div>
        </CardContent>
      </Card>

      {/* Referral Bonus */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Sistema de referidos
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="referral-toggle" className="text-base font-medium">Referidos activos</Label>
              <p className="text-sm text-muted-foreground">
                Los usuarios pueden invitar a otros y ambos recibirán créditos.
              </p>
            </div>
            <Switch id="referral-toggle" checked={referralEnabled} onCheckedChange={setReferralEnabled} />
          </div>

          <Separator />

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="referrer-bonus">Bono para quien refiere (créditos)</Label>
              <Input
                id="referrer-bonus"
                type="number"
                min={0}
                value={referralBonusReferrer}
                onChange={(e) => setReferralBonusReferrer(Number(e.target.value))}
                disabled={!referralEnabled}
              />
              <p className="text-xs text-muted-foreground">Créditos que recibe el usuario que comparte su código.</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="referred-bonus">Bono para el referido (créditos)</Label>
              <Input
                id="referred-bonus"
                type="number"
                min={0}
                value={referralBonusReferred}
                onChange={(e) => setReferralBonusReferred(Number(e.target.value))}
                disabled={!referralEnabled}
              />
              <p className="text-xs text-muted-foreground">Créditos que recibe el nuevo usuario invitado.</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Button onClick={handleSave} disabled={saving} className="w-full" size="lg">
        {saving ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Guardando...
          </>
        ) : (
          'Guardar configuración de promociones'
        )}
      </Button>
    </div>
  );
}
