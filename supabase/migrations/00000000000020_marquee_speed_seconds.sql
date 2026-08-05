-- Add marquee scroll speed control (seconds per full cycle) to global marquee settings
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'marquee_settings'
  ) THEN
    ALTER TABLE public.marquee_settings
      ADD COLUMN IF NOT EXISTS speed_seconds numeric(10,2);
  END IF;
END $$;
