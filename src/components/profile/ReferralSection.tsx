import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Copy, Users, Gift, Loader2, Check, Link, MessageCircle, Send, MousePointerClick } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';

interface ReferralSectionProps {
  userId: string;
  referralCode: string;
  referralClicks?: number;
}

export function ReferralSection({ userId, referralCode, referralClicks = 0 }: ReferralSectionProps) {
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
            <span className="flex items-center gap-1">
              <MousePointerClick className="h-3.5 w-3.5" />
              Clics en tu enlace: <strong className="text-foreground">{referralClicks}</strong>
            </span>
          </div>

          <div className="flex gap-2">
            <Input value={referralLink} readOnly className="text-xs" />
            <Button variant="outline" size="sm" onClick={handleCopyLink} className="shrink-0 gap-1">
              <Link className="h-3 w-3" />
              Copiar enlace
            </Button>
          </div>

          <div className="flex gap-2 flex-wrap">
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 text-[#25D366] border-[#25D366]/30 hover:bg-[#25D366]/10"
              onClick={() => window.open(`https://wa.me/?text=${encodeURIComponent(`¡Únete y recibe $${settings?.referral_bonus_referred ?? 0} en créditos gratis! ${referralLink}`)}`, '_blank')}
            >
              <MessageCircle className="h-4 w-4" />
              WhatsApp
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 text-[#1DA1F2] border-[#1DA1F2]/30 hover:bg-[#1DA1F2]/10"
              onClick={() => window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(`¡Únete y recibe $${settings?.referral_bonus_referred ?? 0} en créditos gratis!`)}&url=${encodeURIComponent(referralLink)}`, '_blank')}
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
              Twitter
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 text-[#0088cc] border-[#0088cc]/30 hover:bg-[#0088cc]/10"
              onClick={() => window.open(`https://t.me/share/url?url=${encodeURIComponent(referralLink)}&text=${encodeURIComponent(`¡Únete y recibe $${settings?.referral_bonus_referred ?? 0} en créditos gratis!`)}`, '_blank')}
            >
              <Send className="h-4 w-4" />
              Telegram
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
