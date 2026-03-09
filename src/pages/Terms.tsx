import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Loader2, ShieldCheck } from 'lucide-react';

export default function Terms() {
  const [accepted, setAccepted] = useState(false);
  const [loading, setLoading] = useState(false);
  const { user, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleAccept = async () => {
    if (!user || !accepted) return;
    setLoading(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ 
          accepted_terms: true, 
          accepted_terms_at: new Date().toISOString() 
        } as any)
        .eq('id', user.id);

      if (error) throw error;

      await refreshProfile();
      toast({
        title: 'Términos aceptados',
        description: 'Ahora puedes usar la plataforma.',
      });
      navigate('/dashboard');
    } catch (err: any) {
      toast({
        title: 'Error',
        description: err.message || 'No se pudieron aceptar los términos.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-2xl">
        <CardHeader className="text-center space-y-2">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <ShieldCheck className="h-6 w-6 text-primary" />
          </div>
          <CardTitle className="font-display text-2xl">Términos y Condiciones de Uso</CardTitle>
          <p className="text-sm text-muted-foreground">
            Debes leer y aceptar los siguientes términos antes de continuar.
          </p>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[400px] rounded-lg border p-4">
            <div className="prose prose-sm max-w-none space-y-4 text-foreground">
              <h2 className="text-lg font-semibold">1. Aceptación de los Términos</h2>
              <p className="text-sm text-muted-foreground">
                Al acceder y utilizar esta plataforma de predicciones, aceptas estar sujeto a estos Términos y Condiciones de Uso. 
                Si no estás de acuerdo con alguno de estos términos, no deberás utilizar la plataforma.
              </p>

              <h2 className="text-lg font-semibold">2. Descripción del Servicio</h2>
              <p className="text-sm text-muted-foreground">
                La plataforma permite a los usuarios registrados participar en mercados de predicciones donde pueden 
                apostar sobre el resultado de eventos futuros utilizando un saldo virtual o real según las condiciones del servicio.
              </p>

              <h2 className="text-lg font-semibold">3. Registro y Cuenta de Usuario</h2>
              <p className="text-sm text-muted-foreground">
                Para utilizar la plataforma debes crear una cuenta proporcionando información veraz y actualizada. 
                Eres responsable de mantener la confidencialidad de tus credenciales de acceso y de todas las actividades 
                que ocurran bajo tu cuenta.
              </p>

              <h2 className="text-lg font-semibold">4. Edad Mínima</h2>
              <p className="text-sm text-muted-foreground">
                Debes ser mayor de 18 años para utilizar esta plataforma. Al aceptar estos términos, confirmas que 
                cumples con este requisito de edad.
              </p>

              <h2 className="text-lg font-semibold">5. Uso Responsable y Restricciones Geográficas</h2>
              <p className="text-sm text-muted-foreground">
                Te comprometes a utilizar la plataforma de manera responsable y ética. Queda estrictamente prohibido:
              </p>
              <ul className="list-disc pl-6 text-sm text-muted-foreground space-y-1">
                <li>Crear múltiples cuentas para manipular mercados.</li>
                <li>Utilizar información privilegiada para obtener ventajas indebidas.</li>
                <li>Realizar cualquier actividad que interfiera con el funcionamiento normal de la plataforma.</li>
                <li>Intentar acceder a cuentas de otros usuarios sin autorización.</li>
                <li><strong className="text-foreground">Restricción territorial:</strong> Por motivos legales, los usuarios que se encuentren dentro del territorio de los Estados Unidos de América no tienen permitido realizar apuestas. Pueden crear cuentas y visualizar el contenido, pero la función de apostar se encuentra deshabilitada.</li>
              </ul>

              <h2 className="text-lg font-semibold">6. Saldo y Transacciones</h2>
              <p className="text-sm text-muted-foreground">
                Las apuestas realizadas son finales una vez confirmadas, salvo en mercados donde el retiro anticipado 
                (cashout) esté habilitado. El valor del cashout se calcula según las probabilidades del momento y puede 
                resultar en una ganancia o pérdida respecto al monto original apostado.
              </p>

              <h2 className="text-lg font-semibold">7. Retiros</h2>
              <p className="text-sm text-muted-foreground">
                Los retiros están sujetos a verificación de identidad y aprobación por parte del equipo administrativo. 
                La plataforma se reserva el derecho de rechazar solicitudes de retiro que no cumplan con los requisitos 
                de verificación establecidos.
              </p>

              <h2 className="text-lg font-semibold">8. Resolución de Mercados</h2>
              <p className="text-sm text-muted-foreground">
                Los mercados son resueltos por los administradores de la plataforma basándose en fuentes verificables. 
                Las ganancias se distribuyen proporcionalmente entre los apostadores que seleccionaron la opción ganadora.
              </p>

              <h2 className="text-lg font-semibold">9. Limitación de Responsabilidad</h2>
              <p className="text-sm text-muted-foreground">
                La plataforma no garantiza ganancias ni resultados específicos. Participar en mercados de predicciones 
                implica riesgo de pérdida. La plataforma no se hace responsable por pérdidas financieras derivadas del 
                uso del servicio.
              </p>

              <h2 className="text-lg font-semibold">10. Suspensión y Bloqueo</h2>
              <p className="text-sm text-muted-foreground">
                La plataforma se reserva el derecho de suspender o bloquear cuentas que violen estos términos, 
                realicen actividades sospechosas o fraudulentas.
              </p>

              <h2 className="text-lg font-semibold">11. Modificaciones</h2>
              <p className="text-sm text-muted-foreground">
                Nos reservamos el derecho de modificar estos términos en cualquier momento. Los usuarios serán 
                notificados de cambios significativos y deberán aceptar las nuevas condiciones para continuar 
                utilizando la plataforma.
              </p>

              <h2 className="text-lg font-semibold">12. Privacidad</h2>
              <p className="text-sm text-muted-foreground">
                Tus datos personales serán tratados conforme a nuestra Política de Privacidad. Al utilizar la 
                plataforma, consientes la recopilación y uso de información según lo descrito en dicha política.
              </p>

              <h2 className="text-lg font-semibold">13. Contacto</h2>
              <p className="text-sm text-muted-foreground">
                Para cualquier consulta relacionada con estos términos, puedes contactarnos a través de los 
                canales de soporte disponibles en la plataforma.
              </p>
            </div>
          </ScrollArea>
        </CardContent>
        <CardFooter className="flex flex-col gap-4">
          <div className="flex items-center space-x-2">
            <Checkbox 
              id="terms" 
              checked={accepted} 
              onCheckedChange={(checked) => setAccepted(checked === true)} 
            />
            <label
              htmlFor="terms"
              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
            >
              He leído y acepto los Términos y Condiciones de Uso
            </label>
          </div>
          <Button 
            onClick={handleAccept} 
            disabled={!accepted || loading} 
            className="w-full"
          >
            {loading ? (
              <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Procesando...</>
            ) : (
              'Aceptar y continuar'
            )}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
