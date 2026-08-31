import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Navbar } from '@/components/layout/Navbar';
import { EmailConfirmationBanner } from '@/components/layout/EmailConfirmationBanner';
import { useAuth } from '@/hooks/useAuth';
import { DocumentUploadSection } from '@/components/profile/DocumentUploadSection';
import { WithdrawalSection } from '@/components/profile/WithdrawalSection';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, ShieldCheck, Banknote, CheckCircle2, Circle } from 'lucide-react';
import { cn } from '@/lib/utils';

function Step({
  index,
  title,
  description,
  done,
  active,
}: {
  index: number;
  title: string;
  description: string;
  done: boolean;
  active: boolean;
}) {
  return (
    <div className="flex items-start gap-3">
      <div
        className={cn(
          'flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-sm font-semibold',
          done && 'border-primary bg-primary text-primary-foreground',
          !done && active && 'border-primary text-primary',
          !done && !active && 'border-muted text-muted-foreground'
        )}
      >
        {done ? <CheckCircle2 className="h-4 w-4" /> : index}
      </div>
      <div className="min-w-0">
        <p className={cn('text-sm font-medium', !done && !active && 'text-muted-foreground')}>{title}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
    </div>
  );
}

export default function Withdrawals() {
  const { user, profile, loading, refreshProfile } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !user) navigate('/auth');
  }, [user, loading, navigate]);

  if (loading || !user || !profile) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  const docsUploaded = !!profile.document_front_url && !!profile.document_back_url;
  const isVerified = profile.document_status === 'approved' && profile.is_age_verified === true;

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <EmailConfirmationBanner />

      <main className="container mx-auto max-w-4xl px-4 py-6 sm:py-8">
        <div className="mb-6">
          <h1 className="font-display text-2xl sm:text-3xl font-bold flex items-center gap-2">
            <Banknote className="h-7 w-7 text-primary" />
            Retiros
          </h1>
          <p className="mt-1 text-sm sm:text-base text-muted-foreground">
            Verifica tu identidad, solicita el retiro y recibe la transferencia en tu cuenta real.
          </p>
        </div>

        {/* Progreso del flujo */}
        <Card className="mb-6">
          <CardContent className="grid gap-4 pt-6 sm:grid-cols-3">
            <Step
              index={1}
              title="Verifica tu identidad"
              description="Sube tu documento y confirma que eres mayor de 18 años."
              done={isVerified}
              active={!isVerified}
            />
            <Step
              index={2}
              title="Solicita el retiro"
              description="Mínimo $50 por transferencia bancaria o PayPal."
              done={false}
              active={isVerified}
            />
            <Step
              index={3}
              title="Aprobación y transferencia"
              description="Un administrador revisa y envía el dinero a tu cuenta."
              done={false}
              active={false}
            />
          </CardContent>
        </Card>

        {/* Paso 1: verificación */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <ShieldCheck className="h-5 w-5" />
              Verificación de identidad
              {isVerified && (
                <span className="ml-auto flex items-center gap-1 text-xs font-normal text-green-600">
                  <CheckCircle2 className="h-4 w-4" /> Verificado
                </span>
              )}
              {!isVerified && docsUploaded && profile.document_status === 'pending' && (
                <span className="ml-auto flex items-center gap-1 text-xs font-normal text-muted-foreground">
                  <Circle className="h-3 w-3" /> En revisión
                </span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <DocumentUploadSection profile={profile} onDocumentsUpdated={refreshProfile} />
          </CardContent>
        </Card>

        {/* Pasos 2 y 3 */}
        <WithdrawalSection userId={user.id} />
      </main>
    </div>
  );
}
