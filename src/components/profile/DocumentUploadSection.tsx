import { useState, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Loader2, Upload, FileCheck, FileX, AlertCircle, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface Profile {
  id: string;
  document_front_url: string | null;
  document_back_url: string | null;
  document_status: string | null;
  document_rejection_reason: string | null;
  is_age_verified: boolean;
}

interface DocumentUploadSectionProps {
  profile: Profile;
  onDocumentsUpdated: () => void;
}

export function DocumentUploadSection({ profile, onDocumentsUpdated }: DocumentUploadSectionProps) {
  const [isUploadingFront, setIsUploadingFront] = useState(false);
  const [isUploadingBack, setIsUploadingBack] = useState(false);
  const [isAgeVerified, setIsAgeVerified] = useState(profile.is_age_verified);
  const [isSavingAge, setIsSavingAge] = useState(false);
  
  const frontInputRef = useRef<HTMLInputElement>(null);
  const backInputRef = useRef<HTMLInputElement>(null);

  const uploadDocument = async (file: File, type: 'front' | 'back') => {
    const setUploading = type === 'front' ? setIsUploadingFront : setIsUploadingBack;
    setUploading(true);

    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${profile.id}/${type}-${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('identity-documents')
        .upload(fileName, file, { upsert: true });

      if (uploadError) throw uploadError;

      // Store only the file path - the bucket is private and requires signed URLs for access
      const updateData = type === 'front' 
        ? { document_front_url: fileName, document_status: 'pending' }
        : { document_back_url: fileName, document_status: 'pending' };

      const { error: updateError } = await supabase
        .from('profiles')
        .update(updateData)
        .eq('id', profile.id);

      if (updateError) throw updateError;

      toast.success(`Documento ${type === 'front' ? 'frontal' : 'trasero'} subido correctamente`);
      onDocumentsUpdated();
    } catch (error: any) {
      toast.error(error.message || 'Error al subir el documento');
    } finally {
      setUploading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, type: 'front' | 'back') => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
    if (!allowedTypes.includes(file.type)) {
      toast.error('Tipo de archivo no permitido. Use JPG, PNG, WEBP o PDF.');
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error('El archivo es demasiado grande. Máximo 5MB.');
      return;
    }

    uploadDocument(file, type);
  };

  const handleAgeVerificationChange = async (checked: boolean) => {
    setIsSavingAge(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ is_age_verified: checked })
        .eq('id', profile.id);

      if (error) throw error;

      setIsAgeVerified(checked);
      onDocumentsUpdated();
      
      if (checked) {
        toast.success('Confirmación de edad guardada');
      }
    } catch (error: any) {
      toast.error(error.message || 'Error al guardar la confirmación');
    } finally {
      setIsSavingAge(false);
    }
  };

  const getStatusBadge = () => {
    switch (profile.document_status) {
      case 'approved':
        return (
          <Badge className="bg-green-500/20 text-green-500 border-green-500/30">
            <CheckCircle2 className="h-3 w-3 mr-1" />
            Aprobado
          </Badge>
        );
      case 'rejected':
        return (
          <Badge variant="destructive">
            <FileX className="h-3 w-3 mr-1" />
            Rechazado
          </Badge>
        );
      default:
        return (
          <Badge variant="secondary">
            <AlertCircle className="h-3 w-3 mr-1" />
            Pendiente de revisión
          </Badge>
        );
    }
  };

  return (
    <div className="space-y-6 pt-4 border-t">
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-base font-semibold">Verificación de identidad</Label>
          {getStatusBadge()}
        </div>
        <p className="text-sm text-muted-foreground">
          Para poder retirar fondos, debes subir un documento de identidad válido y confirmar que eres mayor de 18 años.
        </p>
      </div>

      {profile.document_status === 'rejected' && profile.document_rejection_reason && (
        <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/30">
          <p className="text-sm text-destructive flex items-start gap-2">
            <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
            <span><strong>Motivo del rechazo:</strong> {profile.document_rejection_reason}</span>
          </p>
        </div>
      )}

      {/* Age verification checkbox */}
      <div className="flex items-start space-x-3 p-4 rounded-lg bg-muted/50">
        <Checkbox
          id="age-verification"
          checked={isAgeVerified}
          onCheckedChange={handleAgeVerificationChange}
          disabled={isSavingAge || profile.document_status === 'approved'}
        />
        <div className="space-y-1">
          <Label 
            htmlFor="age-verification" 
            className="text-sm font-medium cursor-pointer"
          >
            Confirmo que soy mayor de 18 años
          </Label>
          <p className="text-xs text-muted-foreground">
            Al marcar esta casilla, declaro bajo juramento que tengo 18 años o más y que la información proporcionada es verídica.
          </p>
        </div>
      </div>

      {/* Document uploads */}
      <div className="grid gap-4 sm:grid-cols-2">
        {/* Front document */}
        <div className="space-y-2">
          <Label>Documento frontal</Label>
          <input
            ref={frontInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,application/pdf"
            onChange={(e) => handleFileChange(e, 'front')}
            className="hidden"
          />
          <Button
            type="button"
            variant="outline"
            className={cn(
              "w-full h-24 flex flex-col gap-2",
              profile.document_front_url && "border-green-500/50 bg-green-500/5"
            )}
            onClick={() => frontInputRef.current?.click()}
            disabled={isUploadingFront || profile.document_status === 'approved'}
          >
            {isUploadingFront ? (
              <Loader2 className="h-6 w-6 animate-spin" />
            ) : profile.document_front_url ? (
              <>
                <FileCheck className="h-6 w-6 text-green-500" />
                <span className="text-xs text-green-500">Documento subido</span>
              </>
            ) : (
              <>
                <Upload className="h-6 w-6" />
                <span className="text-xs">Subir frente del documento</span>
              </>
            )}
          </Button>
        </div>

        {/* Back document */}
        <div className="space-y-2">
          <Label>Documento trasero (opcional)</Label>
          <input
            ref={backInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,application/pdf"
            onChange={(e) => handleFileChange(e, 'back')}
            className="hidden"
          />
          <Button
            type="button"
            variant="outline"
            className={cn(
              "w-full h-24 flex flex-col gap-2",
              profile.document_back_url && "border-green-500/50 bg-green-500/5"
            )}
            onClick={() => backInputRef.current?.click()}
            disabled={isUploadingBack || profile.document_status === 'approved'}
          >
            {isUploadingBack ? (
              <Loader2 className="h-6 w-6 animate-spin" />
            ) : profile.document_back_url ? (
              <>
                <FileCheck className="h-6 w-6 text-green-500" />
                <span className="text-xs text-green-500">Documento subido</span>
              </>
            ) : (
              <>
                <Upload className="h-6 w-6" />
                <span className="text-xs">Subir reverso del documento</span>
              </>
            )}
          </Button>
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        Formatos aceptados: JPG, PNG, WEBP, PDF. Tamaño máximo: 5MB.
      </p>

      {/* Withdrawal status info */}
      {profile.document_status !== 'approved' && (
        <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/30">
          <p className="text-sm text-amber-600 dark:text-amber-400 flex items-start gap-2">
            <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
            <span>
              No podrás retirar fondos hasta que tus documentos sean aprobados por un administrador y confirmes que eres mayor de 18 años.
            </span>
          </p>
        </div>
      )}
    </div>
  );
}
