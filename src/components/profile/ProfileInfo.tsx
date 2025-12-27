import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { User, Mail, Phone, Edit2 } from 'lucide-react';
import { EditProfileDialog } from './EditProfileDialog';

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

interface ProfileInfoProps {
  profile: Profile;
  userId: string;
}

export function ProfileInfo({ profile, userId }: ProfileInfoProps) {
  const [isEditOpen, setIsEditOpen] = useState(false);
  
  const initials = profile.username 
    ? profile.username.slice(0, 2).toUpperCase() 
    : profile.email.slice(0, 2).toUpperCase();

  return (
    <>
      <Card>
        <CardHeader className="text-center pb-2">
          <div className="mx-auto mb-4">
            <Avatar className="h-24 w-24">
              <AvatarFallback className="bg-primary text-primary-foreground text-2xl font-bold">
                {initials}
              </AvatarFallback>
            </Avatar>
          </div>
          <CardTitle className="font-display text-xl">
            {profile.username || 'Usuario'}
          </CardTitle>
          <Badge variant="secondary" className="mx-auto mt-2">
            Miembro
          </Badge>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-3 text-sm">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted">
              <Mail className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-muted-foreground text-xs">Email</p>
              <p className="font-medium truncate">{profile.email}</p>
            </div>
          </div>

          <div className="flex items-center gap-3 text-sm">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted">
              <User className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="flex-1">
              <p className="text-muted-foreground text-xs">Nombre de usuario</p>
              <p className="font-medium">{profile.username || 'No configurado'}</p>
            </div>
          </div>

          <div className="flex items-center gap-3 text-sm">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted">
              <Phone className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="flex-1">
              <p className="text-muted-foreground text-xs">Teléfono</p>
              <p className="font-medium">{profile.phone || 'No configurado'}</p>
            </div>
          </div>

          <div className="pt-4 border-t">
            <div className="text-center">
              <p className="text-muted-foreground text-xs mb-1">Saldo disponible</p>
              <p className="font-display text-3xl font-bold text-primary">
                ${profile.balance.toLocaleString('es-ES', { minimumFractionDigits: 2 })}
              </p>
            </div>
          </div>

          <Button 
            variant="outline" 
            className="w-full gap-2"
            onClick={() => setIsEditOpen(true)}
          >
            <Edit2 className="h-4 w-4" />
            Editar perfil
          </Button>
        </CardContent>
      </Card>

      <EditProfileDialog 
        open={isEditOpen} 
        onOpenChange={setIsEditOpen}
        profile={profile}
      />
    </>
  );
}
