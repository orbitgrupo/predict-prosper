-- Remove legacy check constraint that only allowed 'yes'/'no' options
-- Markets now support arbitrary option names stored in public.market_options
ALTER TABLE public.bets
DROP CONSTRAINT IF EXISTS bets_option_check;