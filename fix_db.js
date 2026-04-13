const db = require("./config/db");
const pool = db;
pool.query("ALTER TABLE crm_tbl_projects MODIFY COLUMN project_category VARCHAR(50) DEFAULT '1'", (err) => { 
  if(err) { console.error("Error altering project_category:", err); } else { console.log("SUCCESS altering project_category"); }
  pool.query("ALTER TABLE crm_tbl_leads MODIFY COLUMN lead_category VARCHAR(50) DEFAULT '1'", (err2) => {
    if(err2) { console.error("Error altering lead_category:", err2); } else { console.log("SUCCESS altering lead_category"); }
    
    // Now normalize values
    pool.query("UPDATE crm_tbl_projects SET project_category = '1' WHERE project_category = 'Tech' OR project_category = '1'", () => {
      pool.query("UPDATE crm_tbl_projects SET project_category = '2' WHERE project_category = 'Social Media' OR project_category = '2'", () => {
        pool.query("UPDATE crm_tbl_projects SET project_category = '3' WHERE project_category = 'Both' OR project_category = '3'", () => {
           console.log("Projects normalized!");
           
           pool.query("UPDATE crm_tbl_leads SET lead_category = '1' WHERE lead_category = 'Tech' OR lead_category = '1'", () => {
             pool.query("UPDATE crm_tbl_leads SET lead_category = '2' WHERE lead_category = 'Social Media' OR lead_category = '2'", () => {
               pool.query("UPDATE crm_tbl_leads SET lead_category = '3' WHERE lead_category = 'Both' OR lead_category = '3'", () => {
                 console.log("Leads normalized!");
                 process.exit(0);
               });
             });
           });
        });
      });
    });
  });
});
