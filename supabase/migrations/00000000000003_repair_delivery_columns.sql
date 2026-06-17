-- Migration: Add delivery columns to repairs table
ALTER TABLE public.repairs 
ADD COLUMN IF NOT EXISTS receiver_name text,
ADD COLUMN IF NOT EXISTS receiver_phone text,
ADD COLUMN IF NOT EXISTS receiver_photo_url text,
ADD COLUMN IF NOT EXISTS signature_url text,
ADD COLUMN IF NOT EXISTS delivered_at timestamptz;
