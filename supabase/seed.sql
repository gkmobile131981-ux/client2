-- Enable extensions needed for seeding
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 1. Insert seed data into auth.users (bypassing normal sign-up trigger to have specific test credentials)
-- In Local Supabase development, auth.users contains local mock accounts.
-- passwords are set to 'password123'
INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, raw_user_meta_data, aud, role, created_at, updated_at)
VALUES 
  ('b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22', 'owner@gkrepair.com', crypt('password123', gen_salt('bf')), now(), '{"name": "GK Owner", "role": "owner"}'::jsonb, 'authenticated', 'authenticated', now(), now()),
  ('c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a33', 'staff@gkrepair.com', crypt('password123', gen_salt('bf')), now(), '{"name": "GK Staff", "role": "staff", "staff_id": "STF-001"}'::jsonb, 'authenticated', 'authenticated', now(), now())
ON CONFLICT (id) DO NOTHING;

-- 2. Create the Shop
-- owner_id points to the Owner user
INSERT INTO public.shops (id, name, logo_url, address, phone, owner_id)
VALUES (
  'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 
  'GK Repair Shop Main', 
  'https://pub-logos.example.com/logo.png', 
  '123 Tech Avenue, Silicon Valley', 
  '+1234567890', 
  'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22'
)
ON CONFLICT (id) DO NOTHING;

-- 3. Update the Users with the Shop ID (now that the shop exists)
UPDATE public.users 
SET shop_id = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11' 
WHERE id IN ('b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22', 'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a33');

-- 4. Create Customers
INSERT INTO public.customers (id, shop_id, name, phone, address, photo_url, created_at)
VALUES 
  ('d0eebc99-9c0b-4ef8-bb6d-6bb9bd380a44', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'John Doe', '+1987654321', '456 Elm Street, San Jose', 'https://customer-photos.example.com/john.png', now()),
  ('d0eebc99-9c0b-4ef8-bb6d-6bb9bd380a55', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'Jane Smith', '+1555123456', '789 Oak Lane, Cupertino', NULL, now())
ON CONFLICT (id) DO NOTHING;

-- 5. Create Devices
INSERT INTO public.devices (id, customer_id, brand, model, imei, problem, quality, physical_damage, front_photo_url, back_photo_url)
VALUES 
  ('e0eebc99-9c0b-4ef8-bb6d-6bb9bd380a66', 'd0eebc99-9c0b-4ef8-bb6d-6bb9bd380a44', 'Apple', 'iPhone 15 Pro', '358239102938475', 'Cracked screen and swollen battery', 'OEM Grade', 'Shattered glass back and front screen', 'https://dev-photos.example.com/front.png', 'https://dev-photos.example.com/back.png'),
  ('e0eebc99-9c0b-4ef8-bb6d-6bb9bd380a77', 'd0eebc99-9c0b-4ef8-bb6d-6bb9bd380a55', 'Samsung', 'Galaxy S24 Ultra', '358239102938999', 'Water damage, won''t power on', 'Aftermarket Grade', 'Minor scratches on bezel', NULL, NULL)
ON CONFLICT (id) DO NOTHING;

-- 6. Create Repairs (estimate, advance, and generated balance column is automatically computed)
INSERT INTO public.repairs (id, job_number, device_id, shop_id, estimate, advance, status, delivery_date, staff_id, created_by, updated_by, notes, created_at, updated_at)
VALUES 
  ('f0eebc99-9c0b-4ef8-bb6d-6bb9bd380a88', 'JOB-2026-001', 'e0eebc99-9c0b-4ef8-bb6d-6bb9bd380a66', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 250.00, 50.00, 'pending', '2026-06-25', 'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a33', 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22', 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22', 'Ensure to use premium display panel.', now(), now()),
  ('f0eebc99-9c0b-4ef8-bb6d-6bb9bd380a99', 'JOB-2026-002', 'e0eebc99-9c0b-4ef8-bb6d-6bb9bd380a77', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 400.00, 100.00, 'repairing', '2026-06-28', 'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a33', 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22', 'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a33', 'Motherboard ultrasound cleaning needed.', now(), now())
ON CONFLICT (id) DO NOTHING;

-- 7. Create Repair History Records
INSERT INTO public.repair_history (repair_id, changed_by, old_status, new_status, note, created_at)
VALUES 
  ('f0eebc99-9c0b-4ef8-bb6d-6bb9bd380a88', 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22', 'pending', 'pending', 'Job created', now()),
  ('f0eebc99-9c0b-4ef8-bb6d-6bb9bd380a99', 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22', 'pending', 'repairing', 'Started diagnosis', now())
ON CONFLICT (id) DO NOTHING;
