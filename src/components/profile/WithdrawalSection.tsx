import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Banknote,
  Loader2,
  AlertCircle,
  Clock,
  CheckCircle,
  XCircle,
  ShieldAlert,
} from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface WithdrawalSectionProps {
  userId: string;
}

export function WithdrawalSection({ userId }: WithdrawalSectionProps) {
  const { toast } = useToast();
  const { profile, refreshProfile } = useAuth();
  const queryClient = useQueryClient();

  const [method, setMethod] = useState<string>('');
  const [amount, setAmount] = useState('');
  const [bankName, setBankName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [accountHolder, setAccountHolder] = useState('');
  const [paypalEmail, setPaypalEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const { data: withdrawals, isLoading } = useQuery({
    queryKey: ['my_withdrawals', userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('withdrawal_requests' as any)
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []) as any[];
    },
  });

  const isVerified =
    (profile as any)?.document_status === 'approved' &&
    (profile as any)?.is_age_verified === true;

  const hasPending = withdrawals?.some((w: any) => w.status === 'pending');

  const handleSubmit = async () => {
    const numAmount = Number(amount);
    if (!method || !numAmount) return;

    setSubmitting(true);
    try {
      const { data, error } = await supabase.rpc('request_withdrawal', {
        p_user_id: userId,
        p_amount: numAmount,
        p_method: method,
        p_bank_name: method === 'bank_transfer' ? bankName : null,
        p_account_number: method === 'bank_transfer' ? accountNumber : null,
        p_account_holder: method === 'bank_transfer' ? accountHolder : null,
        p_paypal_email: method === 'paypal' ? paypalEmail : null,
      } as any);

      if (error) throw error;
      const result = data as any;
      if (!result.success) throw new Error(result.error);

      toast({
        title: '¡Solicitud enviada!',
        description: 'Tu solicitud de retiro ha sido enviada al administrador para revisión.',
      });

      // Reset form
      setAmount('');
      setMethod('');
      setBankName('');
      setAccountNumber('');
      setAccountHolder('');
      setPaypalEmail('');

      queryClient.invalidateQueries({ queryKey: ['my_withdrawals'] });
      refreshProfile();
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  const getStatusBadge = (w: any) => {
    if (w.status === 'approved' && w.paid_at) {
      return (
        <Badge className="gap-1 bg-emerald-600">
          <Banknote className="h-3 w-3" /> Transferido
        </Badge>
      );
    }
    switch (w.status) {
      case 'pending':
        return (
          <Badge variant="secondary" className="gap-1">
            <Clock className="h-3 w-3" /> Pendiente
          </Badge>
        );
      case 'approved':
        return (
          <Badge className="gap-1 bg-green-600">
            <CheckCircle className="h-3 w-3" /> Aprobado
          </Badge>
        );
      case 'rejected':
        return (
          <Badge variant="destructive" className="gap-1">
            <XCircle className="h-3 w-3" /> Rechazado
          </Badge>
        );
      default:
        return <Badge>{w.status}</Badge>;
    }
  };

  return (
    <div className="space-y-4">
      {/* Verification warning */}
      {!isVerified && (
        <Card className="border-warning/50 bg-warning/5">
          <CardContent className="flex items-start gap-3 pt-6">
            <ShieldAlert className="h-5 w-5 text-warning shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-sm">Verificación requerida</p>
              <p className="text-xs text-muted-foreground mt-1">
                Para solicitar un retiro debes tener tu identidad verificada y aprobada por un
                administrador, y confirmar que eres mayor de 18 años. Ve a la sección de documentos
                en tu perfil.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Withdrawal form */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Banknote className="h-5 w-5" />
            Solicitar retiro
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg border bg-muted/30 p-3">
            <p className="text-sm text-muted-foreground">
              Saldo disponible:{' '}
              <strong className="text-foreground text-lg">${profile?.balance?.toLocaleString('es-ES') ?? 0}</strong>
            </p>
            <p className="text-xs text-muted-foreground mt-1">Monto mínimo de retiro: $50</p>
          </div>

          <div className="space-y-2">
            <Label>Método de retiro</Label>
            <Select value={method} onValueChange={setMethod} disabled={!isVerified || hasPending}>
              <SelectTrigger>
                <SelectValue placeholder="Seleccionar método" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="bank_transfer">Transferencia bancaria</SelectItem>
                <SelectItem value="paypal">PayPal</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Monto a retirar</Label>
            <Input
              type="number"
              min={50}
              max={profile?.balance ?? 0}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="50"
              disabled={!isVerified || hasPending}
            />
          </div>

          {method === 'bank_transfer' && (
            <div className="space-y-3 rounded-lg border p-3">
              <div className="space-y-2">
                <Label>Nombre del banco</Label>
                <Input
                  value={bankName}
                  onChange={(e) => setBankName(e.target.value)}
                  placeholder="Banco Nacional"
                />
              </div>
              <div className="space-y-2">
                <Label>Número de cuenta / CLABE</Label>
                <Input
                  value={accountNumber}
                  onChange={(e) => setAccountNumber(e.target.value)}
                  placeholder="0123456789"
                  className="font-mono"
                />
              </div>
              <div className="space-y-2">
                <Label>Titular de la cuenta</Label>
                <Input
                  value={accountHolder}
                  onChange={(e) => setAccountHolder(e.target.value)}
                  placeholder="Nombre completo"
                />
              </div>
            </div>
          )}

          {method === 'paypal' && (
            <div className="space-y-2 rounded-lg border p-3">
              <Label>Correo de PayPal</Label>
              <Input
                type="email"
                value={paypalEmail}
                onChange={(e) => setPaypalEmail(e.target.value)}
                placeholder="tu@email.com"
              />
            </div>
          )}

          {hasPending && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <AlertCircle className="h-4 w-4" />
              Ya tienes una solicitud pendiente. Espera a que sea procesada.
            </div>
          )}

          <Button
            onClick={handleSubmit}
            disabled={
              submitting ||
              !isVerified ||
              !method ||
              !amount ||
              Number(amount) < 50 ||
              hasPending
            }
            className="w-full"
          >
            {submitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Enviando solicitud...
              </>
            ) : (
              'Solicitar retiro'
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Withdrawal history */}
      {isLoading ? (
        <div className="flex justify-center py-4">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : withdrawals && withdrawals.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Historial de retiros</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {withdrawals.map((w: any) => (
                <div
                  key={w.id}
                  className="flex items-center justify-between rounded-lg border p-3"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-medium">${Number(w.amount).toLocaleString('es-ES')}</p>
                      {getStatusBadge(w.status)}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {w.method === 'bank_transfer' ? 'Transferencia bancaria' : 'PayPal'} •{' '}
                      {format(new Date(w.created_at), "d 'de' MMMM, yyyy", { locale: es })}
                    </p>
                    {w.admin_notes && w.status === 'rejected' && (
                      <p className="text-xs text-destructive mt-1">Motivo: {w.admin_notes}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
