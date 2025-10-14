-- Add column to track if a capability is marked as not relevant by the employee
ALTER TABLE employee_capabilities
ADD COLUMN marked_not_relevant boolean DEFAULT false,
ADD COLUMN not_relevant_reason text;