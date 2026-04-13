const db = require("./config/db");

async function migrate() {
  try {
    const pool = db.promise;
    console.log("Updating project_category in crm_tbl_projects...");

    await pool.query("UPDATE crm_tbl_projects SET project_category = '1' WHERE project_category = 'Tech'");
    console.log("Updated 'Tech' to '1'");

    await pool.query("UPDATE crm_tbl_projects SET project_category = '2' WHERE project_category = 'Social Media'");
    console.log("Updated 'Social Media' to '2'");

    await pool.query("UPDATE crm_tbl_projects SET project_category = '3' WHERE project_category = 'Both'");
    console.log("Updated 'Both' to '3'");

    console.log("Migration complete!");
    process.exit(0);
  } catch (error) {
    console.error("Migration failed:", error);
    process.exit(1);
  }
}

migrate();
