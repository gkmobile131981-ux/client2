-- Performance indexes to resolve slow load times on all pages
CREATE INDEX IF NOT EXISTS idx_repairs_shop_id ON public.repairs(shop_id);
CREATE INDEX IF NOT EXISTS idx_repairs_device_id ON public.repairs(device_id);
CREATE INDEX IF NOT EXISTS idx_repairs_created_at ON public.repairs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_devices_customer_id ON public.devices(customer_id);
CREATE INDEX IF NOT EXISTS idx_customers_shop_id ON public.customers(shop_id);
CREATE INDEX IF NOT EXISTS idx_monthly_subscriptions_shop_id_year ON public.monthly_subscriptions(shop_id, year);
CREATE INDEX IF NOT EXISTS idx_subscription_members_shop_id ON public.subscription_members(shop_id);
CREATE INDEX IF NOT EXISTS idx_repair_services_repair_id ON public.repair_services(repair_id);
CREATE INDEX IF NOT EXISTS idx_repair_history_repair_id ON public.repair_history(repair_id);
