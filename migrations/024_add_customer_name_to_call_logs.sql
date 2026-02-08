-- Add customer_name column to call_logs table
-- Stores the customer name extracted from transcript tool calls or conversation
ALTER TABLE call_logs ADD COLUMN IF NOT EXISTS customer_name VARCHAR(100);
