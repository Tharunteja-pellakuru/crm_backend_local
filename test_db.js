const db = require("./config/db");
const pool = db;
pool.query("SELECT project_id, project_name, project_category FROM crm_tbl_projects LIMIT 5", (err, rows) => {
  if (err) console.error(err); else console.log("Projects:", rows);
  pool.query("SELECT lead_id, full_name, lead_category FROM crm_tbl_leads LIMIT 5", (err2, rows2) => {
    if (err2) console.error(err2); else console.log("Leads:", rows2);
    process.exit(0);
  });
});
