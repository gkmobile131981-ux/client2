-- Backfill global marquee ticker speed to a slow, constant 40s cycle so
-- all shops see the same readable pace without needing to re-save settings.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'marquee_settings'
  ) THEN
    ALTER TABLE public.marquee_settings
      ALTER COLUMN speed_seconds SET DEFAULT 40;

    UPDATE public.marquee_settings
      SET speed_seconds = 40
      WHERE speed_seconds IS NULL OR speed_seconds < 10 OR speed_seconds > 120;
  END IF;
END $$;
