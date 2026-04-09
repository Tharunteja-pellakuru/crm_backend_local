const db = require("./config/db");

db.query("SHOW CREATE TABLE crm_tbl_followUpSummary", (err, result) => {
  if (err) {
    console.error("Error:", err);
    process.exit(1);
  }
  console.log(result[0]['Create Table']);
  process.exit(0);
});
