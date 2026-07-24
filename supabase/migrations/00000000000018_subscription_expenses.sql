-- Migration: Create monthly_subscription_expenses table
CREATE TABLE IF NOT EXISTS public.monthly_subscription_expenses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shop_id UUID REFERENCES public.shops(id) ON DELETE CASCADE,
    year INTEGER NOT NULL,
    month TEXT NOT NULL,
    amount_taken NUMERIC(10, 2) NOT NULL DEFAULT 0,
    total_received NUMERIC(10, 2) NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(shop_id, year, month)
);

-- Index for efficient lookup
CREATE INDEX IF NOT EXISTS idx_sub_expenses_lookup ON public.monthly_subscription_expenses(shop_id, year);

-- Enable RLS
ALTER TABLE public.monthly_subscription_expenses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all authenticated users to select expenses" ON public.monthly_subscription_expenses
    FOR SELECT TO authenticated
    USING (shop_id = public.get_auth_user_shop_id());

CREATE POLICY "Allow owners/admins to insert/update/delete expenses" ON public.monthly_subscription_expenses
    FOR ALL TO authenticated
    USING (
        shop_id = public.get_auth_user_shop_id()
    )
    WITH CHECK (
        shop_id = public.get_auth_user_shop_id()
    );
