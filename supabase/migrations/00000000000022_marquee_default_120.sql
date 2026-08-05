-- Set global marquee ticker speed to a constant 120s cycle by default and
-- allow slower speeds (up to 600s) for shops that want an even slower ticker.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'marquee_settings'
  ) THEN
    ALTER TABLE public.marquee_settings
      ALTER COLUMN speed_seconds SET DEFAULT 120;

    UPDATE public.marquee_settings
      SET speed_seconds = 120
      WHERE speed_seconds IS NULL OR speed_seconds < 10 OR speed_seconds > 600;
  END IF;
END $$;
