import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { 
  Mail, User, Phone, Wallet, Calendar, Shield, 
  CheckCircle2, XCircle, AlertCircle, Clock, FileImage, Loader2, Eye
} from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface UserProfile {
  id: string;
  email: string;
  username: string | null;
  phone: string | null;
  balance: number;
  is_blocked: boolean;
  is_age_verified: boolean | null;
  document_status: string | null;
  document_front_url: string | null;
  document_back_url: string | null;
  document_rejection_reason: string | null;
  verified_at: string | null;
  created_at: string;
  updated_at: string;
}

interface UserDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: UserProfile | null;
  isEmailConfirmed: boolean;
  onUserUpdated?: () => void;
}

function StepItem({ label, completed, detail }: { label: string; completed: boolean; detail?: string }) {
  return (
    <div className="flex items-start gap-3 py-2">
      {completed ? (
        <CheckCircle2 className="h-5 w-5 text-success mt-0.5 shrink-0" />
      ) : (
        <XCircle className="h-5 w-5 text-destructive mt-0.5 shrink-0" />
      )}
      <div className="flex-1">
        <p className={`text-sm font-medium ${completed ? 'text-foreground' : 'text-muted-foreground'}`}>
          {label}
        </p>
        {detail && <p className="text-xs text-muted-foreground">{detail}</p>}
      </div>
      <Badge variant={completed ? 'default' : 'secondary'} className="text-xs shrink-0">
        {completed ? 'Completado' : 'Pendiente'}
      </Badge>
    </div>
  );
}

function InfoRow({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3 py-2">
      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted shrink-0">
        <Icon className="h-4 w-4 text-muted-foreground" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-sm font-medium truncate">{value}</p>
      </div>
    </div>
  );
}

function getDocumentStatusInfo(status: string | null) {
  switch (status) {
    case 'approved':
      return { label: 'Aprobado', variant: 'default' as const };
    case 'rejected':
      return { label: 'Rechazado', variant: 'destructive' as const };
    case 'pending':
      return { label: 'Pendiente de revisión', variant: 'secondary' as const };
    default:
      return { label: 'No enviado', variant: 'outline' as const };
  }
}

export function UserDetailDialog({ open, onOpenChange, user, isEmailConfirmed, onUserUpdated }: UserDetailDialogProps) {
  const { toast } = useToast();
  const [rejectionReason, setRejectionReason] = useState('');
  const [processing, setProcessing] = useState(false);
  const [showRejectForm, setShowRejectForm] = useState(false);
  const [docUrls, setDocUrls] = useState<{ front: string | null; back: string | null }>({ front: null, back: null });
  const [loadingDocs, setLoadingDocs] = useState(false);

  if (!user) return null;

  const docStatus = getDocumentStatusInfo(user.document_status);
  const hasDocuments = !!(user.document_front_url && user.document_back_url);
  const isDocApproved = user.document_status === 'approved';
  const isFullyVerified = isEmailConfirmed && hasDocuments && isDocApproved && user.is_age_verified;
  const canReview = hasDocuments && user.document_status !== 'approved';

  const completedSteps = [
    isEmailConfirmed,
    !!user.username,
    !!user.phone,
    hasDocuments,
    isDocApproved,
    user.is_age_verified,
  ].filter(Boolean).length;
  const totalSteps = 6;
  const progressPercent = Math.round((completedSteps / totalSteps) * 100);

  const handleViewDocuments = async () => {
    if (!user.document_front_url || !user.document_back_url) return;
    setLoadingDocs(true);
    try {
      const [frontRes, backRes] = await Promise.all([
        supabase.storage.from('identity-documents').createSignedUrl(user.document_front_url, 300),
        supabase.storage.from('identity-documents').createSignedUrl(user.document_back_url, 300),
      ]);
      setDocUrls({
        front: frontRes.data?.signedUrl || null,
        back: backRes.data?.signedUrl || null,
      });
    } catch {
      toast({ title: 'Error', description: 'No se pudieron cargar los documentos.', variant: 'destructive' });
    } finally {
      setLoadingDocs(false);
    }
  };

  const handleApprove = async () => {
    setProcessing(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          document_status: 'approved',
          is_age_verified: true,
          verified_at: new Date().toISOString(),
          document_rejection_reason: null,
        })
        .eq('id', user.id);

      if (error) throw error;

      toast({ title: 'Documentos aprobados', description: `Los documentos de ${user.email} han sido aprobados.` });
      onUserUpdated?.();
      onOpenChange(false);
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } finally {
      setProcessing(false);
    }
  };

  const handleReject = async () => {
    if (!rejectionReason.trim()) {
      toast({ title: 'Error', description: 'Ingresa un motivo de rechazo.', variant: 'destructive' });
      return;
    }
    setProcessing(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          document_status: 'rejected',
          document_rejection_reason: rejectionReason.trim(),
          is_age_verified: false,
          verified_at: null,
        })
        .eq('id', user.id);

      if (error) throw error;

      toast({ title: 'Documentos rechazados', description: `Los documentos de ${user.email} han sido rechazados.` });
      setRejectionReason('');
      setShowRejectForm(false);
      onUserUpdated?.();
      onOpenChange(false);
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } finally {
      setProcessing(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
              <User className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p>{user.username || 'Sin nombre'}</p>
              <p className="text-sm font-normal text-muted-foreground">{user.email}</p>
            </div>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5 pt-2">
          {/* Status badges */}
          <div className="flex flex-wrap gap-2">
            {user.is_blocked ? (
              <Badge variant="destructive">Bloqueado</Badge>
            ) : (
              <Badge variant="outline" className="text-success border-success">Activo</Badge>
            )}
            {isFullyVerified ? (
              <Badge className="bg-success text-success-foreground">Verificado</Badge>
            ) : (
              <Badge variant="secondary">No verificado</Badge>
            )}
            <Badge variant={docStatus.variant}>{docStatus.label}</Badge>
          </div>

          {/* Info */}
          <div className="rounded-lg border p-4 space-y-1">
            <InfoRow icon={Mail} label="Email" value={user.email} />
            <InfoRow icon={User} label="Nombre de usuario" value={user.username || 'No configurado'} />
            <InfoRow icon={Phone} label="Teléfono" value={user.phone || 'No configurado'} />
            <InfoRow icon={Wallet} label="Saldo" value={`$${Number(user.balance).toLocaleString('es-ES', { minimumFractionDigits: 2 })}`} />
            <InfoRow icon={Calendar} label="Fecha de registro" value={format(new Date(user.created_at), "dd MMM yyyy, HH:mm", { locale: es })} />
            {user.verified_at && (
              <InfoRow icon={Shield} label="Verificado el" value={format(new Date(user.verified_at), "dd MMM yyyy, HH:mm", { locale: es })} />
            )}
          </div>

          <Separator />

          {/* Document review section */}
          {hasDocuments && (
            <>
              <div>
                <h4 className="font-medium text-sm mb-3 flex items-center gap-2">
                  <FileImage className="h-4 w-4" />
                  Documentos de identidad
                </h4>

                {/* View documents button */}
                {!docUrls.front && (
                  <Button variant="outline" size="sm" className="gap-2 mb-3" onClick={handleViewDocuments} disabled={loadingDocs}>
                    {loadingDocs ? <Loader2 className="h-4 w-4 animate-spin" /> : <Eye className="h-4 w-4" />}
                    Ver documentos
                  </Button>
                )}

                {/* Document previews */}
                {docUrls.front && (
                  <div className="grid grid-cols-2 gap-3 mb-4">
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Frente</p>
                      <a href={docUrls.front} target="_blank" rel="noopener noreferrer">
                        <img src={docUrls.front} alt="Documento frente" className="rounded-lg border object-cover w-full h-32" />
                      </a>
                    </div>
                    {docUrls.back && (
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Reverso</p>
                        <a href={docUrls.back} target="_blank" rel="noopener noreferrer">
                          <img src={docUrls.back} alt="Documento reverso" className="rounded-lg border object-cover w-full h-32" />
                        </a>
                      </div>
                    )}
                  </div>
                )}

                {/* Approve / Reject actions */}
                {canReview && (
                  <div className="space-y-3">
                    {showRejectForm ? (
                      <div className="space-y-3 rounded-lg border border-destructive/30 p-3">
                        <Label htmlFor="rejection-reason" className="text-sm">Motivo del rechazo</Label>
                        <Textarea
                          id="rejection-reason"
                          value={rejectionReason}
                          onChange={(e) => setRejectionReason(e.target.value)}
                          placeholder="Ej: La imagen del documento no es legible..."
                          rows={3}
                        />
                        <div className="flex gap-2">
                          <Button variant="destructive" size="sm" onClick={handleReject} disabled={processing}>
                            {processing ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
                            Confirmar rechazo
                          </Button>
                          <Button variant="outline" size="sm" onClick={() => { setShowRejectForm(false); setRejectionReason(''); }}>
                            Cancelar
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex gap-2">
                        <Button size="sm" className="gap-2" onClick={handleApprove} disabled={processing}>
                          {processing ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                          Aprobar documentos
                        </Button>
                        <Button variant="destructive" size="sm" className="gap-2" onClick={() => setShowRejectForm(true)} disabled={processing}>
                          <XCircle className="h-4 w-4" />
                          Rechazar
                        </Button>
                      </div>
                    )}
                  </div>
                )}

                {user.document_status === 'rejected' && user.document_rejection_reason && (
                  <div className="mt-3 rounded-lg bg-destructive/10 border border-destructive/20 p-3">
                    <p className="text-xs font-medium text-destructive">Motivo del rechazo:</p>
                    <p className="text-sm text-destructive/80 mt-1">{user.document_rejection_reason}</p>
                  </div>
                )}
              </div>
              <Separator />
            </>
          )}

          {/* Verification checklist */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-medium text-sm">Pasos de verificación</h4>
              <span className="text-xs text-muted-foreground">{completedSteps}/{totalSteps} completados ({progressPercent}%)</span>
            </div>
            <div className="w-full h-2 rounded-full bg-secondary mb-4">
              <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${progressPercent}%` }} />
            </div>
            <div className="rounded-lg border p-4 space-y-1 divide-y">
              <StepItem label="Email confirmado" completed={isEmailConfirmed} detail={isEmailConfirmed ? 'El usuario verificó su correo electrónico' : 'El usuario no ha verificado su correo'} />
              <StepItem label="Nombre de usuario configurado" completed={!!user.username} detail={user.username ? `Username: ${user.username}` : undefined} />
              <StepItem label="Teléfono configurado" completed={!!user.phone} detail={user.phone ? `Tel: ${user.phone}` : undefined} />
              <StepItem label="Documentos de identidad enviados" completed={hasDocuments} detail={hasDocuments ? 'Frente y reverso del documento subidos' : 'No se han subido documentos'} />
              <StepItem label="Documentos aprobados" completed={isDocApproved} detail={
                user.document_status === 'rejected' && user.document_rejection_reason
                  ? `Rechazado: ${user.document_rejection_reason}`
                  : isDocApproved ? 'Documentos verificados por un administrador' : undefined
              } />
              <StepItem label="Verificación de edad" completed={!!user.is_age_verified} detail={user.is_age_verified ? 'Mayor de edad confirmado' : 'Aún no verificado'} />
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
