
-- Create notifications table
CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title text NOT NULL,
  message text NOT NULL,
  type text NOT NULL DEFAULT 'info',
  is_read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Users can view their own notifications
CREATE POLICY "Users can view their own notifications"
  ON public.notifications FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Users can update (mark as read) their own notifications
CREATE POLICY "Users can update their own notifications"
  ON public.notifications FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

-- System can insert notifications (via SECURITY DEFINER functions)
-- No direct insert policy needed since process_withdrawal is SECURITY DEFINER

-- Enable realtime for notifications
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;

-- Update process_withdrawal to create notifications
CREATE OR REPLACE FUNCTION public.process_withdrawal(
  p_withdrawal_id uuid,
  p_action text,
  p_admin_notes text DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_request RECORD;
BEGIN
  -- Validate admin
  IF NOT has_role(auth.uid(), 'admin') THEN
    RETURN json_build_object('success', false, 'error', 'No autorizado');
  END IF;

  -- Get request
  SELECT * INTO v_request FROM withdrawal_requests WHERE id = p_withdrawal_id FOR UPDATE;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Solicitud no encontrada');
  END IF;

  IF v_request.status != 'pending' THEN
    RETURN json_build_object('success', false, 'error', 'Esta solicitud ya fue procesada');
  END IF;

  IF p_action = 'approve' THEN
    UPDATE withdrawal_requests
    SET status = 'approved', admin_notes = p_admin_notes, reviewed_by = auth.uid(), reviewed_at = now(), updated_at = now()
    WHERE id = p_withdrawal_id;

    -- Notify user
    INSERT INTO notifications (user_id, title, message, type)
    VALUES (v_request.user_id, '¡Retiro aprobado!', 
      'Tu solicitud de retiro por $' || v_request.amount || ' ha sido aprobada.' || 
      CASE WHEN p_admin_notes IS NOT NULL AND p_admin_notes != '' THEN ' Nota: ' || p_admin_notes ELSE '' END,
      'withdrawal_approved');

  ELSIF p_action = 'reject' THEN
    -- Refund balance
    UPDATE profiles SET balance = balance + v_request.amount WHERE id = v_request.user_id;

    -- Record refund transaction
    INSERT INTO transactions (user_id, type, amount, description)
    VALUES (v_request.user_id, 'withdrawal_refund', v_request.amount, 'Retiro rechazado - fondos devueltos');

    UPDATE withdrawal_requests
    SET status = 'rejected', admin_notes = p_admin_notes, reviewed_by = auth.uid(), reviewed_at = now(), updated_at = now()
    WHERE id = p_withdrawal_id;

    -- Notify user
    INSERT INTO notifications (user_id, title, message, type)
    VALUES (v_request.user_id, 'Retiro rechazado', 
      'Tu solicitud de retiro por $' || v_request.amount || ' ha sido rechazada. Los fondos han sido devueltos a tu saldo.' ||
      CASE WHEN p_admin_notes IS NOT NULL AND p_admin_notes != '' THEN ' Motivo: ' || p_admin_notes ELSE '' END,
      'withdrawal_rejected');
  ELSE
    RETURN json_build_object('success', false, 'error', 'Acción no válida');
  END IF;

  RETURN json_build_object('success', true);
END;
$$;
