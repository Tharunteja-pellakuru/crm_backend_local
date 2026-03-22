const db = require("../config/db");

const fixTable = async () => {
  console.log("Starting AI Models table fix...");
  
  const dropQuery = "DROP TABLE IF EXISTS crm_tbl_aiModels";
  const createQuery = `
    CREATE TABLE crm_tbl_aiModels (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(150) NOT NULL,
      provider VARCHAR(100),
      model_id VARCHAR(150),
      api_key TEXT,
      is_default BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `;

  db.query(dropQuery, (err) => {
    if (err) {
      console.error("Error dropping table:", err.message);
      process.exit(1);
    }
    console.log("Table dropped successfully.");

    db.query(createQuery, (err) => {
      if (err) {
        console.error("Error creating table:", err.message);
        process.exit(1);
      }
      console.log("Table created successfully with INT AUTO_INCREMENT ID.");
      process.exit(0);
    });
  });
};

fixTable();
