-- Add location coordinates to institutions table
ALTER TABLE public.institutions ADD COLUMN IF NOT EXISTS latitude numeric(10,6);
ALTER TABLE public.institutions ADD COLUMN IF NOT EXISTS longitude numeric(10,6);
