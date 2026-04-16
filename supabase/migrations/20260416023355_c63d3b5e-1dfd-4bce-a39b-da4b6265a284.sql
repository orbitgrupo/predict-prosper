-- Add favorite option support to markets
ALTER TABLE public.markets
ADD COLUMN favorite_option text DEFAULT NULL,
ADD COLUMN favorite_probability numeric DEFAULT 50;
