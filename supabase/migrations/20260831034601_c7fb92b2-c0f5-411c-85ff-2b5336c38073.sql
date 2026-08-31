ALTER TABLE public.withdrawal_requests
  ADD COLUMN IF NOT EXISTS paid_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS payment_reference text;

CREATE OR REPLACE FUNCTION public.mark_withdrawal_paid(p_withdrawal_id uuid, p_reference text DEFAULT NULL::text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_request RECORD;
BEGIN
  IF NOT has_role(auth.uid(), 'admin'::app_role) THEN
    RETURN json_build_object('success', false, 'error', 'No autorizado');
  END IF;

  SELECT * INTO v_request FROM withdrawal_requests WHERE id = p_withdrawal_id FOR UPDATE;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Solicitud no encontrada');
  END IF;

  IF v_request.status <> 'approved' THEN
    RETURN json_build_object('success', false, 'error', 'Solo se pueden marcar como transferidas las solicitudes aprobadas');
  END IF;

  IF v_request.paid_at IS NOT NULL THEN
    RETURN json_build_object('success', false, 'error', 'Esta solicitud ya fue marcada como transferida');
  END IF;

  UPDATE withdrawal_requests
  SET paid_at = now(),
      payment_reference = NULLIF(p_reference, ''),
      updated_at = now()
  WHERE id = p_withdrawal_id;

  INSERT INTO notifications (user_id, title, message, type)
  VALUES (
    v_request.user_id,
    'Transferencia realizada',
    'Tu retiro por $' || v_request.amount || ' fue transferido a tu cuenta.' ||
      CASE WHEN NULLIF(p_reference, '') IS NOT NULL THEN ' Referencia: ' || p_reference ELSE '' END,
    'withdrawal_paid'
  );

  RETURN json_build_object('success', true);
END;
$function$;