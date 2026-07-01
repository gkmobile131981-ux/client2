-- Migration: Add copy_cost column to rate_card_services table
ALTER TABLE public.rate_card_services 
ADD COLUMN IF NOT EXISTS copy_cost NUMERIC(10,2) NOT NULL DEFAULT 0;

-- Sync existing data: default copy_cost to ditto_cost to avoid blank records
UPDATE public.rate_card_services 
SET copy_cost = ditto_cost;
