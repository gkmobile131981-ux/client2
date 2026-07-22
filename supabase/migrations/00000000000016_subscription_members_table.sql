-- Migration: Create subscription_members table for managing registered shop members
CREATE TABLE IF NOT EXISTS public.subscription_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shop_id UUID REFERENCES public.shops(id) ON DELETE CASCADE,
    member_name TEXT NOT NULL,
    phone_number TEXT NOT NULL,
    shop_name TEXT NOT NULL,
    address TEXT,
    notes TEXT,
    subscription_start_date DATE NOT NULL DEFAULT CURRENT_DATE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for efficient lookup
CREATE INDEX IF NOT EXISTS idx_sub_members_phone ON public.subscription_members(phone_number);
CREATE INDEX IF NOT EXISTS idx_sub_members_shop ON public.subscription_members(shop_id);
