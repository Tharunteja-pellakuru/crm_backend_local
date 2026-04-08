const db = require("../config/db");
const bcrypt = require("bcrypt");
const { v4: uuidv4 } = require("uuid");

// Helper to run a query as a promise
const runQuery = (query, successMsg, errorMsg) => {
  return new Promise((resolve) => {
    db.query(query, (err) => {
      if (err) {
        console.error(errorMsg, err);
      } else {
        console.log(successMsg);
      }
      resolve();
    });
  });
};

// Admin Users
const createUsersTable = async () => {
  // Step 1: Create table
  await runQuery(
    `CREATE TABLE IF NOT EXISTS crm_tbl_admins (
      admin_id INT AUTO_INCREMENT PRIMARY KEY,
      uuid VARCHAR(100) UNIQUE,
      full_name VARCHAR(150) NOT NULL,
      email VARCHAR(150) UNIQUE NOT NULL,
      password TEXT NOT NULL,
      role VARCHAR(50),
      status BOOLEAN DEFAULT TRUE,
      privileges VARCHAR(50),
      image TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      created_by INT NULL,
      updated_by INT NULL
    )`,
    "Users table ready",
    "Error creating users table:",
  );

  // Step 2: Insert default admin if no admins exist
  const defaultEmail = "ceo@eparivartan.com";
  const hashedPassword = await bcrypt.hash("Password@123", 10);
  const uuid = uuidv4();
  const defaultImage = null;

  const checkQuery = "SELECT COUNT(*) as count FROM crm_tbl_admins";
  const insertQuery = `INSERT INTO crm_tbl_admins (uuid, full_name, email, password, role, status, privileges, image) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`;

  // Check if any admins exist
  return new Promise((resolve) => {
    db.query(checkQuery, (err, result) => {
      if (err) {
        console.error("Error checking for admins:", err);
        resolve();
        return;
      }
      if (result[0].count === 0) {
        db.query(
          insertQuery,
          [
            uuid,
            "Anand",
            defaultEmail,
            hashedPassword,
            "Root Admin",
            true,
            "3",
            defaultImage,
          ],
          (err) => {
            if (err) {
              console.error("Error inserting default admin:", err);
            } else {
              console.log("Default admin user created with image");
            }
            resolve();
          },
        );
      } else {
        console.log("Admins already exist, skipping default admin creation");
        resolve();
      }
    });
  });
};

// Leads
const createLeadsTable = () => {
  return runQuery(
    `CREATE TABLE IF NOT EXISTS crm_tbl_leads (
      id INT AUTO_INCREMENT PRIMARY KEY,
      uuid CHAR(36) UNIQUE,
      full_name VARCHAR(100) NOT NULL,
      phone_number VARCHAR(20),
      email VARCHAR(250),
      lead_category INT NOT NULL,
      lead_status VARCHAR(50),
      website_url TEXT,
      message TEXT,
      country VARCHAR(100),
      country_code VARCHAR(10),
      enquiry_id INT DEFAULT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )`,
    "Leads Table Created",
    "Error Creating Leads Table:",
  );
};

// Followups (depends on crm_tbl_leads)
const createNewFollowupsTable = () => {
  return runQuery(
    `CREATE TABLE IF NOT EXISTS crm_tbl_followups (
        id INT AUTO_INCREMENT PRIMARY KEY,
        uuid VARCHAR(100) UNIQUE,
        followup_title VARCHAR(100) NOT NULL,
        followup_description TEXT,
        followup_datetime DATETIME NOT NULL,
        followup_mode ENUM('Call','Email','Whatsapp','Meeting') NOT NULL,
        followup_status ENUM('Pending','Completed','Reschedule','Cancelled') NOT NULL DEFAULT 'Pending',
        followup_priority ENUM('High','Medium','Low') NOT NULL DEFAULT 'Medium',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        lead_id INT NULL,
        project_id INT NULL,
        INDEX (lead_id),
        INDEX (project_id),
        FOREIGN KEY (lead_id) REFERENCES crm_tbl_leads(id) ON DELETE CASCADE,
        FOREIGN KEY (project_id) REFERENCES crm_tbl_projects(project_id) ON DELETE SET NULL
      )`,
    "Followups Table Created",
    "Error Creating Followups Table:",
  );
};

// Followup Summary (depends on crm_tbl_followups)
const createFollowupSummaryTable = () => {
  return runQuery(
    `CREATE TABLE IF NOT EXISTS crm_tbl_followUpSummary (
      id INT PRIMARY KEY AUTO_INCREMENT,
      uuid VARCHAR(250) UNIQUE NOT NULL,
      followup_id INT NOT NULL,
      project_id INT NULL,
      conclusion_message TEXT NOT NULL,
      completed_at DATETIME NOT NULL,
      completed_by VARCHAR(100),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (followup_id)
          REFERENCES crm_tbl_followups(id)
          ON DELETE CASCADE,
      FOREIGN KEY (project_id)
          REFERENCES crm_tbl_projects(project_id)
          ON DELETE SET NULL
    )`,
    "Followup Summary Table Created",
    "Error Creating Followup Summary Table:",
  );
};

// AI Models (no dependencies)
const createAiModelsTable = () => {
  return runQuery(
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
    "Error Creating AI Models Table:",
  );
};

const createClientsTable = () => {
  return runQuery(
    `CREATE TABLE IF NOT EXISTS crm_tbl_clients (
      client_id INT AUTO_INCREMENT PRIMARY KEY,
      uuid CHAR(36) NOT NULL UNIQUE,
      organisation_name VARCHAR(255) NOT NULL,
      client_name VARCHAR(255),
      client_country VARCHAR(100),
      client_state VARCHAR(100) DEFAULT '',
      client_currency VARCHAR(10),
      client_status ENUM('Active', 'Inactive') DEFAULT 'Active',
      lead_id INT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      CONSTRAINT fk_client_lead
          FOREIGN KEY (lead_id)
          REFERENCES crm_tbl_leads(id)
          ON DELETE SET NULL
          ON UPDATE CASCADE
    )`,
    "Clients Table Created",
    "Error Creating Clients Table:",
  );
};

const createProjectsTable = () => {
  return runQuery(
    `CREATE TABLE IF NOT EXISTS crm_tbl_projects (
    project_id INT AUTO_INCREMENT PRIMARY KEY,
    uuid CHAR(36) NOT NULL UNIQUE,
    project_name VARCHAR(250) NOT NULL,
    project_description TEXT,
    project_category ENUM('Tech','Social Media','Both') DEFAULT 'Tech',
    project_status ENUM('Hold','In Progress','Completed') DEFAULT 'In Progress',
    project_priority ENUM('High','Medium','Low') DEFAULT 'High',
    project_budget INT,
    onboarding_date DATE,
    deadline_date DATE,
    scope_document VARCHAR(500),
    client_id INT,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    CONSTRAINT fk_project_client
        FOREIGN KEY (client_id)
        REFERENCES crm_tbl_clients(client_id)
        ON DELETE CASCADE
        ON UPDATE CASCADE
)`,
    "Projects Table Created",
    "Error Creating Projects Table:",
  );
};

const createEnquiriesTable = () => {
  return runQuery(
    `CREATE TABLE IF NOT EXISTS crm_tbl_enquiries (
        enquiry_id INT PRIMARY KEY AUTO_INCREMENT,
        uuid VARCHAR(100) UNIQUE NOT NULL,
        full_name VARCHAR(250),
        email VARCHAR(250),
        phone_number VARCHAR(20),
        website_url TEXT DEFAULT (''),
        message TEXT,
        status ENUM('New', 'Hold', 'Dismissed', 'Converted') DEFAULT 'New',
        remarks TEXT DEFAULT (''),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )`,
    "Enquiries Table Created",
    "Error Creating Enquiries Table:",
  );
};

// Create all tables in correct order (sequential)
const createAllTables = async () => {
  await createUsersTable();
  await createLeadsTable();
  await createAiModelsTable();
  await createClientsTable();
  await createProjectsTable();
  await createNewFollowupsTable();
  await createFollowupSummaryTable();
  await createEnquiriesTable();
};

module.exports = {
  createUsersTable,
  createLeadsTable,
  createClientsTable,
  createNewFollowupsTable,
  createFollowupSummaryTable,
  createProjectsTable,
  createAiModelsTable,
  createEnquiriesTable,
  createAllTables,
};
