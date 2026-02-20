
-- Create get_rep_customer_summary: aggregates all customer data for a rep in the DB
-- Replaces 25+ sequential round trips with a single query
CREATE OR REPLACE FUNCTION public.get_rep_customer_summary(
  p_company_id UUID,
  p_rep_first_name TEXT
)
RETURNS TABLE(
  customer_name TEXT,
  total_revenue NUMERIC,
  transaction_count BIGINT,
  rep_name TEXT
)
LANGUAGE sql SECURITY DEFINER SET search_path = 'public'
AS $$
  SELECT
    customer_name::TEXT,
    SUM(amount)::NUMERIC AS total_revenue,
    COUNT(*)::BIGINT AS transaction_count,
    MAX(rep_name)::TEXT AS rep_name
  FROM customer_purchase_history
  WHERE company_id = p_company_id
    AND rep_name ILIKE (p_rep_first_name || '%')
  GROUP BY customer_name
  ORDER BY total_revenue DESC;
$$;

-- Create get_customer_purchase_summary_v2: returns pre-aggregated summary for a customer
-- Replaces 500-row raw fetches with a single compact result
-- Note: table has sale_date (date), no year column - we extract year from sale_date
CREATE OR REPLACE FUNCTION public.get_customer_purchase_summary_v2(
  p_company_id UUID,
  p_customer_name_pattern TEXT
)
RETURNS TABLE(
  total_revenue NUMERIC,
  transaction_count BIGINT,
  yearly_totals JSONB,
  top_products JSONB,
  last_sale_date DATE
)
LANGUAGE sql SECURITY DEFINER SET search_path = 'public'
AS $$
  WITH base AS (
    SELECT
      EXTRACT(YEAR FROM sale_date)::TEXT AS yr,
      amount,
      product_description,
      sale_date
    FROM customer_purchase_history
    WHERE company_id = p_company_id
      AND customer_name ILIKE p_customer_name_pattern
  )
  SELECT
    SUM(amount)::NUMERIC AS total_revenue,
    COUNT(*)::BIGINT AS transaction_count,
    (
      SELECT jsonb_object_agg(yr2, total)
      FROM (
        SELECT yr AS yr2, SUM(amount) AS total FROM base GROUP BY yr ORDER BY yr DESC LIMIT 7
      ) t
    ) AS yearly_totals,
    (
      SELECT jsonb_agg(row_to_json(p))
      FROM (
        SELECT product_description AS name, SUM(amount) AS revenue, COUNT(*) AS txn_count
        FROM base GROUP BY product_description ORDER BY SUM(amount) DESC LIMIT 10
      ) p
    ) AS top_products,
    MAX(sale_date)::DATE AS last_sale_date
  FROM base;
$$;
