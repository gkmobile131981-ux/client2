-- ============================================================
-- Migration 010: Carousel Slide Manager & Owner ID Card Fields
-- ============================================================

-- 1. Create carousel_slides table
CREATE TABLE IF NOT EXISTS public.carousel_slides (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    title text NOT NULL,
    description text NOT NULL,
    image_url text,
    created_at timestamptz NOT NULL DEFAULT now()
);

-- Seed default slides so the carousel is populated automatically
INSERT INTO public.carousel_slides (title, description, image_url)
VALUES 
  (
    'Boost Shop Operations & Pick-up Speed',
    'Utilize status filters to quickly identify device statuses. Proactively follow up on ''Ready'' jobs to speed up customer collection and minimize workspace load.',
    NULL
  ),
  (
    'Original (OG) vs Copy (Ditto) Rates',
    'Double column service rates are live! Inform customers of warranty and performance differences between Original and Copy parts to secure higher satisfaction.',
    NULL
  ),
  (
    'Confirm Device Security & Signatures',
    'Protect client privacy. Make sure you lock the device with pattern patterns, complete full KYC front/back images, and capture picker signatures on delivery.',
    NULL
  );

-- 2. Alter public.users table to add ID Card fields
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS home_address text;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS blood_group text;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS dob text;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS personal_phone text;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS aadhar_number text;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS photo_url text;

-- 3. Enable RLS on carousel_slides
ALTER TABLE public.carousel_slides ENABLE ROW LEVEL SECURITY;

CREATE POLICY carousel_slides_select ON public.carousel_slides
    FOR SELECT TO authenticated
    USING (true);

CREATE POLICY carousel_slides_admin ON public.carousel_slides
    FOR ALL TO authenticated
    USING (public.get_auth_user_role() = 'owner')
    WITH CHECK (public.get_auth_user_role() = 'owner');

-- 4. Create public storage buckets
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES 
  ('carousel-images', 'carousel-images', true, 5242880, ARRAY['image/jpeg', 'image/png', 'image/webp']),
  ('owner-photos', 'owner-photos', true, 2097152, ARRAY['image/jpeg', 'image/png', 'image/webp'])
ON CONFLICT (id) DO UPDATE 
SET 
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Storage Policies for carousel-images
CREATE POLICY "Allow public read of carousel images" ON storage.objects
  FOR SELECT TO public
  USING (bucket_id = 'carousel-images');

CREATE POLICY "Allow admin full access to carousel images" ON storage.objects
  FOR ALL TO authenticated
  USING (bucket_id = 'carousel-images' AND public.get_auth_user_role() = 'owner')
  WITH CHECK (bucket_id = 'carousel-images' AND public.get_auth_user_role() = 'owner');

-- Storage Policies for owner-photos
CREATE POLICY "Allow public read of owner photos" ON storage.objects
  FOR SELECT TO public
  USING (bucket_id = 'owner-photos');

CREATE POLICY "Allow admin full access to owner photos" ON storage.objects
  FOR ALL TO authenticated
  USING (bucket_id = 'owner-photos' AND (id = auth.uid() OR public.get_auth_user_role() = 'owner'))
  WITH CHECK (bucket_id = 'owner-photos' AND (id = auth.uid() OR public.get_auth_user_role() = 'owner'));
