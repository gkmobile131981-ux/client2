-- RPC 1: Fetch monthly revenue and ticket count summaries over the last 6 months
CREATE OR REPLACE FUNCTION public.get_monthly_revenue(
  p_shop_id uuid,
  p_staff_id uuid DEFAULT NULL
)
RETURNS TABLE (
  month text,
  revenue numeric,
  repairs_count bigint
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    to_char(created_at, 'YYYY-MM') AS month,
    coalesce(sum(estimate), 0)::numeric AS revenue,  -- sum of estimate fee representing revenue forecast
    count(*)::bigint AS repairs_count
  FROM public.repairs
  WHERE shop_id = p_shop_id
    AND (p_staff_id IS NULL OR staff_id = p_staff_id)
    AND created_at >= now() - interval '6 months'
  GROUP BY to_char(created_at, 'YYYY-MM')
  ORDER BY month ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RPC 2: Fetch count of repairs grouped by top device brands
CREATE OR REPLACE FUNCTION public.get_top_device_brands(
  p_shop_id uuid,
  p_staff_id uuid DEFAULT NULL
)
RETURNS TABLE (
  brand text,
  count bigint
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    d.brand,
    count(*)::bigint AS count
  FROM public.repairs r
  JOIN public.devices d ON r.device_id = d.id
  WHERE r.shop_id = p_shop_id
    AND (p_staff_id IS NULL OR r.staff_id = p_staff_id)
  GROUP BY d.brand
  ORDER BY count DESC
  LIMIT 5;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RPC 3: Fetch staff performance statistics within custom date boundaries
CREATE OR REPLACE FUNCTION public.get_staff_performance(
  p_shop_id uuid,
  p_from timestamptz,
  p_to timestamptz
)
RETURNS TABLE (
  staff_id uuid,
  name text,
  assigned_count bigint,
  completed_count bigint,
  avg_turnaround_days numeric,
  total_collected numeric
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    u.id AS staff_id,
    u.name,
    count(r.id)::bigint AS assigned_count,
    (count(r.id) FILTER (WHERE r.status = 'delivered'))::bigint AS completed_count,
    coalesce(
      round(
        avg(
          EXTRACT(EPOCH FROM (r.updated_at - r.created_at)) / 86400
        )::numeric, 
        1
      ), 
      0
    ) AS avg_turnaround_days,
    coalesce((sum(r.estimate) FILTER (WHERE r.status = 'delivered'))::numeric, 0) AS total_collected
  FROM public.users u
  LEFT JOIN public.repairs r ON u.id = r.staff_id 
    AND r.created_at >= p_from 
    AND r.created_at <= p_to
  WHERE u.shop_id = p_shop_id 
    AND u.role = 'staff'
  GROUP BY u.id, u.name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
