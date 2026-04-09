-- Migration Script: Rename id to lead_id and add audit columns to crm_tbl_leads
-- Date: 2026-04-09
-- Description: Renames primary key and adds created_by/updated_by columns

-- 1. Drop foreign keys that reference crm_tbl_leads(id)
-- Followups
ALTER TABLE crm_tbl_followups DROP FOREIGN KEY crm_tbl_followups_ibfk_1;
-- Clients
ALTER TABLE crm_tbl_clients DROP FOREIGN KEY fk_client_lead;

-- 2. Rename the column
ALTER TABLE crm_tbl_leads RENAME COLUMN id TO lead_id;

-- 3. Add audit columns
ALTER TABLE crm_tbl_leads 
ADD COLUMN created_by INT DEFAULT NULL,
ADD COLUMN updated_by INT DEFAULT NULL;

-- 4. Re-add foreign keys referencing the new column name
-- Followups
ALTER TABLE crm_tbl_followups 
ADD CONSTRAINT crm_tbl_followups_ibfk_1 
FOREIGN KEY (lead_id) REFERENCES crm_tbl_leads(lead_id) 
ON DELETE CASCADE;

-- Clients
ALTER TABLE crm_tbl_clients 
ADD CONSTRAINT fk_client_lead 
FOREIGN KEY (lead_id) REFERENCES crm_tbl_leads(lead_id) 
ON DELETE SET NULL 
ON UPDATE CASCADE;
