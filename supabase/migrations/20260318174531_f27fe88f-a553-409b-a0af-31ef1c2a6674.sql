
ALTER TABLE public.market_comments 
ADD COLUMN parent_id uuid REFERENCES public.market_comments(id) ON DELETE CASCADE DEFAULT NULL;

CREATE INDEX idx_market_comments_parent_id ON public.market_comments(parent_id);
