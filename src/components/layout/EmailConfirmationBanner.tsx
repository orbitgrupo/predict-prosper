import { useAuth } from '@/hooks/useAuth';
import { AlertTriangle, Mail } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useState } from 'react';
import { useToast } from '@/hooks/use-toast';

export function EmailConfirmationBanner() {
  const { user, isEmailConfirmed } = useAuth();
  const [resending, setResending] = useState(false);
  const { toast } = useToast();

  if (!user || isEmailConfirmed) return null;

  const handleResend = async () => {
    setResending(true);
    try {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: user.email!,
      });
      if (error) throw error;
      toast({
        title: 'Correo reenviado',
        description: 'Revisa tu bandeja de entrada y confirma tu email.',
      });
    } catch {
      toast({
        title: 'Error',
        description: 'No se pudo reenviar el correo. Intenta más tarde.',
        variant: 'destructive',
      });
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="bg-warning/10 border-b border-warning/20 px-4 py-3">
      <div className="container mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm">
          <AlertTriangle className="h-4 w-4 text-warning shrink-0" />
          <p>
            <span className="font-medium">Tu email no está confirmado.</span>{' '}
            Revisa tu bandeja de entrada para verificar tu cuenta y poder interactuar en la plataforma.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="shrink-0 gap-2"
          onClick={handleResend}
          disabled={resending}
        >
          <Mail className="h-4 w-4" />
          {resending ? 'Enviando...' : 'Reenviar correo'}
        </Button>
      </div>
    </div>
  );
}
