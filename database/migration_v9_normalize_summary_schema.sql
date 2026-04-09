-- migration_v9_normalize_summary_schema.sql
-- Normalizing crm_tbl_followUpSummary by removing redundant project_id column

-- Note: We drop the project_id column and rely on the parent followup record for project context.
-- If you need to identify the exact foreign key name first, run: SHOW CREATE TABLE crm_tbl_followUpSummary;

-- Standard attempt to drop the foreign key (often ibfk_2 in this schema)
ALTER TABLE `crm_tbl_followUpSummary` DROP FOREIGN KEY IF EXISTS `crm_tbl_followUpSummary_ibfk_2`;
ALTER TABLE `crm_tbl_followUpSummary` DROP COLUMN IF EXISTS `project_id`;
