const db = require("./config/db");

const alterTableQuery = `
  ALTER TABLE crm_tbl_followups 
  MODIFY COLUMN lead_id INT NULL
`;

const alterTableClientsQuery = `
  ALTER TABLE crm_tbl_clients 
  MODIFY COLUMN client_status ENUM('Active', 'Inactive', 'On Hold', 'Completed', 'Dropped') DEFAULT 'Active'
`;

// Helper for multiple queries
const runQuery = (query, label) => {
  return new Promise((resolve, reject) => {
    db.query(query, (err, result) => {
      if (err) {
        console.error(`Error altering ${label}:`, err.message);
        return reject(err);
      }
      console.log(`${label} altered successfully!`);
      resolve(result);
    });
  });
};

async function migrate() {
  try {
    await runQuery(alterTableQuery, "crm_tbl_followups");
    await runQuery(alterTableClientsQuery, "crm_tbl_clients");
    process.exit(0);
  } catch (err) {
    process.exit(1);
  }
}

migrate();
