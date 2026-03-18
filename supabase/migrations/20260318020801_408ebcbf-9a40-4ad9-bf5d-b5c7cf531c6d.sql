
-- Create market_comments table
CREATE TABLE public.market_comments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  market_id UUID NOT NULL REFERENCES public.markets(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_market_comments_market_id ON public.market_comments(market_id);
CREATE INDEX idx_market_comments_created_at ON public.market_comments(created_at DESC);

-- Enable RLS
ALTER TABLE public.market_comments ENABLE ROW LEVEL SECURITY;

-- Anyone authenticated can read comments
CREATE POLICY "Anyone can view comments"
ON public.market_comments FOR SELECT
TO authenticated
USING (true);

-- Users can create their own comments
CREATE POLICY "Users can create comments"
ON public.market_comments FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Users can delete their own comments
CREATE POLICY "Users can delete own comments"
ON public.market_comments FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- Admins can delete any comment
CREATE POLICY "Admins can delete any comment"
ON public.market_comments FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.market_comments;
