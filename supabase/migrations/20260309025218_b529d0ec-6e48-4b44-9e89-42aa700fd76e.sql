
-- Create withdrawal request status type
CREATE TYPE public.withdrawal_status AS ENUM ('pending', 'approved', 'rejected');

-- Create withdrawal method type
CREATE TYPE public.withdrawal_method AS ENUM ('bank_transfer', 'paypal');

-- Create withdrawal_requests table
CREATE TABLE public.withdrawal_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  amount numeric NOT NULL,
  method withdrawal_method NOT NULL,
  -- Bank transfer fields
  bank_name text,
  account_number text,
  account_holder text,
  -- PayPal fields
  paypal_email text,
  -- Status
  status withdrawal_status NOT NULL DEFAULT 'pending',
  admin_notes text,
  reviewed_by uuid,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.withdrawal_requests ENABLE ROW LEVEL SECURITY;

-- Users can view their own withdrawal requests
CREATE POLICY "Users can view their own withdrawals"
  ON public.withdrawal_requests FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Users can insert their own withdrawal requests
CREATE POLICY "Users can create withdrawals"
  ON public.withdrawal_requests FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Admins can view all withdrawal requests
CREATE POLICY "Admins can view all withdrawals"
  ON public.withdrawal_requests FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Admins can update withdrawal requests
CREATE POLICY "Admins can update withdrawals"
  ON public.withdrawal_requests FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- RPC to submit a withdrawal request with validations
CREATE OR REPLACE FUNCTION public.request_withdrawal(
  p_user_id uuid,
  p_amount numeric,
  p_method withdrawal_method,
  p_bank_name text DEFAULT NULL,
  p_account_number text DEFAULT NULL,
  p_account_holder text DEFAULT NULL,
  p_paypal_email text DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_balance numeric;
  v_is_blocked boolean;
  v_document_status text;
  v_is_age_verified boolean;
  v_pending_count integer;
BEGIN
  -- Validate caller
  IF p_user_id != auth.uid() THEN
    RETURN json_build_object('success', false, 'error', 'No autorizado');
  END IF;

  -- Minimum amount
  IF p_amount < 50 THEN
    RETURN json_build_object('success', false, 'error', 'El monto mínimo de retiro es $50');
  END IF;

  -- Get user info
  SELECT balance, is_blocked, document_status, is_age_verified
  INTO v_balance, v_is_blocked, v_document_status, v_is_age_verified
  FROM profiles WHERE id = p_user_id FOR UPDATE;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Usuario no encontrado');
  END IF;

  IF v_is_blocked THEN
    RETURN json_build_object('success', false, 'error', 'Tu cuenta está bloqueada');
  END IF;

  -- Check identity verification
  IF v_document_status IS NULL OR v_document_status != 'approved' THEN
    RETURN json_build_object('success', false, 'error', 'Debes tener tu identidad verificada y aprobada para solicitar un retiro');
  END IF;

  IF NOT COALESCE(v_is_age_verified, false) THEN
    RETURN json_build_object('success', false, 'error', 'Debes confirmar que eres mayor de 18 años');
  END IF;

  -- Check balance
  IF v_balance < p_amount THEN
    RETURN json_build_object('success', false, 'error', 'Saldo insuficiente');
  END IF;

  -- Check no pending withdrawals
  SELECT COUNT(*) INTO v_pending_count
  FROM withdrawal_requests
  WHERE user_id = p_user_id AND status = 'pending';

  IF v_pending_count > 0 THEN
    RETURN json_build_object('success', false, 'error', 'Ya tienes una solicitud de retiro pendiente');
  END IF;

  -- Validate method-specific fields
  IF p_method = 'bank_transfer' THEN
    IF p_bank_name IS NULL OR p_account_number IS NULL OR p_account_holder IS NULL THEN
      RETURN json_build_object('success', false, 'error', 'Completa todos los datos bancarios');
    END IF;
  ELSIF p_method = 'paypal' THEN
    IF p_paypal_email IS NULL OR p_paypal_email = '' THEN
      RETURN json_build_object('success', false, 'error', 'Ingresa tu correo de PayPal');
    END IF;
  END IF;

  -- Deduct balance
  UPDATE profiles SET balance = balance - p_amount WHERE id = p_user_id;

  -- Record transaction
  INSERT INTO transactions (user_id, type, amount, description)
  VALUES (p_user_id, 'withdrawal', -p_amount, 'Solicitud de retiro (' || p_method || ')');

  -- Create request
  INSERT INTO withdrawal_requests (user_id, amount, method, bank_name, account_number, account_holder, paypal_email)
  VALUES (p_user_id, p_amount, p_method, p_bank_name, p_account_number, p_account_holder, p_paypal_email);

  RETURN json_build_object('success', true);
END;
$$;

-- RPC to process a withdrawal (admin approve/reject)
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

  ELSIF p_action = 'reject' THEN
    -- Refund balance
    UPDATE profiles SET balance = balance + v_request.amount WHERE id = v_request.user_id;

    -- Record refund transaction
    INSERT INTO transactions (user_id, type, amount, description)
    VALUES (v_request.user_id, 'withdrawal_refund', v_request.amount, 'Retiro rechazado - fondos devueltos');

    UPDATE withdrawal_requests
    SET status = 'rejected', admin_notes = p_admin_notes, reviewed_by = auth.uid(), reviewed_at = now(), updated_at = now()
    WHERE id = p_withdrawal_id;
  ELSE
    RETURN json_build_object('success', false, 'error', 'Acción no válida');
  END IF;

  RETURN json_build_object('success', true);
END;
$$;
