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
      client_status: { required: true, enum: ["Active", "Inactive", "Dismissed"] },
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
        // First, save the current lead status as previous_lead_status
        await pool.query(
          "UPDATE crm_tbl_leads SET previous_lead_status = lead_status, lead_status = 'Converted' WHERE lead_id = ?",
          [lead_id]
        );
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
      client_state: { required: false },
      client_currency: { required: true },
      client_status: { required: true, enum: ["Active", "Inactive", "Dismissed"] },
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
      client_state || "",
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
        "INSERT INTO crm_tbl_projects (uuid, project_name, project_description, project_category, project_status, project_priority, project_budget, onboarding_date, deadline_date, scope_document, client_id, lead_id, created_by) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)";

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
        lead_id,
        req.user.admin_id,
      ]);
    }

    // 3. Update Lead Status (save previous status before converting)
    const updateLeadQuery = "UPDATE crm_tbl_leads SET previous_lead_status = lead_status, lead_status = 'Converted' WHERE lead_id = ?";
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

    // First, get the lead_id associated directly with this client
    const [clientRows] = await pool.query(
      "SELECT lead_id FROM crm_tbl_clients WHERE client_id = ?",
      [id]
    );

    const clientLeadId = clientRows.length > 0 ? clientRows[0].lead_id : null;

    // Next, get all lead_ids associated with projects of this client
    const [projectRows] = await pool.query(
      "SELECT lead_id FROM crm_tbl_projects WHERE client_id = ? AND lead_id IS NOT NULL",
      [id]
    );

    // Collect all unique lead IDs
    const leadIds = new Set();
    if (clientLeadId) leadIds.add(clientLeadId);
    projectRows.forEach(row => leadIds.add(row.lead_id));
    
    const uniqueLeadIds = Array.from(leadIds);

    // Find all projects for this client
    const [clientProjects] = await pool.query(
      "SELECT project_id FROM crm_tbl_projects WHERE client_id = ?",
      [id]
    );

    if (clientProjects.length > 0) {
      const projectIds = clientProjects.map(p => p.project_id);
      const projectPlaceholders = projectIds.map(() => "?").join(",");

      // 1. Get all followup_ids associated with these projects
      const [followups] = await pool.query(
        `SELECT followup_id FROM crm_tbl_followups WHERE project_id IN (${projectPlaceholders})`,
        projectIds
      );

      // 2. Delete associated summaries first
      if (followups.length > 0) {
        const followupIds = followups.map((f) => f.followup_id);
        const followupPlaceholders = followupIds.map(() => "?").join(",");
        try { 
          await pool.query(
            `DELETE FROM crm_tbl_followUpSummary WHERE followup_id IN (${followupPlaceholders})`,
            followupIds
          );
        } catch (summaryErr) {
          console.error("Error deleting related follow-up summaries in deleteClient:", summaryErr.message);
        }
      }

      // 3. Delete associated follow-ups for these projects
      try {
        await pool.query(
          `DELETE FROM crm_tbl_followups WHERE project_id IN (${projectPlaceholders})`,
          projectIds
        );
      } catch (followupErr) {
        console.error("Error deleting related follow-ups in deleteClient:", followupErr.message);
      }
    }

    // Delete the client (Projects will be cascade deleted)
    const query = "DELETE FROM crm_tbl_clients WHERE client_id = ?";
    const [result] = await pool.query(query, [id]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "Client Not Found!" });
    }

    // Update the status of all associated leads to 'Dismissed'
    if (uniqueLeadIds.length > 0) {
      const placeholders = uniqueLeadIds.map(() => '?').join(',');
      const updateLeadQuery = `
        UPDATE crm_tbl_leads 
        SET lead_status = 'Dismissed',
            previous_lead_status = NULL 
        WHERE lead_id IN (${placeholders})
      `;
      await pool.query(updateLeadQuery, uniqueLeadIds);
    }

    res.status(200).json({ message: "Client Deleted Successfully!" });
  } catch (err) {
    console.error("Database error deleting client:", err.message);
    res.status(500).json({ message: "Failed to delete client" });
  }
};

module.exports = { createClient, getClients, updateClient, convertLead, deleteClient };
