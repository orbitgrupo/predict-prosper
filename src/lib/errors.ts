/**
 * Convierte errores internos de Supabase/PostgreSQL en mensajes amigables.
 * Nunca exponer códigos de error internos al usuario final.
 */
export function friendlyError(err: unknown): string {
  // Log técnico solo en consola, nunca al usuario
  console.error('[Error interno]', err);

  if (!err || typeof err !== 'object') return 'Error inesperado. Intenta de nuevo.';

  const e = err as Record<string, unknown>;
  const code = (e.code as string) ?? '';
  const message = (e.message as string) ?? '';

  // Códigos PostgreSQL
  if (code === '23505') return 'Este valor ya está en uso. Prueba con uno diferente.';
  if (code === '23503') return 'Referencia inválida. Verifica los datos ingresados.';
  if (code === '23514') return 'El valor ingresado no cumple las condiciones requeridas.';
  if (code === '22P02') return 'Formato de datos inválido.';

  // Códigos Supabase / PostgREST
  if (code === 'PGRST116') return 'No se encontró el registro solicitado.';
  if (code === 'PGRST301') return 'Sesión expirada. Por favor inicia sesión nuevamente.';

  // Mensajes de Supabase Auth
  if (message.includes('Invalid login credentials')) return 'Email o contraseña incorrectos.';
  if (message.includes('Email not confirmed')) return 'Debes confirmar tu email antes de continuar.';
  if (message.includes('already registered')) return 'Este email ya tiene una cuenta registrada.';
  if (message.includes('Password should be')) return 'La contraseña no cumple los requisitos mínimos.';
  if (message.includes('email rate limit')) return 'Ya se envió un correo recientemente. Espera unos minutos antes de pedir otro.';
  if (message.includes('over_email_send_rate_limit')) return 'Ya se envió un correo recientemente. Espera unos minutos antes de pedir otro.';
  if (message.includes('otp_expired')) return 'El enlace expiró. Solicita uno nuevo.';
  if (message.includes('invalid request')) return 'El enlace no es válido o ya fue utilizado.';
  if (message.includes('rate limit')) return 'Demasiados intentos. Espera unos minutos e intenta de nuevo.';
  if (message.includes('User not found')) return 'No se encontró una cuenta con esos datos.';

  return 'Error inesperado. Por favor intenta de nuevo.';
}
