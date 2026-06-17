-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Create tables with basic fields first to resolve cross-references

-- Create users table (references auth.users)
CREATE TABLE public.users (
    id uuid PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
    name text NOT NULL,
    role text NOT NULL CHECK (role IN ('owner', 'staff')),
    staff_id text UNIQUE,
    shop_id uuid, -- will add FK reference after shops table is created
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now()
);

-- Create shops table
CREATE TABLE public.shops (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL,
    logo_url text,
    address text,
    phone text,
    owner_id uuid NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT
);

-- Add foreign key constraint to users for shop_id
ALTER TABLE public.users 
ADD CONSTRAINT fk_users_shop FOREIGN KEY (shop_id) REFERENCES public.shops(id) ON DELETE SET NULL;

-- Create customers table
CREATE TABLE public.customers (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    shop_id uuid NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
    name text NOT NULL,
    phone text UNIQUE NOT NULL,
    address text,
    photo_url text,
    created_at timestamptz NOT NULL DEFAULT now()
);

-- Create devices table
CREATE TABLE public.devices (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
    brand text NOT NULL,
    model text NOT NULL,
    imei text,
    problem text NOT NULL,
    quality text,
    physical_damage text,
    front_photo_url text,
    back_photo_url text
);

-- Create repairs table
CREATE TABLE public.repairs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    job_number text UNIQUE NOT NULL,
    device_id uuid NOT NULL REFERENCES public.devices(id) ON DELETE CASCADE,
    shop_id uuid NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
    estimate numeric(10,2) NOT NULL DEFAULT 0.00,
    advance numeric(10,2) NOT NULL DEFAULT 0.00,
    balance numeric(10,2) GENERATED ALWAYS AS (estimate - advance) STORED,
    status text NOT NULL CHECK (status IN ('pending', 'repairing', 'ready', 'delivered', 'cancelled')) DEFAULT 'pending',
    delivery_date date,
    staff_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
    created_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
    updated_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
    notes text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

-- Create repair_history table
CREATE TABLE public.repair_history (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    repair_id uuid NOT NULL REFERENCES public.repairs(id) ON DELETE CASCADE,
    changed_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
    old_status text NOT NULL,
    new_status text NOT NULL,
    note text,
    created_at timestamptz NOT NULL DEFAULT now()
);

-- 2. Create Security Definer functions to avoid policy recursion

CREATE OR REPLACE FUNCTION public.get_auth_user_role()
RETURNS text AS $$
    SELECT role FROM public.users WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.get_auth_user_shop_id()
RETURNS uuid AS $$
    SELECT shop_id FROM public.users WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER;

-- 3. Row Level Security (RLS) Setup

-- Enable RLS for all tables
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shops ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.repairs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.repair_history ENABLE ROW LEVEL SECURITY;

-- USERS Table Policies
CREATE POLICY users_select_own ON public.users
    FOR SELECT TO authenticated
    USING (id = auth.uid());

CREATE POLICY users_owner_all ON public.users
    FOR ALL TO authenticated
    USING (public.get_auth_user_role() = 'owner' AND shop_id = public.get_auth_user_shop_id())
    WITH CHECK (public.get_auth_user_role() = 'owner' AND shop_id = public.get_auth_user_shop_id());

-- SHOPS Table Policies
CREATE POLICY shops_staff_select ON public.shops
    FOR SELECT TO authenticated
    USING (id = public.get_auth_user_shop_id());

CREATE POLICY shops_owner_all ON public.shops
    FOR ALL TO authenticated
    USING (public.get_auth_user_role() = 'owner' AND id = public.get_auth_user_shop_id())
    WITH CHECK (public.get_auth_user_role() = 'owner' AND id = public.get_auth_user_shop_id());

-- CUSTOMERS Table Policies
CREATE POLICY customers_owner_all ON public.customers
    FOR ALL TO authenticated
    USING (public.get_auth_user_role() = 'owner' AND shop_id = public.get_auth_user_shop_id())
    WITH CHECK (public.get_auth_user_role() = 'owner' AND shop_id = public.get_auth_user_shop_id());

CREATE POLICY customers_staff_select ON public.customers
    FOR SELECT TO authenticated
    USING (public.get_auth_user_role() = 'staff' AND shop_id = public.get_auth_user_shop_id());

-- DEVICES Table Policies
CREATE POLICY devices_owner_all ON public.devices
    FOR ALL TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.customers 
            WHERE public.customers.id = public.devices.customer_id 
            AND public.customers.shop_id = public.get_auth_user_shop_id()
        ) AND public.get_auth_user_role() = 'owner'
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.customers 
            WHERE public.customers.id = public.devices.customer_id 
            AND public.customers.shop_id = public.get_auth_user_shop_id()
        ) AND public.get_auth_user_role() = 'owner'
    );

CREATE POLICY devices_staff_select ON public.devices
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.customers 
            WHERE public.customers.id = public.devices.customer_id 
            AND public.customers.shop_id = public.get_auth_user_shop_id()
        ) AND public.get_auth_user_role() = 'staff'
    );

-- REPAIRS Table Policies
CREATE POLICY repairs_owner_all ON public.repairs
    FOR ALL TO authenticated
    USING (public.get_auth_user_role() = 'owner' AND shop_id = public.get_auth_user_shop_id())
    WITH CHECK (public.get_auth_user_role() = 'owner' AND shop_id = public.get_auth_user_shop_id());

CREATE POLICY repairs_staff_select ON public.repairs
    FOR SELECT TO authenticated
    USING (public.get_auth_user_role() = 'staff' AND staff_id = auth.uid());

CREATE POLICY repairs_staff_update ON public.repairs
    FOR UPDATE TO authenticated
    USING (public.get_auth_user_role() = 'staff' AND staff_id = auth.uid())
    WITH CHECK (public.get_auth_user_role() = 'staff' AND staff_id = auth.uid());

-- REPAIR_HISTORY Table Policies
CREATE POLICY history_owner_all ON public.repair_history
    FOR ALL TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.repairs 
            WHERE public.repairs.id = public.repair_history.repair_id 
            AND public.repairs.shop_id = public.get_auth_user_shop_id()
        ) AND public.get_auth_user_role() = 'owner'
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.repairs 
            WHERE public.repairs.id = public.repair_history.repair_id 
            AND public.repairs.shop_id = public.get_auth_user_shop_id()
        ) AND public.get_auth_user_role() = 'owner'
    );

CREATE POLICY history_staff_select ON public.repair_history
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.repairs 
            WHERE public.repairs.id = public.repair_history.repair_id 
            AND public.repairs.staff_id = auth.uid()
        ) AND public.get_auth_user_role() = 'staff'
    );

-- 4. Triggers

-- Trigger to automatically sync auth.users to public.users on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
    INSERT INTO public.users (id, name, role, staff_id, shop_id, is_active, created_at)
    VALUES (
        new.id,
        coalesce(new.raw_user_meta_data->>'name', 'New User'),
        coalesce(new.raw_user_meta_data->>'role', 'staff'),
        new.raw_user_meta_data->>'staff_id',
        (new.raw_user_meta_data->>'shop_id')::uuid,
        true,
        now()
    );
    RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Trigger to restrict staff updates to only status and notes (no financials)
CREATE OR REPLACE FUNCTION public.enforce_repair_update_rules()
RETURNS trigger AS $$
BEGIN
    IF public.get_auth_user_role() = 'staff' THEN
        -- Check if financials or identifying columns were modified
        IF OLD.estimate IS DISTINCT FROM NEW.estimate OR
           OLD.advance IS DISTINCT FROM NEW.advance OR
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

CREATE TRIGGER tr_enforce_repair_update_rules
    BEFORE UPDATE ON public.repairs
    FOR EACH ROW EXECUTE FUNCTION public.enforce_repair_update_rules();

-- Trigger to automatically log repair status history changes
CREATE OR REPLACE FUNCTION public.log_repair_status_change()
RETURNS trigger AS $$
BEGIN
    IF OLD.status IS DISTINCT FROM NEW.status THEN
        INSERT INTO public.repair_history (repair_id, changed_by, old_status, new_status, note, created_at)
        VALUES (
            NEW.id,
            auth.uid(),
            OLD.status,
            NEW.status,
            coalesce(NEW.notes, 'Status updated'),
            now()
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER tr_log_repair_status_change
    AFTER UPDATE ON public.repairs
    FOR EACH ROW EXECUTE FUNCTION public.log_repair_status_change();

-- 5. Storage Buckets Config

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES 
  ('device-photos', 'device-photos', false, 5242880, ARRAY['image/jpeg', 'image/png', 'image/webp']),
  ('customer-photos', 'customer-photos', false, 2097152, ARRAY['image/jpeg', 'image/png', 'image/webp']),
  ('shop-logos', 'shop-logos', true, 1048576, ARRAY['image/jpeg', 'image/png', 'image/webp']),
  ('delivery-photos', 'delivery-photos', false, 5242880, ARRAY['image/jpeg', 'image/png', 'image/webp'])
ON CONFLICT (id) DO UPDATE 
SET 
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Storage Policies
CREATE POLICY "Allow owners full access to shop-logos" ON storage.objects
  FOR ALL TO authenticated
  USING (bucket_id = 'shop-logos' AND public.get_auth_user_role() = 'owner')
  WITH CHECK (bucket_id = 'shop-logos' AND public.get_auth_user_role() = 'owner');

CREATE POLICY "Allow public read to shop-logos" ON storage.objects
  FOR SELECT TO public
  USING (bucket_id = 'shop-logos');

CREATE POLICY "Allow owner full access to private buckets" ON storage.objects
  FOR ALL TO authenticated
  USING (
    bucket_id IN ('device-photos', 'customer-photos', 'delivery-photos') 
    AND public.get_auth_user_role() = 'owner'
  )
  WITH CHECK (
    bucket_id IN ('device-photos', 'customer-photos', 'delivery-photos') 
    AND public.get_auth_user_role() = 'owner'
  );

CREATE POLICY "Allow staff full access to private buckets" ON storage.objects
  FOR ALL TO authenticated
  USING (
    bucket_id IN ('device-photos', 'customer-photos', 'delivery-photos') 
    AND public.get_auth_user_role() = 'staff'
  )
  WITH CHECK (
    bucket_id IN ('device-photos', 'customer-photos', 'delivery-photos') 
    AND public.get_auth_user_role() = 'staff'
  );
