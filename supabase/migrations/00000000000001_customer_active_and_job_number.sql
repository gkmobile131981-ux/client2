-- Add is_active flag to customers table to support soft delete
ALTER TABLE public.customers 
ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;

-- Function to atomically generate sequential GK-YYYYMMDD-XXX job numbers per shop
CREATE OR REPLACE FUNCTION public.generate_job_number(p_shop_id uuid)
RETURNS text AS $$
DECLARE
  v_today text;
  v_count integer;
  v_job_number text;
BEGIN
  -- Lock the shop row to serialize sequence generation for this shop, avoiding simultaneous conflict locks
  PERFORM 1 FROM public.shops WHERE id = p_shop_id FOR UPDATE;

  -- Get current date format: YYYYMMDD
  v_today := to_char(now(), 'YYYYMMDD');
  
  -- Query count of repairs created today for this shop
  SELECT count(*) INTO v_count 
  FROM public.repairs 
  WHERE shop_id = p_shop_id 
    AND to_char(created_at, 'YYYYMMDD') = v_today;
    
  -- Generate sequence string
  v_job_number := 'GK-' || v_today || '-' || lpad((v_count + 1)::text, 3, '0');
  
  RETURN v_job_number;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
