-- migration_v10_add_project_audit_columns.sql
-- Adding audit support (created_by, updated_by) to crm_tbl_projects

-- Add created_by column
ALTER TABLE `crm_tbl_projects` ADD COLUMN IF NOT EXISTS `created_by` INT NULL;

-- Add updated_by column
ALTER TABLE `crm_tbl_projects` ADD COLUMN IF NOT EXISTS `updated_by` INT NULL;
