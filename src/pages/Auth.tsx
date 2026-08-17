import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { Loader2, TrendingUp, Mail, Lock, User, Users, ShieldAlert, Phone } from 'lucide-react';
import { z } from 'zod';
import { useQuery } from '@tanstack/react-query';
import { PasswordStrengthIndicator } from '@/components/auth/PasswordStrengthIndicator';
import { useRateLimit } from '@/hooks/useRateLimit';
import { friendlyError } from '@/lib/errors';

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
  phone: z.string()
    .refine((value) => !value || /^\+[1-9][0-9]{7,14}$/.test(value), 'Usa formato internacional, por ejemplo +18095551234'),
  username: z.string()
    .min(3, 'El nombre de usuario debe tener al menos 3 caracteres')
    .max(30, 'El nombre de usuario no puede superar 30 caracteres')
    .regex(
      /^[a-zA-Z0-9_\-.áéíóúñüÁÉÍÓÚÑÜ]+$/,
      'Solo se permiten letras, números, puntos, guiones y guión bajo'
    ),
});

export default function Auth() {
  const [searchParams] = useSearchParams();
  const refCode = searchParams.get('ref') || '';
  const [isLogin, setIsLogin] = useState(searchParams.get('mode') !== 'signup' && !refCode);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [phone, setPhone] = useState('');
  const [referralCode, setReferralCode] = useState(refCode);
  const [forgotEmail, setForgotEmail] = useState('');
  const [showForgot, setShowForgot] = useState(false);

  // Track referral link click
  useEffect(() => {
    if (refCode) {
      supabase.rpc('track_referral_click', { p_referral_code: refCode } as any).then();
    }
  }, [refCode]);
  const [forgotLoading, setForgotLoading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const { isLocked, getRemainingLockTime, recordAttempt, resetAttempts, attemptsLeft } = useRateLimit({
    maxAttempts: 5,
    windowMs: 60000,
    lockoutMs: 120000,
  });
  const [lockTimer, setLockTimer] = useState(0);
  
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

  // Lock timer countdown
  useEffect(() => {
    if (!isLocked()) return;
    const interval = setInterval(() => {
      const remaining = getRemainingLockTime();
      setLockTimer(remaining);
      if (remaining <= 0) clearInterval(interval);
    }, 1000);
    return () => clearInterval(interval);
  }, [isLocked, getRemainingLockTime]);

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
        const phoneRequired = (promoSettings as any)?.phone_required_on_signup ?? false;
        signupSchema.parse({ email, password, username, phone: phone.trim() });
        if (phoneRequired && !phone.trim()) {
          setErrors({ phone: 'El número telefónico es obligatorio' });
          return false;
        }
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

    if (isLogin && isLocked()) {
      toast({
        title: 'Cuenta bloqueada temporalmente',
        description: `Demasiados intentos fallidos. Intenta de nuevo en ${getRemainingLockTime()} segundos.`,
        variant: 'destructive',
      });
      return;
    }
    
    setLoading(true);

    try {
      if (isLogin) {
        const { error } = await signIn(email, password);
        if (error) {
          recordAttempt();
          if (error.message.includes('Invalid login credentials')) {
            toast({
              title: 'Error de autenticación',
              description: `Email o contraseña incorrectos. ${attemptsLeft > 0 ? `Te quedan ${attemptsLeft} intentos.` : ''}`,
              variant: 'destructive',
            });
          } else {
            toast({
              title: 'Error',
              description: friendlyError(error),
              variant: 'destructive',
            });
          }
        } else {
          resetAttempts();
          toast({
            title: '¡Bienvenido!',
            description: 'Has iniciado sesión correctamente.',
          });
          navigate('/dashboard');
        }
      } else {
        const { error } = await signUp(email, password, username, referralCode || undefined, phone.trim() || undefined);
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
              description: friendlyError(error),
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
            
            {!isLogin && (
              <div className="space-y-2">
                <Label htmlFor="phone">
                  Teléfono {(promoSettings as any)?.phone_required_on_signup ? '*' : '(opcional)'}
                </Label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="phone"
                    type="tel"
                    autoComplete="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value.replace(/[\s()-]/g, ''))}
                    placeholder="+18095551234"
                    className="pl-9"
                    disabled={loading}
                    required={(promoSettings as any)?.phone_required_on_signup ?? false}
                  />
                </div>
                <p className="text-xs text-muted-foreground">Incluye el código de país.</p>
                {errors.phone && <p className="text-xs text-destructive">{errors.phone}</p>}
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

            {isLogin && isLocked() && (
              <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                <ShieldAlert className="h-4 w-4 shrink-0" />
                <span>Bloqueado temporalmente. Intenta en {lockTimer}s</span>
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

            <Button type="submit" className="w-full" size="lg" disabled={loading || (isLogin && isLocked())}>
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
