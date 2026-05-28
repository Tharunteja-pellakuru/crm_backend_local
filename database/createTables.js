const db = require("../config/db");
const bcrypt = require("bcrypt");
const { v4: uuidv4 } = require("uuid");

// Helper to run query
const runQuery = (query, successMsg, errorMsg) => {
  return new Promise((resolve, reject) => {
    db.query(query, (err) => {
      if (err) {
        console.error(errorMsg, err);
        reject(err);
      } else {
        console.log(successMsg);
        resolve();
      }
    });
  });
};

// ==========================
// USERS TABLE
// ==========================
const createUsersTable = async () => {
  await runQuery(
    `CREATE TABLE IF NOT EXISTS crm_tbl_admins (
      admin_id INT AUTO_INCREMENT PRIMARY KEY,
      uuid VARCHAR(100) UNIQUE,
      full_name VARCHAR(150) NOT NULL,
      email VARCHAR(150) UNIQUE NOT NULL,
      password TEXT NOT NULL,
      role VARCHAR(50),
      status BOOLEAN DEFAULT TRUE,
      image TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      created_by INT NULL,
      updated_by INT NULL
    )`,
    "Users table ready",
    "Error creating users table:"
  );

  const defaultEmail = "ceo@eparivartan.com";
  const hashedPassword = await bcrypt.hash("Password@123", 10);

  const checkQuery = "SELECT COUNT(*) as count FROM crm_tbl_admins";

  return new Promise((resolve) => {
    db.query(checkQuery, async (err, result) => {
      if (err) {
        console.error("Error checking admins:", err);
        resolve();
        return;
      }

      if (result[0].count === 0) {
        db.query(
          `INSERT INTO crm_tbl_admins 
          (uuid, full_name, email, password, role, status, image)
          VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [
            uuidv4(),
            "Anand",
            defaultEmail,
            hashedPassword,
            "Administrator",
            true,
            null,
          ],
          (err) => {
            if (err) {
              console.error("Error inserting default admin:", err);
            } else {
              console.log("Default admin created");
            }
            resolve();
          }
        );
      } else {
        console.log("Admins already exist");
        resolve();
      }
    });
  });
};

// ==========================
// ENQUIRIES TABLE
// ==========================
const createEnquiriesTable = async () => {
  await runQuery(
    `CREATE TABLE IF NOT EXISTS crm_tbl_enquiries (
      enquiry_id INT AUTO_INCREMENT PRIMARY KEY,
      uuid VARCHAR(100) UNIQUE NOT NULL,
      full_name VARCHAR(250),
      email VARCHAR(250),
      phone_number VARCHAR(20),
      website_url TEXT DEFAULT '',
      source VARCHAR(100) DEFAULT '',
      message TEXT,
      status ENUM('New', 'Hold', 'Dismissed', 'Converted') DEFAULT 'New',
      remarks TEXT DEFAULT '',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      created_by INT NULL,
      updated_by INT NULL
    )`,
    "Enquiries Table Created",
    "Error Creating Enquiries Table:"
  );
};

// ==========================
// LEADS TABLE
// ==========================
const createLeadsTable = async () => {
  await runQuery(
    `CREATE TABLE IF NOT EXISTS crm_tbl_leads (
      lead_id INT AUTO_INCREMENT PRIMARY KEY,
      uuid CHAR(36) UNIQUE,
      full_name VARCHAR(100) NOT NULL,
      phone_number VARCHAR(20),
      email VARCHAR(250),
      lead_status VARCHAR(50),
      website_url TEXT,
      source VARCHAR(255) DEFAULT NULL,
      message TEXT,
      country_code VARCHAR(20),
      enquiry_id INT DEFAULT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      created_by INT NULL,
      updated_by INT NULL,
      converted_by INT NULL
    )`,
    "Leads Table Created",
    "Error Creating Leads Table:"
  );
};

// ==========================
// AI MODELS TABLE
// ==========================
const createAiModelsTable = async () => {
  await runQuery(
    `CREATE TABLE IF NOT EXISTS crm_tbl_aiModels (
      aimodel_id INT AUTO_INCREMENT PRIMARY KEY,
      uuid CHAR(36) NOT NULL UNIQUE,
      name VARCHAR(150) NOT NULL,
      provider VARCHAR(100),
      model_id VARCHAR(150),
      api_key TEXT,
      is_default BOOLEAN DEFAULT FALSE,
      created_by INT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      updated_by INT NULL
    )`,
    "AI Models Table Created",
    "Error Creating AI Models Table:"
  );

  return new Promise((resolve) => {
    db.query(
      "SELECT COUNT(*) as count FROM crm_tbl_aiModels",
      async (err, result) => {
        if (err) {
          console.error("Error checking AI models:", err);
          resolve();
          return;
        }

        if (result[0].count === 0) {
          db.query(
            `INSERT INTO crm_tbl_aiModels 
            (uuid, name, provider, model_id, api_key, is_default)
            VALUES (?, ?, ?, ?, ?, ?)`,
            [
              uuidv4(),
              "Llama 3 (Groq - Ultra Fast)",
              "groq",
              "llama-3.3-70b-versatile",
              "YOUR_API_KEY_HERE",
              true,
            ],
            (err) => {
              if (err) {
                console.error("Error seeding AI models:", err);
              } else {
                console.log("Default AI Model inserted");
              }
              resolve();
            }
          );
        } else {
          console.log("AI Models already exist");
          resolve();
        }
      }
    );
  });
};

// ==========================
// CLIENTS TABLE
// ==========================
const createClientsTable = async () => {
  await runQuery(
    `CREATE TABLE IF NOT EXISTS crm_tbl_clients (
      client_id INT AUTO_INCREMENT PRIMARY KEY,
      uuid CHAR(36) NOT NULL UNIQUE,
      organisation_name VARCHAR(255) NOT NULL,
      client_name VARCHAR(255),
      client_country VARCHAR(100),
      client_state VARCHAR(100) DEFAULT '',
      client_currency VARCHAR(10),
      client_status ENUM('Active', 'Inactive', 'Dismissed') DEFAULT 'Active',
      lead_id INT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      created_by INT NULL,
      updated_by INT NULL,

      CONSTRAINT fk_client_lead
      FOREIGN KEY (lead_id)
      REFERENCES crm_tbl_leads(lead_id)
      ON DELETE SET NULL
      ON UPDATE CASCADE
    )`,
    "Clients Table Created",
    "Error Creating Clients Table:"
  );
};

// ==========================
// PROJECTS TABLE
// ==========================
const createProjectsTable = async () => {
  await runQuery(
    `CREATE TABLE IF NOT EXISTS crm_tbl_projects (
      project_id INT AUTO_INCREMENT PRIMARY KEY,
      uuid CHAR(36) NOT NULL UNIQUE,
      project_name VARCHAR(250) NOT NULL,
      project_description TEXT,
      project_category VARCHAR(50) DEFAULT '1',
      project_status VARCHAR(50) DEFAULT 'In Progress',
      project_priority VARCHAR(50) DEFAULT 'High',
      project_budget INT,
      onboarding_date DATE,
      deadline_date DATE,
      scope_document VARCHAR(500),
      client_id INT,
      lead_id INT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      created_by INT NULL,
      updated_by INT NULL,

      CONSTRAINT fk_project_client
      FOREIGN KEY (client_id)
      REFERENCES crm_tbl_clients(client_id)
      ON DELETE CASCADE
      ON UPDATE CASCADE,

      CONSTRAINT fk_project_lead
      FOREIGN KEY (lead_id)
      REFERENCES crm_tbl_leads(lead_id)
      ON DELETE SET NULL
      ON UPDATE CASCADE
    )`,
    "Projects Table Created",
    "Error Creating Projects Table:"
  );
};

// ==========================
// FOLLOWUPS TABLE
// ==========================
const createFollowupsTable = async () => {
  await runQuery(
    `CREATE TABLE IF NOT EXISTS crm_tbl_followups (
      followup_id INT AUTO_INCREMENT PRIMARY KEY,
      uuid VARCHAR(100) UNIQUE,
      followup_title VARCHAR(100) NOT NULL,
      followup_description TEXT,
      followup_datetime DATETIME NOT NULL,
      followup_mode ENUM('Call','Email','Whatsapp','Meeting') NOT NULL,
      followup_status ENUM('Pending','Completed','Reschedule','Cancelled') DEFAULT 'Pending',
      followup_priority ENUM('High','Medium','Low') DEFAULT 'Medium',

      lead_id INT NULL,
      project_id INT NULL,

      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      created_by INT NULL,
      updated_by INT NULL,

      INDEX (lead_id),
      INDEX (project_id),

      FOREIGN KEY (lead_id)
      REFERENCES crm_tbl_leads(lead_id)
      ON DELETE CASCADE,

      FOREIGN KEY (project_id)
      REFERENCES crm_tbl_projects(project_id)
      ON DELETE SET NULL
    )`,
    "Followups Table Created",
    "Error Creating Followups Table:"
  );
};

// ==========================
// FOLLOWUP SUMMARY TABLE
// ==========================
const createFollowupSummaryTable = async () => {
  await runQuery(
    `CREATE TABLE IF NOT EXISTS crm_tbl_followUpSummary (
      followup_summary_id INT AUTO_INCREMENT PRIMARY KEY,
      uuid VARCHAR(250) UNIQUE NOT NULL,
      followup_id INT NOT NULL,
      conclusion_message TEXT NOT NULL,
      completed_at DATETIME NOT NULL,
      completed_by VARCHAR(100),

      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

      created_by INT NULL,
      updated_by INT NULL,

      FOREIGN KEY (followup_id)
      REFERENCES crm_tbl_followups(followup_id)
      ON DELETE CASCADE
    )`,
    "Followup Summary Table Created",
    "Error Creating Followup Summary Table:"
  );
};

// ==========================
// CREATE ALL TABLES
// ==========================
const createAllTables = async () => {
  try {
    await createUsersTable();
    await createEnquiriesTable();
    await createLeadsTable();
    await createAiModelsTable();
    await createClientsTable();
    await createProjectsTable();
    await createFollowupsTable();
    await createFollowupSummaryTable();

    console.log("Database initialized successfully.");
  } catch (error) {
    console.error("Database initialization failed:", error);
  }
};

module.exports = {
  createAllTables,
};