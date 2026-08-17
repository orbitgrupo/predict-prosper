import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { DocumentUploadSection } from './DocumentUploadSection';
import { ScrollArea } from '@/components/ui/scroll-area';
import { friendlyError } from '@/lib/errors';

interface Profile {
  id: string;
  email: string;
  username: string | null;
  phone: string | null;
  balance: number;
  document_front_url: string | null;
  document_back_url: string | null;
  document_status: string | null;
  document_rejection_reason: string | null;
  is_age_verified: boolean;
}

interface EditProfileDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  profile: Profile;
}

export function EditProfileDialog({ open, onOpenChange, profile }: EditProfileDialogProps) {
  const { refreshProfile } = useAuth();
  const [username, setUsername] = useState(profile.username || '');
  const [phone, setPhone] = useState(profile.phone || '');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!username.trim()) {
      toast.error('El nombre de usuario no puede estar vacío');
      return;
    }

    if (username.length < 3) {
      toast.error('El nombre de usuario debe tener al menos 3 caracteres');
      return;
    }

    if (username.length > 30) {
      toast.error('El nombre de usuario no puede superar 30 caracteres');
      return;
    }

    // Validar caracteres permitidos en username
    const usernameRegex = /^[a-zA-Z0-9_\-.áéíóúñüÁÉÍÓÚÑÜ]+$/;
    if (!usernameRegex.test(username.trim())) {
      toast.error('El nombre de usuario solo puede contener letras, números, puntos, guiones y guión bajo');
      return;
    }

    // Validar teléfono si se proporciona
    const phoneRegex = /^[\d\s\-+()]*$/;
    if (phone && !phoneRegex.test(phone)) {
      toast.error('El número de teléfono contiene caracteres inválidos');
      return;
    }

    if (phone && phone.length > 20) {
      toast.error('El número de teléfono es demasiado largo');
      return;
    }

    setIsLoading(true);

    try {
      const { data, error } = await supabase.rpc('update_profile_basic' as any, {
        p_username: username.trim(),
        p_phone: phone.trim() || null,
      } as any);

      if (error) throw error;
      const result = data as { success: boolean; error?: string };
      if (!result.success) throw new Error(result.error || 'No se pudo actualizar el perfil');

      await refreshProfile();
      toast.success('Perfil actualizado correctamente');
      onOpenChange(false);
    } catch (error: any) {
      toast.error(friendlyError(error));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>Editar perfil</DialogTitle>
          <DialogDescription>
            Actualiza la información de tu perfil y verifica tu identidad.
          </DialogDescription>
        </DialogHeader>
        <ScrollArea className="max-h-[calc(90vh-120px)] pr-4">
          <form onSubmit={handleSubmit} className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={profile.email}
                disabled
                className="bg-muted"
              />
              <p className="text-xs text-muted-foreground">
                El email no se puede cambiar.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="username">Nombre de usuario</Label>
              <Input
                id="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Tu nombre de usuario"
                minLength={3}
                maxLength={30}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone">Número de teléfono</Label>
              <Input
                id="phone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+1 234 567 8900"
                maxLength={20}
              />
              <p className="text-xs text-muted-foreground">
                Opcional. Solo números, espacios, guiones y paréntesis.
              </p>
            </div>

            {/* Document Upload Section */}
            <DocumentUploadSection 
              profile={profile}
              onDocumentsUpdated={refreshProfile}
            />

            <div className="flex justify-end gap-3 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isLoading}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Guardar cambios
              </Button>
            </div>
          </form>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
