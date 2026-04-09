-- Migration Script: Update crm_tbl_enquiries schema
-- Date: 2026-04-09
-- Description: Add created_by and updated_by columns for administrative tracking

-- Use the target database (ensure it matches your .env)
-- USE crm_db; 

-- Add created_by column if it doesn't exist
ALTER TABLE crm_tbl_enquiries
ADD COLUMN IF NOT EXISTS created_by INT NULL AFTER remarks;

-- Add updated_by column if it doesn't exist
ALTER TABLE crm_tbl_enquiries
ADD COLUMN IF NOT EXISTS updated_by INT NULL AFTER updated_at;

-- Optional: Log the change for traceability
-- CREATE TABLE IF NOT EXISTS crm_schema_logs (id INT AUTO_INCREMENT PRIMARY KEY, table_name VARCHAR(100), change_description TEXT, applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP);
-- INSERT INTO crm_schema_logs (table_name, change_description) VALUES ('crm_tbl_enquiries', 'Added created_by and updated_by columns');
