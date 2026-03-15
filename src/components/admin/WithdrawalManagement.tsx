import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { useAuditLog } from '@/hooks/useAuditLog';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Loader2,
  CheckCircle,
  XCircle,
  Clock,
  Banknote,
  CreditCard,
} from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

export function WithdrawalManagement() {
  const { toast } = useToast();
  const { logAction } = useAuditLog();
  const queryClient = useQueryClient();
  const [processing, setProcessing] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<any>(null);
  const [action, setAction] = useState<'approve' | 'reject' | null>(null);
  const [adminNotes, setAdminNotes] = useState('');

  const { data: requests, isLoading } = useQuery({
    queryKey: ['admin_withdrawals'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('withdrawal_requests' as any)
        .select('*, profiles!withdrawal_requests_user_id_fkey(username, email, document_status, is_age_verified)')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []) as any[];
    },
  });

  const handleProcess = async () => {
    if (!selectedRequest || !action) return;
    setProcessing(true);
    try {
      const { data, error } = await supabase.rpc('process_withdrawal', {
        p_withdrawal_id: selectedRequest.id,
        p_action: action,
        p_admin_notes: adminNotes || null,
      } as any);
      if (error) throw error;
      const result = data as any;
      if (!result.success) throw new Error(result.error);

      toast({
        title: action === 'approve' ? 'Retiro aprobado' : 'Retiro rechazado',
        description:
          action === 'approve'
            ? 'El retiro ha sido aprobado exitosamente.'
            : 'El retiro ha sido rechazado y los fondos devueltos al usuario.',
      });

      setSelectedRequest(null);
      setAction(null);
      setAdminNotes('');
      queryClient.invalidateQueries({ queryKey: ['admin_withdrawals'] });
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    } finally {
      setProcessing(false);
    }
  };

  const pendingRequests = requests?.filter((r: any) => r.status === 'pending') || [];
  const processedRequests = requests?.filter((r: any) => r.status !== 'pending') || [];

  const getStatusBadge = (status: string) => {
    switch (status) {
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
        return <Badge>{status}</Badge>;
    }
  };

  const renderRequestCard = (req: any, showActions: boolean) => (
    <Card key={req.id}>
      <CardContent className="py-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="font-bold text-lg">${Number(req.amount).toLocaleString('es-ES')}</p>
              {getStatusBadge(req.status)}
              <Badge variant="outline" className="gap-1">
                {req.method === 'bank_transfer' ? (
                  <>
                    <Banknote className="h-3 w-3" /> Transferencia
                  </>
                ) : (
                  <>
                    <CreditCard className="h-3 w-3" /> PayPal
                  </>
                )}
              </Badge>
            </div>

            <p className="text-sm text-muted-foreground">
              <strong>{req.profiles?.username || req.profiles?.email || 'Usuario'}</strong> •{' '}
              {format(new Date(req.created_at), "d MMM yyyy, HH:mm", { locale: es })}
            </p>

            {req.method === 'bank_transfer' && (
              <div className="text-xs text-muted-foreground space-y-0.5 mt-2 rounded bg-muted/50 p-2">
                <p>Banco: <strong className="text-foreground">{req.bank_name}</strong></p>
                <p>Cuenta: <strong className="text-foreground font-mono">{req.account_number}</strong></p>
                <p>Titular: <strong className="text-foreground">{req.account_holder}</strong></p>
              </div>
            )}

            {req.method === 'paypal' && (
              <div className="text-xs text-muted-foreground mt-2 rounded bg-muted/50 p-2">
                <p>PayPal: <strong className="text-foreground">{req.paypal_email}</strong></p>
              </div>
            )}

            {req.admin_notes && (
              <p className="text-xs text-muted-foreground mt-1">Notas: {req.admin_notes}</p>
            )}
          </div>

          {showActions && (
            <div className="flex gap-2 shrink-0">
              <Button
                size="sm"
                onClick={() => {
                  setSelectedRequest(req);
                  setAction('approve');
                  setAdminNotes('');
                }}
                className="gap-1"
              >
                <CheckCircle className="h-3.5 w-3.5" />
                Aprobar
              </Button>
              <Button
                size="sm"
                variant="destructive"
                onClick={() => {
                  setSelectedRequest(req);
                  setAction('reject');
                  setAdminNotes('');
                }}
                className="gap-1"
              >
                <XCircle className="h-3.5 w-3.5" />
                Rechazar
              </Button>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Pending requests */}
      <div>
        <h3 className="text-lg font-semibold mb-3">
          Solicitudes pendientes ({pendingRequests.length})
        </h3>
        {pendingRequests.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              No hay solicitudes de retiro pendientes.
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {pendingRequests.map((req: any) => renderRequestCard(req, true))}
          </div>
        )}
      </div>

      {/* Processed requests */}
      {processedRequests.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold mb-3">Historial procesado</h3>
          <div className="space-y-3">
            {processedRequests.slice(0, 20).map((req: any) => renderRequestCard(req, false))}
          </div>
        </div>
      )}

      {/* Confirm dialog */}
      <Dialog
        open={!!selectedRequest && !!action}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedRequest(null);
            setAction(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {action === 'approve' ? '¿Aprobar retiro?' : '¿Rechazar retiro?'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="rounded-lg border p-3 text-sm">
              <p>
                <strong>Monto:</strong> ${Number(selectedRequest?.amount).toLocaleString('es-ES')}
              </p>
              <p>
                <strong>Usuario:</strong>{' '}
                {selectedRequest?.profiles?.username || selectedRequest?.profiles?.email}
              </p>
              <p>
                <strong>Método:</strong>{' '}
                {selectedRequest?.method === 'bank_transfer'
                  ? 'Transferencia bancaria'
                  : 'PayPal'}
              </p>
            </div>

            {action === 'reject' && (
              <p className="text-sm text-muted-foreground">
                Los fondos serán devueltos automáticamente al saldo del usuario.
              </p>
            )}

            <div className="space-y-2">
              <label className="text-sm font-medium">
                Notas {action === 'reject' ? '(motivo del rechazo)' : '(opcional)'}
              </label>
              <Textarea
                value={adminNotes}
                onChange={(e) => setAdminNotes(e.target.value)}
                placeholder={
                  action === 'reject'
                    ? 'Ingresa el motivo del rechazo...'
                    : 'Notas adicionales...'
                }
              />
            </div>

            <div className="flex gap-2 justify-end">
              <Button
                variant="outline"
                onClick={() => {
                  setSelectedRequest(null);
                  setAction(null);
                }}
              >
                Cancelar
              </Button>
              <Button
                variant={action === 'approve' ? 'default' : 'destructive'}
                onClick={handleProcess}
                disabled={processing}
              >
                {processing ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : action === 'approve' ? (
                  'Confirmar aprobación'
                ) : (
                  'Confirmar rechazo'
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
