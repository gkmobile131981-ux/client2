-- Migration: Allow staff members to update advance (to collect remaining balance) when repair order status is transitioned to 'delivered'.
CREATE OR REPLACE FUNCTION public.enforce_repair_update_rules()
RETURNS trigger AS $$
BEGIN
    IF public.get_auth_user_role() = 'staff' THEN
        -- Check if financials or identifying columns were modified
        -- Note: We allow modifying advance ONLY when the status is transitioned to 'delivered' (e.g. during delivery handoff)
        IF OLD.estimate IS DISTINCT FROM NEW.estimate OR
           (OLD.advance IS DISTINCT FROM NEW.advance AND NEW.status IS DISTINCT FROM 'delivered') OR
           OLD.shop_id IS DISTINCT FROM NEW.shop_id OR
           OLD.device_id IS DISTINCT FROM NEW.device_id OR
           OLD.staff_id IS DISTINCT FROM NEW.staff_id OR
           OLD.job_number IS DISTINCT FROM NEW.job_number THEN
            RAISE EXCEPTION 'Staff are only permitted to update status and notes for repairs.';
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
