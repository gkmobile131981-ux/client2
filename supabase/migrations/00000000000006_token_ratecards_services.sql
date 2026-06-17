-- ============================================================
-- Migration 006: Token Number, Rate Cards, Repair Services
-- ============================================================

-- 1. Add token_number to repairs table
ALTER TABLE public.repairs
ADD COLUMN IF NOT EXISTS token_number TEXT;

-- 2. Function to generate per-customer token numbers (C-0001 format)
--    Each customer's devices get numbered sequentially: C-0001, C-0002, ...
CREATE OR REPLACE FUNCTION public.generate_token_number(p_customer_id uuid)
RETURNS text AS $$
DECLARE
  v_count integer;
  v_token text;
BEGIN
  -- Lock the customer row to serialize token generation
  PERFORM 1 FROM public.customers WHERE id = p_customer_id FOR UPDATE;

  -- Count all repairs ever created for this customer's devices
  SELECT count(*) INTO v_count
  FROM public.repairs r
  JOIN public.devices d ON d.id = r.device_id
  WHERE d.customer_id = p_customer_id;

  -- Generate token: C-0001, C-0002, ...
  v_token := 'C-' || lpad((v_count + 1)::text, 4, '0');

  RETURN v_token;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Rate Cards table (device model catalogue per shop)
CREATE TABLE IF NOT EXISTS public.rate_cards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id uuid NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  brand text NOT NULL,
  model text NOT NULL,
  model_image_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(shop_id, brand, model)
);

-- 4. Rate Card Services (individual repair types per model)
CREATE TABLE IF NOT EXISTS public.rate_card_services (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rate_card_id uuid NOT NULL REFERENCES public.rate_cards(id) ON DELETE CASCADE,
  service_name text NOT NULL,
  labor_cost numeric(10,2) NOT NULL DEFAULT 0,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 5. Repair Services (selected services on a specific repair ticket)
CREATE TABLE IF NOT EXISTS public.repair_services (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  repair_id uuid NOT NULL REFERENCES public.repairs(id) ON DELETE CASCADE,
  service_name text NOT NULL,
  labor_cost numeric(10,2) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 6. RLS for rate_cards
ALTER TABLE public.rate_cards ENABLE ROW LEVEL SECURITY;

CREATE POLICY rate_cards_owner_all ON public.rate_cards
  FOR ALL TO authenticated
  USING (
    shop_id = public.get_auth_user_shop_id()
    AND public.get_auth_user_role() = 'owner'
  )
  WITH CHECK (
    shop_id = public.get_auth_user_shop_id()
    AND public.get_auth_user_role() = 'owner'
  );

CREATE POLICY rate_cards_staff_select ON public.rate_cards
  FOR SELECT TO authenticated
  USING (
    shop_id = public.get_auth_user_shop_id()
    AND public.get_auth_user_role() = 'staff'
  );

-- 7. RLS for rate_card_services
ALTER TABLE public.rate_card_services ENABLE ROW LEVEL SECURITY;

CREATE POLICY rcs_owner_all ON public.rate_card_services
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.rate_cards rc
      WHERE rc.id = public.rate_card_services.rate_card_id
        AND rc.shop_id = public.get_auth_user_shop_id()
        AND public.get_auth_user_role() = 'owner'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.rate_cards rc
      WHERE rc.id = public.rate_card_services.rate_card_id
        AND rc.shop_id = public.get_auth_user_shop_id()
        AND public.get_auth_user_role() = 'owner'
    )
  );

CREATE POLICY rcs_staff_select ON public.rate_card_services
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.rate_cards rc
      WHERE rc.id = public.rate_card_services.rate_card_id
        AND rc.shop_id = public.get_auth_user_shop_id()
    )
  );

-- 8. RLS for repair_services
ALTER TABLE public.repair_services ENABLE ROW LEVEL SECURITY;

CREATE POLICY repair_services_owner_all ON public.repair_services
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.repairs r
      WHERE r.id = public.repair_services.repair_id
        AND r.shop_id = public.get_auth_user_shop_id()
        AND public.get_auth_user_role() = 'owner'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.repairs r
      WHERE r.id = public.repair_services.repair_id
        AND r.shop_id = public.get_auth_user_shop_id()
        AND public.get_auth_user_role() = 'owner'
    )
  );

CREATE POLICY repair_services_staff_select ON public.repair_services
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.repairs r
      WHERE r.id = public.repair_services.repair_id
        AND r.staff_id = auth.uid()
    )
  );

CREATE POLICY repair_services_staff_insert ON public.repair_services
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.repairs r
      WHERE r.id = public.repair_services.repair_id
        AND r.shop_id = public.get_auth_user_shop_id()
    )
  );

-- 9. Storage bucket for rate card device images (public read so images load without auth)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('rate-card-images', 'rate-card-images', true, 2097152, ARRAY['image/jpeg', 'image/png', 'image/webp'])
ON CONFLICT (id) DO UPDATE
SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

CREATE POLICY "Allow owners to upload rate card images" ON storage.objects
  FOR ALL TO authenticated
  USING (bucket_id = 'rate-card-images' AND public.get_auth_user_role() = 'owner')
  WITH CHECK (bucket_id = 'rate-card-images' AND public.get_auth_user_role() = 'owner');

CREATE POLICY "Allow public read of rate card images" ON storage.objects
  FOR SELECT TO public
  USING (bucket_id = 'rate-card-images');
