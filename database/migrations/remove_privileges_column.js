const db = require("../config/db");

/**
 * Migration: Remove privileges column from crm_tbl_admins
 * This migration removes the deprecated privileges field from the admin users table.
 */
const removePrivilegesColumn = async () => {
  try {
    console.log("Running migration: Remove privileges column from crm_tbl_admins...");

    // Check if privileges column exists
    const checkColumnQuery = `
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME = 'crm_tbl_admins' 
      AND COLUMN_NAME = 'privileges'
    `;

    db.query(checkColumnQuery, (err, results) => {
      if (err) {
        console.error("Error checking for privileges column:", err);
        return;
      }

      if (results.length > 0) {
        // Column exists, drop it
        const dropColumnQuery = `
          ALTER TABLE crm_tbl_admins 
          DROP COLUMN privileges
        `;

        db.query(dropColumnQuery, (dropErr) => {
          if (dropErr) {
            console.error("Error dropping privileges column:", dropErr);
          } else {
            console.log("✓ Successfully removed privileges column from crm_tbl_admins");
          }
        });
      } else {
        console.log("✓ Privileges column does not exist, skipping migration");
      }
    });
  } catch (error) {
    console.error("Migration failed:", error);
  }
};

// Run migration if this file is executed directly
if (require.main === module) {
  removePrivilegesColumn();
}

module.exports = { removePrivilegesColumn };
