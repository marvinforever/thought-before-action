-- Fix get_customer_purchase_summary_v2 to handle NULL product_descriptions and NULL sale_dates
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
      COALESCE(EXTRACT(YEAR FROM sale_date)::TEXT, 'Unknown') AS yr,
      amount,
      COALESCE(NULLIF(TRIM(product_description), ''), 'Unknown product') AS product_description,
      sale_date
    FROM customer_purchase_history
    WHERE company_id = p_company_id
      AND customer_name ILIKE p_customer_name_pattern
  )
  SELECT
    COALESCE(SUM(amount), 0)::NUMERIC AS total_revenue,
    COUNT(*)::BIGINT AS transaction_count,
    (
      SELECT jsonb_object_agg(yr2, total)
      FROM (
        SELECT yr AS yr2, SUM(amount) AS total
        FROM base
        WHERE yr != 'Unknown'
        GROUP BY yr
        ORDER BY yr DESC
        LIMIT 7
      ) t
    ) AS yearly_totals,
    (
      SELECT jsonb_agg(row_to_json(p))
      FROM (
        SELECT product_description AS name, SUM(amount) AS revenue, COUNT(*) AS txn_count
        FROM base
        GROUP BY product_description
        ORDER BY SUM(amount) DESC
        LIMIT 10
      ) p
    ) AS top_products,
    MAX(sale_date)::DATE AS last_sale_date
  FROM base;
$$;