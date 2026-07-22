-- Migration: Create monthly_subscriptions table for tracking member subscription payments

CREATE TABLE IF NOT EXISTS public.monthly_subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shop_id UUID REFERENCES public.shops(id) ON DELETE CASCADE,
    customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
    customer_name TEXT NOT NULL,
    phone_number TEXT NOT NULL,
    shop_name TEXT,
    year INTEGER NOT NULL DEFAULT EXTRACT(YEAR FROM CURRENT_DATE),
    january NUMERIC(10, 2) NOT NULL DEFAULT 0,
    february NUMERIC(10, 2) NOT NULL DEFAULT 0,
    march NUMERIC(10, 2) NOT NULL DEFAULT 0,
    april NUMERIC(10, 2) NOT NULL DEFAULT 0,
    may NUMERIC(10, 2) NOT NULL DEFAULT 0,
    june NUMERIC(10, 2) NOT NULL DEFAULT 0,
    july NUMERIC(10, 2) NOT NULL DEFAULT 0,
    august NUMERIC(10, 2) NOT NULL DEFAULT 0,
    september NUMERIC(10, 2) NOT NULL DEFAULT 0,
    october NUMERIC(10, 2) NOT NULL DEFAULT 0,
    november NUMERIC(10, 2) NOT NULL DEFAULT 0,
    december NUMERIC(10, 2) NOT NULL DEFAULT 0,
    total_received NUMERIC(10, 2) NOT NULL DEFAULT 0,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for efficient lookup
CREATE INDEX IF NOT EXISTS idx_monthly_subscriptions_phone ON public.monthly_subscriptions(phone_number);
CREATE INDEX IF NOT EXISTS idx_monthly_subscriptions_year ON public.monthly_subscriptions(year);
CREATE INDEX IF NOT EXISTS idx_monthly_subscriptions_shop ON public.monthly_subscriptions(shop_id);

-- Alter table to add payment date columns if they do not exist
ALTER TABLE public.monthly_subscriptions ADD COLUMN IF NOT EXISTS january_paid_at DATE;
ALTER TABLE public.monthly_subscriptions ADD COLUMN IF NOT EXISTS february_paid_at DATE;
ALTER TABLE public.monthly_subscriptions ADD COLUMN IF NOT EXISTS march_paid_at DATE;
ALTER TABLE public.monthly_subscriptions ADD COLUMN IF NOT EXISTS april_paid_at DATE;
ALTER TABLE public.monthly_subscriptions ADD COLUMN IF NOT EXISTS may_paid_at DATE;
ALTER TABLE public.monthly_subscriptions ADD COLUMN IF NOT EXISTS june_paid_at DATE;
ALTER TABLE public.monthly_subscriptions ADD COLUMN IF NOT EXISTS july_paid_at DATE;
ALTER TABLE public.monthly_subscriptions ADD COLUMN IF NOT EXISTS august_paid_at DATE;
ALTER TABLE public.monthly_subscriptions ADD COLUMN IF NOT EXISTS september_paid_at DATE;
ALTER TABLE public.monthly_subscriptions ADD COLUMN IF NOT EXISTS october_paid_at DATE;
ALTER TABLE public.monthly_subscriptions ADD COLUMN IF NOT EXISTS november_paid_at DATE;
ALTER TABLE public.monthly_subscriptions ADD COLUMN IF NOT EXISTS december_paid_at DATE;
