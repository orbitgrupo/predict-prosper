-- Add image_url column to markets table
ALTER TABLE public.markets 
ADD COLUMN image_url text;