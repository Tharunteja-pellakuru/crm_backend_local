const db = require("../config/db");

const checkTable = () => {
  db.query("SHOW COLUMNS FROM crm_tbl_followUpSummary", (err, result) => {
    if (err) {
      console.error("Error checking table:", err);
      process.exit(1);
    }
    console.log("Columns in crm_tbl_followUpSummary:");
    result.forEach(col => {
      console.log(`- ${col.Field} (${col.Type})`);
    });
    
    const hasNewPk = result.some(col => col.Field === 'followup_summary_id');
    const hasCreatedBy = result.some(col => col.Field === 'created_by');
    const hasUpdatedAt = result.some(col => col.Field === 'updated_at');

    if (hasNewPk && hasCreatedBy && hasUpdatedAt) {
      console.log("\nVERIFICATION SUCCESS: Table refactored correctly.");
    } else {
      console.error("\nVERIFICATION FAILED: Some columns are missing.");
    }
    process.exit(0);
  });
};

checkTable();
