const db = require("./config/db");

const alterTableQuery = `
  ALTER TABLE crm_tbl_clients 
  MODIFY COLUMN client_status ENUM('Active', 'Inactive', 'On Hold', 'Completed', 'Dropped') DEFAULT 'Active'
`;

db.query(alterTableQuery, (err, result) => {
  if (err) {
    console.error("Error altering table:", err.message);
    process.exit(1);
  }
  console.log("Table crm_tbl_clients altered successfully!");
  process.exit(0);
});
