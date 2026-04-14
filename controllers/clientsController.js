const db = require("../config/db");
const { v4: uuidv4 } = require("uuid");
const { validateRequest } = require("../middleware/validation");

// Use promise-based pool
const pool = db.promise;

const createClient = async (req, res) => {
  try {
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
      client_status: { required: true, enum: ["Active", "Inactive", "On Hold", "Completed", "Dropped"] },
      lead_id: { required: true },
    });

    if (error) {
      return res.status(400).json({ message: error.message });
    }

    const uuid = uuidv4();
    const query =
      "INSERT INTO crm_tbl_clients (uuid,organisation_name,client_name,client_country,client_state,client_currency,client_status,lead_id,created_by) VALUES (?,?,?,?,?,?,?,?,?)";

    const [result] = await pool.query(query, [
      uuid,
      organisation_name,
      client_name,
      client_country,
      client_state,
      client_currency,
      client_status,
      lead_id,
      req.user.admin_id,
    ]);

    const clientId = result.insertId;

    // Update lead status if lead_id is provided
    if (lead_id) {
      try {
        const updateLeadQuery = "UPDATE crm_tbl_leads SET lead_status = 'Converted' WHERE lead_id = ?";
        await pool.query(updateLeadQuery, [lead_id]);
      } catch (leadErr) {
        console.error("Error updating lead status in createClient:", leadErr.message);
      }
    }

    const [clients] = await pool.query("SELECT * FROM crm_tbl_clients WHERE client_id = ?", [clientId]);

    res.status(201).json({
      message: "Client created successfully",
      client: clients[0],
    });
  } catch (err) {
    console.error("Error in createClient:", err.message);
    res.status(500).json({ message: "Failed to create client" });
  }
};

const updateClient = async (req, res) => {
  try {
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
      client_status: { required: true, enum: ["Active", "Inactive"] },
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
      client_status = ?,
      updated_by = ?
      WHERE client_id = ?`;

    const [result] = await pool.query(query, [
      organisation_name,
      client_name,
      client_country,
      client_state,
      client_currency,
      client_status,
      req.user.admin_id,
      id,
    ]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "Client Not Found!" });
    }

    res.status(200).json({ message: "Client Updated Successfully!" });
  } catch (err) {
    console.error("Database error updating client:", err.message);
    res.status(500).json({ message: "Failed to update client" });
  }
};

const getClients = async (req, res) => {
  try {
    const query = `
      SELECT 
        c.*, 
        c.client_id AS id,
        l.email, 
        l.phone_number AS phone,
        l.country_code AS country_code,
        l.website_url AS website,
        l.message AS brief_message
      FROM crm_tbl_clients c
      LEFT JOIN crm_tbl_leads l ON c.lead_id = l.lead_id
    `;
    const [result] = await pool.query(query);
    res.status(200).json(result);
  } catch (err) {
    console.error("Error fetching clients:", err.message);
    res.status(500).json({ message: "Failed to fetch clients" });
  }
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

  let connection;
  try {
    // Get a specialized connection for the transaction
    connection = await db.promise.getConnection();
    await connection.beginTransaction();

    // 1. Create Client
    const clientUuid = uuidv4();
    const clientQuery =
      "INSERT INTO crm_tbl_clients (uuid, organisation_name, client_name, client_country, client_state, client_currency, client_status, lead_id, created_by) VALUES (?,?,?,?,?,?,?,?,?)";

    const [clientResult] = await connection.query(clientQuery, [
      clientUuid,
      organisation_name,
      client_name,
      client_country || "",
      client_state || "",
      client_currency || "",
      client_status || "Active",
      lead_id,
      req.user.admin_id,
    ]);

    const clientId = clientResult.insertId;

    // 2. Create Project (Optional)
    if (project_name) {
      // Category is now managed at Project level only
      const effectiveCategory = project_category || 1;

      const projectUuid = uuidv4();
      const projectQuery =
        "INSERT INTO crm_tbl_projects (uuid, project_name, project_description, project_category, project_status, project_priority, project_budget, onboarding_date, deadline_date, scope_document, client_id, created_by) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)";

      await connection.query(projectQuery, [
        projectUuid,
        project_name,
        project_description || "",
        effectiveCategory,
        project_status || "In Progress",
        project_priority || "Medium",
        parseInt(project_budget) || 0,
        onboarding_date,
        deadline_date,
        scope_document || null,
        clientId,
        req.user.admin_id,
      ]);
    }

    // 3. Update Lead Status
    const updateLeadQuery = "UPDATE crm_tbl_leads SET lead_status = 'Converted' WHERE lead_id = ?";
    await connection.query(updateLeadQuery, [lead_id]);

    // Commit transaction
    await connection.commit();

    // Fetch final data to return
    const [clients] = await connection.query("SELECT * FROM crm_tbl_clients WHERE client_id = ?", [clientId]);
    const client = clients[0];

    const [projects] = await connection.query(
      "SELECT * FROM crm_tbl_projects WHERE client_id = ? ORDER BY project_id DESC LIMIT 1",
      [clientId],
    );

    res.status(201).json({
      message: "Lead converted successfully",
      client,
      project: projects.length > 0 ? formatProjectDates(projects[0]) : null,
    });
  } catch (err) {
    if (connection) await connection.rollback();
    console.error("Conversion error:", err);
    res.status(500).json({ message: "Failed to convert lead to client record." });
  } finally {
    if (connection) connection.release();
  }
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

const deleteClient = async (req, res) => {
  try {
    const { id } = req.params;

    const query = "DELETE FROM crm_tbl_clients WHERE client_id = ?";
    const [result] = await pool.query(query, [id]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "Client Not Found!" });
    }

    res.status(200).json({ message: "Client Deleted Successfully!" });
  } catch (err) {
    console.error("Database error deleting client:", err.message);
    res.status(500).json({ message: "Failed to delete client" });
  }
};

module.exports = { createClient, getClients, updateClient, convertLead, deleteClient };
