-- Phase 1: Add customer_id column to backboard_threads for per-customer memory threads
ALTER TABLE backboard_threads ADD COLUMN customer_id uuid REFERENCES sales_companies(id) ON DELETE CASCADE;

-- Create unique index for per-user, per-customer, per-context thread lookup
CREATE UNIQUE INDEX backboard_threads_user_customer_ctx_idx 
ON backboard_threads(profile_id, COALESCE(customer_id, '00000000-0000-0000-0000-000000000000'::uuid), context_type);

-- Add comment explaining the schema
COMMENT ON COLUMN backboard_threads.customer_id IS 'When set, this thread is specific to a customer relationship. NULL = general thread for the context_type.';