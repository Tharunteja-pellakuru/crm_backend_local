  const db = require("../config/db");
  const bcrypt = require("bcrypt");
  const { v4: uuidv4 } = require("uuid");

  // Helper to run a query as a promise (uses pool - any connection)
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

  // Helper to run a query on a SPECIFIC connection (required for session-level SET statements)
  const runQueryOn = (conn, query, successMsg = null, errorMsg = null) => {
    return new Promise((resolve) => {
      conn.query(query, (err) => {
        if (err) {
          if (errorMsg) console.error(errorMsg, err);
        } else {
          if (successMsg) console.log(successMsg);
        }
        resolve();
      });
    });
  };

  // Get a dedicated connection from the pool
  const getConnection = () => {
    return new Promise((resolve, reject) => {
      db.getConnection((err, conn) => {
        if (err) reject(err);
        else resolve(conn);
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

  // Leads (with automatic migration for id -> lead_id)
  // Uses a dedicated connection to ensure SET FOREIGN_KEY_CHECKS applies to all queries
  const createLeadsTable = async () => {
    let conn;
    try {
      conn = await getConnection();
      
      // Disable FK checks on this dedicated connection
      await runQueryOn(conn, "SET FOREIGN_KEY_CHECKS = 0");

      // Check if table exists and what columns it has
      const columns = await new Promise((resolve) => {
        conn.query("SHOW COLUMNS FROM crm_tbl_leads", (err, cols) => {
          if (err) resolve(null); // null means table doesn't exist
          else resolve(cols);
        });
      });

      if (!columns) {
        // Table doesn't exist - attempt to create fresh.
        // [LOCKDOWN] Dropping table is disabled to prevent accidental data loss.
        // await runQueryOn(conn, "ALTER TABLE crm_tbl_followups DROP FOREIGN KEY IF EXISTS crm_tbl_followups_ibfk_1");
        // await runQueryOn(conn, "ALTER TABLE crm_tbl_clients DROP FOREIGN KEY IF EXISTS fk_client_lead");
        // await runQueryOn(conn, "DROP TABLE IF EXISTS crm_tbl_leads");
        await runQueryOn(conn,
          `CREATE TABLE IF NOT EXISTS crm_tbl_leads (
            lead_id INT AUTO_INCREMENT PRIMARY KEY,
            uuid CHAR(36) UNIQUE,
            full_name VARCHAR(100) NOT NULL,
            phone_number VARCHAR(20),
            email VARCHAR(250),
            lead_status VARCHAR(50),
            previous_lead_status VARCHAR(50) DEFAULT NULL,
            website_url TEXT,
            message TEXT,
            country_code VARCHAR(20),
            enquiry_id INT DEFAULT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            created_by INT NULL,
            updated_by INT NULL
          )`,
          "Leads Table Created",
          "Error Creating Leads Table:"
        );
      } else {
        const hasId = columns.some(col => col.Field === 'id');
        const hasLeadId = columns.some(col => col.Field === 'lead_id');
        const hasCreatedBy = columns.some(col => col.Field === 'created_by');
        const hasPreviousStatus = columns.some(col => col.Field === 'previous_lead_status');

        if (hasId && !hasLeadId) {
          console.log("Detected old 'id' column in crm_tbl_leads. Running migration...");

          // Drop FK constraints referencing crm_tbl_leads from dependant tables
          await runQueryOn(conn, "ALTER TABLE crm_tbl_followups DROP FOREIGN KEY IF EXISTS crm_tbl_followups_ibfk_1", "Dropped followup FK");
          await runQueryOn(conn, "ALTER TABLE crm_tbl_clients DROP FOREIGN KEY IF EXISTS fk_client_lead", "Dropped client FK");

          // Rename primary key column
          await runQueryOn(conn, "ALTER TABLE crm_tbl_leads CHANGE COLUMN id lead_id INT AUTO_INCREMENT", "Renamed id -> lead_id", "Error renaming column:");

          // Add audit columns if missing
          if (!hasCreatedBy) {
            await runQueryOn(conn, "ALTER TABLE crm_tbl_leads ADD COLUMN created_by INT NULL, ADD COLUMN updated_by INT NULL", "Added audit columns", "Error adding audit columns:");
          }

          // Add previous_lead_status column if missing
          if (!hasPreviousStatus) {
            await runQueryOn(conn, "ALTER TABLE crm_tbl_leads ADD COLUMN previous_lead_status VARCHAR(50) DEFAULT NULL", "Added previous_lead_status column", "Error adding previous_lead_status column:");
          }

          // Re-add FK constraints pointing to the new column name
          await runQueryOn(conn,
            `ALTER TABLE crm_tbl_followups ADD CONSTRAINT crm_tbl_followups_ibfk_1 FOREIGN KEY (lead_id) REFERENCES crm_tbl_leads(lead_id) ON DELETE CASCADE`,
            "Restored followup FK", "Error restoring followup FK:"
          );
          await runQueryOn(conn,
            `ALTER TABLE crm_tbl_clients ADD CONSTRAINT fk_client_lead FOREIGN KEY (lead_id) REFERENCES crm_tbl_leads(lead_id) ON DELETE SET NULL ON UPDATE CASCADE`,
            "Restored client FK", "Error restoring client FK:"
          );

          console.log("crm_tbl_leads migration completed successfully!");
        } else {
          // Table already uses lead_id - check for missing columns
          if (!hasCreatedBy) {
            await runQueryOn(conn, "ALTER TABLE crm_tbl_leads ADD COLUMN created_by INT NULL, ADD COLUMN updated_by INT NULL", "Added missing audit columns", "Error adding audit columns:");
          }
          // Add previous_lead_status column if missing
          if (!hasPreviousStatus) {
            await runQueryOn(conn, "ALTER TABLE crm_tbl_leads ADD COLUMN previous_lead_status VARCHAR(50) DEFAULT NULL", "Added previous_lead_status column", "Error adding previous_lead_status column:");
          } else {
            console.log("Leads table is up to date.");
          }
        }
      }

      // Re-enable FK checks
      await runQueryOn(conn, "SET FOREIGN_KEY_CHECKS = 1");
    } catch (e) {
      console.error("Error in createLeadsTable:", e);
      if (conn) {
        conn.query("SET FOREIGN_KEY_CHECKS = 1", () => {});
      }
    } finally {
      if (conn) conn.release();
    }
  };


  // Followups (depends on crm_tbl_leads)
  const createNewFollowupsTable = async () => {
    let conn;
    try {
      conn = await getConnection();
      
      // Check if table exists and what columns it has
      const columns = await new Promise((resolve) => {
        conn.query("SHOW COLUMNS FROM crm_tbl_followups", (err, cols) => {
          if (err) resolve(null); // null means table doesn't exist
          else resolve(cols);
        });
      });

      if (!columns) {
        // Table doesn't exist - create fresh
        await runQueryOn(conn,
          `CREATE TABLE IF NOT EXISTS crm_tbl_followups (
            followup_id INT AUTO_INCREMENT PRIMARY KEY,
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
            created_by INT NULL,
            updated_by INT NULL,
            INDEX (lead_id),
            INDEX (project_id),
            FOREIGN KEY (lead_id) REFERENCES crm_tbl_leads(lead_id) ON DELETE CASCADE,
            FOREIGN KEY (project_id) REFERENCES crm_tbl_projects(project_id) ON DELETE SET NULL
          )`,
          "Followups Table Created",
          "Error Creating Followups Table:"
        );
      } else {
        const hasId = columns.some(col => col.Field === 'id');
        const hasFollowupId = columns.some(col => col.Field === 'followup_id');
        const hasCreatedBy = columns.some(col => col.Field === 'created_by');

        if (hasId && !hasFollowupId) {
          console.log("Detected old 'id' column in crm_tbl_followups. Running migration...");

          // Disable FK checks locally for structural changes
          await runQueryOn(conn, "SET FOREIGN_KEY_CHECKS = 0");

          // Drop FK from dependent table
          await runQueryOn(conn, "ALTER TABLE crm_tbl_followUpSummary DROP FOREIGN KEY IF EXISTS crm_tbl_followUpSummary_ibfk_1", "Dropped summary FK");

          // Rename primary key column
          await runQueryOn(conn, "ALTER TABLE crm_tbl_followups CHANGE COLUMN id followup_id INT AUTO_INCREMENT", "Renamed id -> followup_id", "Error renaming column:");

          // Add audit columns if missing
          if (!hasCreatedBy) {
            await runQueryOn(conn, "ALTER TABLE crm_tbl_followups ADD COLUMN created_by INT NULL, ADD COLUMN updated_by INT NULL", "Added audit columns");
          }

          // Re-add FK in dependent table referencing the new column name
          await runQueryOn(conn,
            `ALTER TABLE crm_tbl_followUpSummary ADD CONSTRAINT crm_tbl_followUpSummary_ibfk_1 FOREIGN KEY (followup_id) REFERENCES crm_tbl_followups(followup_id) ON DELETE CASCADE`,
            "Restored summary FK"
          );

          // Re-enable FK checks
          await runQueryOn(conn, "SET FOREIGN_KEY_CHECKS = 1");
          console.log("crm_tbl_followups migration completed successfully!");
        } else {
          // Just add missing audit columns if needed
          if (!hasCreatedBy) {
            await runQueryOn(conn, "ALTER TABLE crm_tbl_followups ADD COLUMN created_by INT NULL, ADD COLUMN updated_by INT NULL", "Added missing audit columns");
          } else {
            console.log("Followups table is up to date.");
          }
        }
      }
    } catch (e) {
      console.error("Error in createNewFollowupsTable:", e);
      if (conn) {
        conn.query("SET FOREIGN_KEY_CHECKS = 1", () => {});
      }
    } finally {
      if (conn) conn.release();
    }
  };

  // Followup Summary (depends on crm_tbl_followups)
  // Followup Summary (depends on crm_tbl_followups)
  const createFollowupSummaryTable = async () => {
    let conn;
    try {
      conn = await getConnection();
      
      // Check if table exists and what columns it has
      const columns = await new Promise((resolve) => {
        conn.query("SHOW COLUMNS FROM crm_tbl_followUpSummary", (err, cols) => {
          if (err) resolve(null); // null means table doesn't exist
          else resolve(cols);
        });
      });

      if (!columns) {
        // Table doesn't exist - create fresh
        await runQueryOn(conn,
          `CREATE TABLE IF NOT EXISTS crm_tbl_followUpSummary (
            followup_summary_id INT AUTO_INCREMENT PRIMARY KEY,
            uuid VARCHAR(250) UNIQUE NOT NULL,
            followup_id INT NOT NULL,
            conclusion_message TEXT NOT NULL,
            completed_at DATETIME NOT NULL,
            completed_by VARCHAR(100),
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            created_by INT NULL,
            updated_by INT NULL,
            FOREIGN KEY (followup_id)
                REFERENCES crm_tbl_followups(followup_id)
                ON DELETE CASCADE
          )`,
          "Followup Summary Table Created (Normalized)",
          "Error Creating Followup Summary Table:"
        );
      } else {
        const hasId = columns.some(col => col.Field === 'id');
        const hasSummaryId = columns.some(col => col.Field === 'followup_summary_id');
        const hasUpdatedBy = columns.some(col => col.Field === 'updated_by');
        const hasProjectId = columns.some(col => col.Field === 'project_id');

        // Migration: Drop redundant project_id if it exists
        if (hasProjectId) {
          console.log("Normalizing crm_tbl_followUpSummary: dropping redundant project_id column...");
          await runQueryOn(conn, "ALTER TABLE crm_tbl_followUpSummary DROP FOREIGN KEY IF EXISTS crm_tbl_followUpSummary_ibfk_2");
          await runQueryOn(conn, "ALTER TABLE crm_tbl_followUpSummary DROP COLUMN project_id", "Dropped project_id column", "Error dropping project_id column:");
        }

        if (hasId && !hasSummaryId) {
          console.log("Detected old 'id' column in crm_tbl_followUpSummary. Running migration...");
          
          // Rename primary key column
          await runQueryOn(conn, 
            "ALTER TABLE crm_tbl_followUpSummary CHANGE COLUMN id followup_summary_id INT AUTO_INCREMENT", 
            "Renamed id -> followup_summary_id", 
            "Error renaming column:"
          );

          // Add audit columns
          if (!hasUpdatedBy) {
            await runQueryOn(conn, 
              "ALTER TABLE crm_tbl_followUpSummary ADD COLUMN created_by INT NULL, ADD COLUMN updated_by INT NULL, ADD COLUMN updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP", 
              "Added audit columns to Followup Summary", 
              "Error adding audit columns:"
            );
          }
          console.log("crm_tbl_followUpSummary migration completed successfully!");
        } else if (!hasUpdatedBy) {
          // Table already uses followup_summary_id but missing audit columns
          await runQueryOn(conn, 
            "ALTER TABLE crm_tbl_followUpSummary ADD COLUMN created_by INT NULL, ADD COLUMN updated_by INT NULL, ADD COLUMN updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP", 
            "Added missing audit columns to Followup Summary", 
            "Error adding audit columns:"
          );
        } else {
          console.log("Followup Summary table is up to date.");
        }
      }
    } catch (e) {
      console.error("Error in createFollowupSummaryTable:", e);
    } finally {
      if (conn) conn.release();
    }
  };

  // AI Models (no dependencies)
  const createAiModelsTable = async () => {
    // Step 1: Create table
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
      "Error Creating AI Models Table:",
    );

    // Step 2: Insert default AI models if none exist
    const checkQuery = "SELECT COUNT(*) as count FROM crm_tbl_aiModels";
    const insertQuery = `INSERT INTO crm_tbl_aiModels (uuid, name, provider, model_id, api_key, is_default) VALUES (?, ?, ?, ?, ?, ?)`;

    return new Promise((resolve) => {
      db.query(checkQuery, async (err, result) => {
        if (err) {
          console.error("Error checking for AI models:", err);
          resolve();
          return;
        }

        if (result[0].count === 0) {
          try {
            // Seed: Llama 3 (Groq) - DEFAULT
            await new Promise((res, rej) => {
              db.query(
                insertQuery,
                [
                  uuidv4(),
                  "Llama 3 (Groq - Ultra Fast)",
                  "groq",
                  "llama-3.3-70b-versatile",
                  "YOUR_API_KEY_HERE",
                  1,
                ],
                (err) => (err ? rej(err) : res()),
              );
            });
            console.log("Seeded: Llama 3 (Groq - Ultra Fast) [DEFAULT]");

            resolve();
          } catch (error) {
            console.error("Error seeding AI models:", error);
            resolve();
          }
        } else {
          console.log("AI models already exist, skipping seed");
          resolve();
        }
      });
    });
  };

  const createClientsTable = async () => {
    let conn;
    try {
      conn = await getConnection();
      
      // Check if table exists and what columns it has
      const columns = await new Promise((resolve) => {
        conn.query("SHOW COLUMNS FROM crm_tbl_clients", (err, cols) => {
          if (err) resolve(null); // null means table doesn't exist
          else resolve(cols);
        });
      });

      if (!columns) {
        // Table doesn't exist - create fresh
        await runQueryOn(conn,
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
      } else {
        const hasCreatedBy = columns.some(col => col.Field === 'created_by');
        const hasUpdatedBy = columns.some(col => col.Field === 'updated_by');

        if (!hasCreatedBy || !hasUpdatedBy) {
          console.log("Detected missing audit columns in crm_tbl_clients. Running migration...");
          
          let alterQuery = "ALTER TABLE crm_tbl_clients ";
          let additions = [];
          if (!hasCreatedBy) additions.push("ADD COLUMN created_by INT NULL");
          if (!hasUpdatedBy) additions.push("ADD COLUMN updated_by INT NULL");
          
          alterQuery += additions.join(", ");
          
          await runQueryOn(conn, alterQuery, "Added audit columns to Clients", "Error adding audit columns to Clients:");
        } else {
          console.log("Clients table is up to date.");
        }
      }
    } catch (e) {
      console.error("Error in createClientsTable:", e);
    } finally {
      if (conn) conn.release();
    }
  };

  const createProjectsTable = async () => {
    let conn;
    try {
      conn = await getConnection();
      
      // Check if table exists and what columns it has
      const columns = await new Promise((resolve) => {
        conn.query("SHOW COLUMNS FROM crm_tbl_projects", (err, cols) => {
          if (err) resolve(null); // null means table doesn't exist
          else resolve(cols);
        });
      });

      if (!columns) {
        // Table doesn't exist - create fresh
        await runQueryOn(conn,
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
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            created_by INT NULL,
            updated_by INT NULL,
            CONSTRAINT fk_project_client
                FOREIGN KEY (client_id)
                REFERENCES crm_tbl_clients(client_id)
                ON DELETE CASCADE
                ON UPDATE CASCADE
          )`,
          "Projects Table Created",
          "Error Creating Projects Table:"
        );
      } else {
        const hasCreatedBy = columns.some(col => col.Field === 'created_by');
        const hasUpdatedBy = columns.some(col => col.Field === 'updated_by');

        if (!hasCreatedBy || !hasUpdatedBy) {
          console.log("Detected missing audit columns in crm_tbl_projects. Running migration...");
          
          let alterQuery = "ALTER TABLE crm_tbl_projects ";
          let additions = [];
          if (!hasCreatedBy) additions.push("ADD COLUMN created_by INT NULL");
          if (!hasUpdatedBy) additions.push("ADD COLUMN updated_by INT NULL");
          
          alterQuery += additions.join(", ");
          
          await runQueryOn(conn, alterQuery, "Added audit columns to Projects", "Error adding audit columns to Projects:");
        } else {
          console.log("Projects table is up to date.");
        }
      }
    } catch (e) {
      console.error("Error in createProjectsTable:", e);
    } finally {
      if (conn) conn.release();
    }
  };

  const createEnquiriesTable = () => {
    return runQuery(
      `CREATE TABLE IF NOT EXISTS crm_tbl_enquiries (
          enquiry_id INT PRIMARY KEY AUTO_INCREMENT,
          uuid VARCHAR(100) UNIQUE NOT NULL,
          full_name VARCHAR(250),
          email VARCHAR(250),
          phone_number VARCHAR(20),
          website_url TEXT DEFAULT '',
          message TEXT,
          status ENUM('New', 'Hold', 'Dismissed', 'Converted') DEFAULT 'New',
          remarks TEXT DEFAULT '',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          created_by INT NULL,
          updated_by INT NULL
      )`,
      "Enquiries Table Created",
      "Error Creating Enquiries Table:",
    );
  };

  // Create all tables in correct order (sequential)
  const createAllTables = async () => {
    try {
      // ORDER IS LOAD-BEARING: each table may reference one created before it via foreign keys.
      // crm_tbl_leads must exist before crm_tbl_clients and crm_tbl_followups;
      // crm_tbl_clients must exist before crm_tbl_projects;
      // crm_tbl_followups must exist before crm_tbl_followUpSummary.
      // FK checks are managed inside createLeadsTable() on a dedicated connection;
      // no pool-level SET FOREIGN_KEY_CHECKS is needed here.
      await createUsersTable();
      await createEnquiriesTable();
      await createLeadsTable();
      await createAiModelsTable();
      await createClientsTable();
      await createProjectsTable();
      await createNewFollowupsTable();
      await createFollowupSummaryTable();

      console.log("Database initialization and migration completed successfully.");
    } catch (error) {
      console.error("Critical error during database initialization:", error);
    }
  };

  module.exports = { createAllTables };