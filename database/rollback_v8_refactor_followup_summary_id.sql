-- rollback_v8_refactor_followup_summary_id.sql
-- Reversing refactoring of crm_tbl_followUpSummary

-- 1. Remove Audit Columns
ALTER TABLE `crm_tbl_followUpSummary` 
DROP COLUMN `created_by`,
DROP COLUMN `updated_by`,
DROP COLUMN `updated_at`;

-- 2. Rename Primary Key back
ALTER TABLE `crm_tbl_followUpSummary` CHANGE COLUMN `followup_summary_id` `id` INT AUTO_INCREMENT;
