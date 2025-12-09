-- Create market_options table for multiple options per market
CREATE TABLE public.market_options (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  market_id UUID NOT NULL REFERENCES public.markets(id) ON DELETE CASCADE,
  option_name TEXT NOT NULL,
  total_amount NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.market_options ENABLE ROW LEVEL SECURITY;

-- Anyone can view options for active markets
CREATE POLICY "Anyone can view market options"
ON public.market_options
FOR SELECT
USING (true);

-- Admins can manage options
CREATE POLICY "Admins can insert options"
ON public.market_options
FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update options"
ON public.market_options
FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete options"
ON public.market_options
FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));

-- Create index for faster lookups
CREATE INDEX idx_market_options_market_id ON public.market_options(market_id);