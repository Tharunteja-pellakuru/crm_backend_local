const db = require("./config/db");
const pool = db.promise;

async function run() {
  try {
    console.log("Altering crm_tbl_projects schema...");
    await pool.query("ALTER TABLE crm_tbl_projects MODIFY COLUMN project_status VARCHAR(50) DEFAULT 'In Progress'");
    await pool.query("ALTER TABLE crm_tbl_projects MODIFY COLUMN project_priority VARCHAR(50) DEFAULT 'High'");
    
    console.log("Schema updated successfully!");
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}
run();
