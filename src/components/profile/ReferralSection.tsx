import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Copy, Users, Gift, Loader2, Check, Link, MessageCircle, Send } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';

interface ReferralSectionProps {
  userId: string;
  referralCode: string;
}

export function ReferralSection({ userId, referralCode }: ReferralSectionProps) {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);
  const [inputCode, setInputCode] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const { data: settings } = useQuery({
    queryKey: ['app_settings_referral'],
    queryFn: async () => {
      const { data } = await supabase.from('app_settings').select('*').eq('id', 'default').single();
      return data as any;
    },
  });

  const { data: referrals, refetch: refetchReferrals } = useQuery({
    queryKey: ['my_referrals', userId],
    queryFn: async () => {
      const { data } = await supabase
        .from('referrals' as any)
        .select('*, referred:referred_id(username, email)')
        .eq('referrer_id', userId)
        .order('created_at', { ascending: false });
      return (data || []) as any[];
    },
  });

  const { data: wasReferred } = useQuery({
    queryKey: ['was_referred', userId],
    queryFn: async () => {
      const { data } = await supabase
        .from('referrals' as any)
        .select('id')
        .eq('referred_id', userId)
        .maybeSingle();
      return !!data;
    },
  });

  const referralLink = `${window.location.origin}/auth?ref=${referralCode}`;

  const handleCopy = () => {
    navigator.clipboard.writeText(referralCode);
    setCopied(true);
    toast({ title: 'Copiado', description: 'Código de referido copiado al portapapeles.' });
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(referralLink);
    toast({ title: 'Enlace copiado', description: 'Enlace de referido copiado al portapapeles.' });
  };

  const handleSubmitCode = async () => {
    if (!inputCode.trim()) return;
    setSubmitting(true);
    try {
      const { data, error } = await supabase.rpc('process_referral', {
        p_user_id: userId,
        p_referral_code: inputCode.trim(),
      } as any);
      if (error) throw error;
      const result = data as any;
      if (!result.success) throw new Error(result.error);
      toast({ title: '¡Referido aplicado!', description: 'Has recibido tu bono de referido.' });
      setInputCode('');
      refetchReferrals();
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  const referralEnabled = settings?.referral_enabled ?? false;

  if (!referralEnabled) return null;

  return (
    <div className="space-y-4">
      {/* My referral code */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Users className="h-5 w-5" />
            Mi código de referido
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Comparte tu código y ambos recibirán créditos cuando se registren.
          </p>
          <div className="flex gap-2">
            <Input value={referralCode} readOnly className="font-mono text-lg font-bold tracking-wider" />
            <Button variant="outline" size="icon" onClick={handleCopy}>
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            </Button>
          </div>
          <div className="flex gap-4 text-sm text-muted-foreground">
            <span>Tú recibes: <strong className="text-foreground">${settings?.referral_bonus_referrer ?? 0}</strong></span>
            <span>Tu amigo recibe: <strong className="text-foreground">${settings?.referral_bonus_referred ?? 0}</strong></span>
          </div>

          <div className="flex gap-2">
            <Input value={referralLink} readOnly className="text-xs" />
            <Button variant="outline" size="sm" onClick={handleCopyLink} className="shrink-0 gap-1">
              <Link className="h-3 w-3" />
              Copiar enlace
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Enter referral code */}
      {!wasReferred && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Gift className="h-5 w-5" />
              ¿Tienes un código de referido?
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex gap-2">
              <Input
                value={inputCode}
                onChange={(e) => setInputCode(e.target.value.toUpperCase())}
                placeholder="Ingresa el código"
                className="font-mono"
                disabled={submitting}
              />
              <Button onClick={handleSubmitCode} disabled={submitting || !inputCode.trim()}>
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Aplicar'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Referral history */}
      {referrals && referrals.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Mis referidos ({referrals.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {referrals.map((ref: any) => (
                <div key={ref.id} className="flex items-center justify-between rounded-lg border p-3">
                  <div>
                    <p className="font-medium text-sm">{ref.referred?.username || ref.referred?.email || 'Usuario'}</p>
                    <p className="text-xs text-muted-foreground">
                      Bono: +${ref.referrer_bonus}
                    </p>
                  </div>
                  <Badge variant="secondary">Completado</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
