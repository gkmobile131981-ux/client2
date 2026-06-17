-- Migration: Enable Realtime for table public.repairs
-- Supabase creates the publication 'supabase_realtime' automatically.
-- This script safely checks and registers the 'repairs' table if not already added.

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime'
    ) THEN
        IF NOT EXISTS (
            SELECT 1 FROM pg_publication_rel pr
            JOIN pg_class c ON pr.prrelid = c.oid
            JOIN pg_namespace n ON c.relnamespace = n.oid
            WHERE pr.prpubid = (SELECT oid FROM pg_publication WHERE pubname = 'supabase_realtime')
              AND c.relname = 'repairs'
              AND n.nspname = 'public'
        ) THEN
            ALTER PUBLICATION supabase_realtime ADD TABLE public.repairs;
        END IF;
    END IF;
END $$;
