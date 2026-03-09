ALTER TABLE public.profiles ADD COLUMN accepted_terms boolean NOT NULL DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN accepted_terms_at timestamp with time zone;