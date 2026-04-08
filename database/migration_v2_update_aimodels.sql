-- Migration Script: Update crm_tbl_aiModels schema
-- Date: 2026-04-08

-- Rename id to aimodel_id
ALTER TABLE crm_tbl_aiModels CHANGE COLUMN id aimodel_id INT AUTO_INCREMENT;

-- Add new columns if they don't exist
ALTER TABLE crm_tbl_aiModels
ADD COLUMN uuid CHAR(36) NOT NULL AFTER aimodel_id,
ADD COLUMN created_by INT NULL AFTER is_default,
ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP AFTER created_at,
ADD COLUMN updated_by INT NULL AFTER updated_at;

-- Generate UUIDs for existing rows
UPDATE crm_tbl_aiModels SET uuid = (SELECT UUID()) WHERE uuid IS NULL OR uuid = '';

-- Add UNIQUE constraint to uuid
ALTER TABLE crm_tbl_aiModels ADD UNIQUE (uuid);

-- Log the change (assuming a logs table exists or just for documentation)
-- INSERT INTO crm_schema_logs (table_name, change_description) VALUES ('crm_tbl_aiModels', 'Renamed id to aimodel_id, added metadata columns');
