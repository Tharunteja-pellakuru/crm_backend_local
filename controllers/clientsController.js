const db = require("../config/db");
const { v4: uuidv4 } = require("uuid");
const { validateRequest } = require("../middleware/validation");

const createClient = (req, res) => {
  const {
    organisation_name,
    client_name,
    client_country,
    client_state,
    client_currency,
    client_status,
    lead_id,
  } = req.body;

  const error = validateRequest(req.body, {
    organisation_name: { required: true },
    client_name: { required: true },
    client_country: { required: true },
    client_state: { required: true },
    client_currency: { required: true },
    client_status: { required: true, enum: ['Active', 'Inactive', 'On Hold', 'Completed', 'Dropped'] },
    lead_id: { required: true }
  });

  if (error) {
    return res.status(400).json({ message: error.message });
  }
  const uuid = uuidv4();
  const query =
    "INSERT INTO crm_tbl_clients (uuid,organisation_name,client_name,client_country,client_state,client_currency,client_status,lead_id) VALUES (?,?,?,?,?,?,?,?)";
  db.query(
    query,
    [
      uuid,
      organisation_name,
      client_name,
      client_country,
      client_state,
      client_currency,
      client_status,
      lead_id,
    ],
    (err, result) => {
      if (err) {
        console.log(err);
        return res.status(500).json({ message: "Failed to create client" });
      }

      const clientId = result.insertId;

      // Update lead status if lead_id is provided
      if (lead_id) {
        const updateLeadQuery =
          "UPDATE crm_tbl_leads SET lead_status = 'Converted' WHERE lead_id = ?";
        db.query(updateLeadQuery, [lead_id], (leadErr) => {
          if (leadErr) {
            console.error("Error updating lead status:", leadErr.message);
            // We don't return error here because client is already created
          }
        });
      }

      db.query(
        "SELECT * FROM crm_tbl_clients WHERE client_id = ?",
        [clientId],
        (err, clients) => {
          if (err) {
            return res
              .status(201)
              .json({ message: "Client created successfully", uuid });
          }
          res
            .status(201)
            .json({ message: "Client created successfully", client: clients[0] });
        },
      );
    },
  );
};

const updateClient = (req, res) => {
  const { id } = req.params;
  const {
    organisation_name,
    client_name,
    client_country,
    client_state,
    client_currency,
    client_status,
  } = req.body;

  const error = validateRequest(req.body, {
    organisation_name: { required: true },
    client_name: { required: true },
    client_country: { required: true },
    client_state: { required: true },
    client_currency: { required: true },
    client_status: { required: true, enum: ['Active', 'Inactive'] }
  });

  if (error) {
    return res.status(400).json({ message: error.message });
  }

  const query = `UPDATE crm_tbl_clients SET 
    organisation_name = ?, 
    client_name = ?, 
    client_country = ?, 
    client_state = ?, 
    client_currency = ?, 
    client_status = ?
    WHERE client_id = ?`;

  db.query(
    query,
    [
      organisation_name,
      client_name,
      client_country,
      client_state,
      client_currency,
      client_status,
      id,
    ],
    (err, result) => {
      if (err) {
        console.error("Database error updating client:", err.message);
        return res.status(500).json({ message: "Failed to update client" });
      }
      if (result.affectedRows === 0) {
        return res.status(404).json({ message: "Client Not Found!" });
      }
      res.status(200).json({ message: "Client Updated Successfully!" });
    },
  );
};

const getClients = (req, res) => {
  const query = `
    SELECT 
      c.*, 
      l.email, 
      l.phone_number AS phone,
      l.country_code AS country_code,
      l.lead_category AS projectCategory,
      l.website_url AS website,
      l.message AS brief_message
    FROM crm_tbl_clients c
    LEFT JOIN crm_tbl_leads l ON c.lead_id = l.lead_id
  `;
  db.query(query, (err, result) => {
    if (err) {
      console.error("Error fetching clients:", err.message);
      return res.status(500).json({ message: "Failed to fetch clients" });
    }
    res.status(200).json(result);
  });
};

const convertLead = async (req, res) => {
  const {
    organisation_name,
    client_name,
    client_country,
    client_state,
    client_currency,
    client_status,
    lead_id,
    project_name,
    project_description,
    project_category,
    project_status,
    project_priority,
    project_budget,
    onboarding_date,
    deadline_date,
  } = req.body;

  const scope_document = req.file ? req.file.filename : req.body.scope_document;

  // Basic validation
  if (!organisation_name || !client_name || !lead_id) {
    return res.status(400).json({ message: "Missing required client information." });
  }

  db.getConnection((err, connection) => {
    if (err) {
      console.error("Error getting connection:", err);
      return res.status(500).json({ message: "Database connection failed" });
    }

    connection.beginTransaction((err) => {
      if (err) {
        connection.release();
        return res.status(500).json({ message: "Transaction failed" });
      }

      // 1. Create Client
      const clientUuid = uuidv4();
      const clientQuery =
        "INSERT INTO crm_tbl_clients (uuid, organisation_name, client_name, client_country, client_state, client_currency, client_status, lead_id) VALUES (?,?,?,?,?,?,?,?)";
      
      connection.query(
        clientQuery,
        [clientUuid, organisation_name, client_name, client_country || "", client_state || "", client_currency || "", client_status || "Active", lead_id],
        (err, clientResult) => {
          if (err) {
            return connection.rollback(() => {
              connection.release();
              console.error("Client creation error:", err);
              res.status(500).json({ message: "Failed to create client record." });
            });
          }

          const clientId = clientResult.insertId;

          // 2. Create Project if project_name exists
          if (project_name) {
            const projectUuid = uuidv4();
            const projectQuery =
              "INSERT INTO crm_tbl_projects (uuid, project_name, project_description, project_category, project_status, project_priority, project_budget, onboarding_date, deadline_date, scope_document, client_id) VALUES (?,?,?,?,?,?,?,?,?,?,?)";
            
            connection.query(
              projectQuery,
              [
                projectUuid,
                project_name,
                project_description || "",
                project_category || "Tech",
                project_status || "In Progress",
                project_priority || "Medium",
                parseInt(project_budget) || 0,
                onboarding_date,
                deadline_date,
                scope_document || null,
                clientId
              ],
              (err) => {
                if (err) {
                  return connection.rollback(() => {
                    connection.release();
                    console.error("Project creation error:", err);
                    res.status(500).json({ message: "Failed to create project record." });
                  });
                }
                
                // 3. Update Lead Status
                updateLeadAndCommit(connection, lead_id, res, clientId);
              }
            );
          } else {
            // No project to create, just update lead status
            updateLeadAndCommit(connection, lead_id, res, clientId);
          }
        }
      );
    });
  });
};

const updateLeadAndCommit = (connection, lead_id, res, clientId) => {
  const updateQuery = "UPDATE crm_tbl_leads SET lead_status = 'Converted' WHERE lead_id = ?";
  connection.query(updateQuery, [lead_id], (err) => {
    if (err) {
      return connection.rollback(() => {
        connection.release();
        console.error("Lead update error:", err);
        res.status(500).json({ message: "Failed to update lead status." });
      });
    }

    connection.commit((err) => {
      if (err) {
        return connection.rollback(() => {
          connection.release();
          res.status(500).json({ message: "Failed to commit transaction." });
        });
      }
      
      // Fetch the created client
      connection.query("SELECT * FROM crm_tbl_clients WHERE client_id = ?", [clientId], (err, clients) => {
        if (err) {
          connection.release();
          return res.status(201).json({ message: "Conversion successful, but failed to fetch client data." });
        }
        
        const client = clients[0];
        
        // Fetch the created project if it exists
        connection.query("SELECT * FROM crm_tbl_projects WHERE client_id = ? ORDER BY project_id DESC LIMIT 1", [clientId], (err, projects) => {
          connection.release();
          
          if (err || projects.length === 0) {
            return res.status(201).json({ 
              message: "Lead converted successfully", 
              client 
            });
          }
          
          res.status(201).json({ 
            message: "Lead converted successfully", 
            client,
            project: formatProjectDates(projects[0])
          });
        });
      });
    });
  });
};

const formatProjectDates = (project) => {
  if (!project) return project;
  const formatDateField = (dateVal) => {
    if (!dateVal) return null;
    if (typeof dateVal === "string") return dateVal.split("T")[0];
    if (dateVal instanceof Date) {
      const y = dateVal.getFullYear();
      const m = String(dateVal.getMonth() + 1).padStart(2, "0");
      const d = String(dateVal.getDate()).padStart(2, "0");
      return `${y}-${m}-${d}`;
    }
    return dateVal;
  };
  return {
    ...project,
    onboarding_date: formatDateField(project.onboarding_date),
    deadline_date: formatDateField(project.deadline_date),
  };
};

module.exports = { createClient, getClients, updateClient, convertLead };
