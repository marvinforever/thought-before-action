-- Remove duplicate rows from customer_purchase_history
-- Keep only one copy of each unique (company_id, customer_name, amount, season, product_description) combination

DELETE FROM customer_purchase_history
WHERE id IN (
  SELECT id FROM (
    SELECT id,
      ROW_NUMBER() OVER (
        PARTITION BY company_id, customer_name, amount, season, product_description
        ORDER BY created_at DESC
      ) as row_num
    FROM customer_purchase_history
  ) duplicates
  WHERE row_num > 1
);