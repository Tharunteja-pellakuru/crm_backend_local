-- migration_v8_refactor_followup_summary_id.sql
-- Refactoring crm_tbl_followUpSummary: renaming id to followup_summary_id and adding audit columns

-- 1. Rename Primary Key
ALTER TABLE `crm_tbl_followUpSummary` CHANGE COLUMN `id` `followup_summary_id` INT AUTO_INCREMENT;

-- 2. Add Audit Columns
ALTER TABLE `crm_tbl_followUpSummary` 
ADD COLUMN `created_by` INT NULL,
ADD COLUMN `updated_by` INT NULL,
ADD COLUMN `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP;
