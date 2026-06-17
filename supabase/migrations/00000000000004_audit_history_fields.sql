-- Migration: Add generic audit values to repair_history and update the status trigger
ALTER TABLE public.repair_history 
ADD COLUMN IF NOT EXISTS old_value text,
ADD COLUMN IF NOT EXISTS new_value text;

-- Update the status change logger trigger function
CREATE OR REPLACE FUNCTION public.log_repair_status_change()
RETURNS trigger AS $$
BEGIN
    IF OLD.status IS DISTINCT FROM NEW.status THEN
        INSERT INTO public.repair_history (
            repair_id, 
            changed_by, 
            old_status, 
            new_status, 
            note, 
            created_at, 
            old_value, 
            new_value
        )
        VALUES (
            NEW.id,
            auth.uid(),
            OLD.status,
            NEW.status,
            coalesce(NEW.notes, 'Status updated'),
            now(),
            OLD.status,
            NEW.status
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
