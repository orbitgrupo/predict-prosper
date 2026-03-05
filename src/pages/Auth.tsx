import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { Loader2, TrendingUp, Mail, Lock, User, Users } from 'lucide-react';
import { z } from 'zod';
import { useQuery } from '@tanstack/react-query';
import { PasswordStrengthIndicator } from '@/components/auth/PasswordStrengthIndicator';

const strongPasswordSchema = z.string()
  .min(8, 'Mínimo 8 caracteres')
  .regex(/[A-Z]/, 'Debe incluir al menos una mayúscula')
  .regex(/[0-9]/, 'Debe incluir al menos un número')
  .regex(/[^A-Za-z0-9]/, 'Debe incluir al menos un carácter especial (!@#$...)');

const loginSchema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(1, 'La contraseña es requerida'),
});

const signupSchema = z.object({
  email: z.string().email('Email inválido'),
  password: strongPasswordSchema,
  username: z.string().min(3, 'El nombre de usuario debe tener al menos 3 caracteres'),
});

export default function Auth() {
  const [searchParams] = useSearchParams();
  const [isLogin, setIsLogin] = useState(searchParams.get('mode') !== 'signup' && !searchParams.get('ref'));
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [referralCode, setReferralCode] = useState(searchParams.get('ref') || '');
  const [forgotEmail, setForgotEmail] = useState('');
  const [showForgot, setShowForgot] = useState(false);
  const [forgotLoading, setForgotLoading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  
  const { signIn, signUp, user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const { data: promoSettings } = useQuery({
    queryKey: ['app_settings'],
    queryFn: async () => {
      const { data } = await supabase
        .from('app_settings')
        .select('*')
        .eq('id', 'default')
        .single();
      return data;
    },
  });

  useEffect(() => {
    if (user) {
      navigate('/dashboard');
    }
  }, [user, navigate]);

  const validateForm = () => {
    try {
      if (isLogin) {
        loginSchema.parse({ email, password });
      } else {
        signupSchema.parse({ email, password, username });
      }
      setErrors({});
      return true;
    } catch (error) {
      if (error instanceof z.ZodError) {
        const newErrors: Record<string, string> = {};
        error.errors.forEach((err) => {
          if (err.path[0]) {
            newErrors[err.path[0] as string] = err.message;
          }
        });
        setErrors(newErrors);
      }
      return false;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) return;
    
    setLoading(true);

    try {
      if (isLogin) {
        const { error } = await signIn(email, password);
        if (error) {
          if (error.message.includes('Invalid login credentials')) {
            toast({
              title: 'Error de autenticación',
              description: 'Email o contraseña incorrectos.',
              variant: 'destructive',
            });
          } else {
            toast({
              title: 'Error',
              description: error.message,
              variant: 'destructive',
            });
          }
        } else {
          toast({
            title: '¡Bienvenido!',
            description: 'Has iniciado sesión correctamente.',
          });
          navigate('/dashboard');
        }
      } else {
        const { error } = await signUp(email, password, username, referralCode || undefined);
        if (error) {
          if (error.message.includes('already registered')) {
            toast({
              title: 'Usuario existente',
              description: 'Este email ya está registrado. Intenta iniciar sesión.',
              variant: 'destructive',
            });
          } else {
            toast({
              title: 'Error',
              description: error.message,
              variant: 'destructive',
            });
          }
        } else {
          toast({
            title: '¡Cuenta creada!',
            description: 'Te hemos enviado un correo de confirmación. Revisa tu bandeja de entrada para verificar tu cuenta.',
          });
          // Don't navigate - let user know to check email
        }
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-background via-background to-primary/5 px-4">
      <Card className="w-full max-w-md animate-fade-in">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-primary">
            <TrendingUp className="h-6 w-6 text-primary-foreground" />
          </div>
          <CardTitle className="font-display text-2xl">
            {isLogin ? 'Iniciar sesión' : 'Crear cuenta'}
          </CardTitle>
          <CardDescription>
            {isLogin 
              ? 'Ingresa a tu cuenta para continuar' 
              : promoSettings?.welcome_bonus_enabled && promoSettings.welcome_bonus_amount > 0
                ? `Regístrate y recibe $${promoSettings.welcome_bonus_amount} en créditos`
                : 'Regístrate para comenzar a predecir'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {!isLogin && (
              <div className="space-y-2">
                <Label htmlFor="username">Nombre de usuario</Label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="username"
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="tu_usuario"
                    className="pl-9"
                    disabled={loading}
                  />
                </div>
                {errors.username && (
                  <p className="text-xs text-destructive">{errors.username}</p>
                )}
              </div>
            )}
            
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="tu@email.com"
                  className="pl-9"
                  disabled={loading}
                />
              </div>
              {errors.email && (
                <p className="text-xs text-destructive">{errors.email}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Contraseña</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="pl-9"
                  disabled={loading}
                />
              </div>
              {!isLogin && <PasswordStrengthIndicator password={password} />}
              {errors.password && (
                <p className="text-xs text-destructive">{errors.password}</p>
              )}
            </div>

            {!isLogin && (
              <div className="space-y-2">
                <Label htmlFor="referral">Código de referido (opcional)</Label>
                <div className="relative">
                  <Users className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="referral"
                    type="text"
                    value={referralCode}
                    onChange={(e) => setReferralCode(e.target.value.toUpperCase())}
                    placeholder="XXXXXXXX"
                    className="pl-9 font-mono"
                    disabled={loading}
                  />
                </div>
              </div>
            )}

            {isLogin && (
              <button
                type="button"
                onClick={() => { setShowForgot(true); setForgotEmail(email); }}
                className="text-xs text-muted-foreground hover:text-primary hover:underline"
              >
                ¿Olvidaste tu contraseña?
              </button>
            )}

            <Button type="submit" className="w-full" size="lg" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {isLogin ? 'Iniciando sesión...' : 'Creando cuenta...'}
                </>
              ) : (
                isLogin ? 'Iniciar sesión' : 'Crear cuenta'
              )}
            </Button>
          </form>

          {showForgot && (
            <div className="mt-4 rounded-lg border border-border bg-muted/50 p-4 space-y-3">
              <p className="text-sm font-medium">Recuperar contraseña</p>
              <p className="text-xs text-muted-foreground">Te enviaremos un enlace para restablecer tu contraseña.</p>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  type="email"
                  value={forgotEmail}
                  onChange={(e) => setForgotEmail(e.target.value)}
                  placeholder="tu@email.com"
                  className="pl-9"
                  disabled={forgotLoading}
                />
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  disabled={forgotLoading || !forgotEmail}
                  onClick={async () => {
                    setForgotLoading(true);
                    try {
                      const { error } = await supabase.auth.resetPasswordForEmail(forgotEmail, {
                        redirectTo: `${window.location.origin}/reset-password`,
                      });
                      if (error) throw error;
                      toast({ title: 'Correo enviado', description: 'Revisa tu bandeja de entrada para restablecer tu contraseña.' });
                      setShowForgot(false);
                    } catch {
                      toast({ title: 'Error', description: 'No se pudo enviar el correo. Verifica el email e intenta de nuevo.', variant: 'destructive' });
                    } finally {
                      setForgotLoading(false);
                    }
                  }}
                >
                  {forgotLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Enviar enlace'}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setShowForgot(false)}>
                  Cancelar
                </Button>
              </div>
            </div>
          )}

          <div className="mt-6 text-center text-sm">
            {isLogin ? (
              <p className="text-muted-foreground">
                ¿No tienes cuenta?{' '}
                <button
                  type="button"
                  onClick={() => setIsLogin(false)}
                  className="font-medium text-primary hover:underline"
                >
                  Regístrate
                </button>
              </p>
            ) : (
              <p className="text-muted-foreground">
                ¿Ya tienes cuenta?{' '}
                <button
                  type="button"
                  onClick={() => setIsLogin(true)}
                  className="font-medium text-primary hover:underline"
                >
                  Inicia sesión
                </button>
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
