const db = require("../config/db");
const { v4: uuidv4 } = require("uuid");
const { validateRequest } = require("../middleware/validation");

const pool = db.promise;

const capitalize = (s) => {
  if (!s) return s;
  let lower = s.toLowerCase();
  if (lower === "rescheduled") lower = "reschedule";
  return lower.charAt(0).toUpperCase() + lower.slice(1);
};

// Helper to resolve lead_id from either lead_id or client_id
const resolveLeadId = async (id) => {
  if (!id) return null;
  // First check if it's a valid lead_id
  const [leads] = await pool.query("SELECT lead_id FROM crm_tbl_leads WHERE lead_id = ?", [id]);
  if (leads.length > 0) {
    return id;
  }
  // If not found in leads, check if it's a client_id and get its lead_id
  const [clients] = await pool.query("SELECT lead_id FROM crm_tbl_clients WHERE client_id = ?", [id]);
  if (clients.length > 0) {
    return clients[0].lead_id;
  }
  return id; // Fallback
};

const createNewFollowup = async (req, res) => {
  try {
    const {
      clientId,
      title,
      description,
      followup_date,
      followup_mode,
      followup_status,
      follow_brief,
      priority,
      projectId,
      completed_by,
    } = req.body;

    const error = validateRequest(req.body, {
      clientId: { required: !req.body.projectId },
      title: { required: true, minLength: 2 },
      followup_date: { required: true },
      followup_mode: { required: true, enum: ["Call", "Email", "Whatsapp", "Meeting"] },
      followup_status: { required: true, enum: ["Pending", "Completed", "Reschedule", "Cancelled"] },
      priority: { required: true, enum: ["High", "Medium", "Low"] },
    });

    if (error) {
      return res.status(400).json({ message: error.message });
    }

    const uuid = uuidv4();
    const query = `
        INSERT INTO crm_tbl_followups (
          uuid, followup_title, followup_description, followup_datetime, 
          followup_mode, followup_status, followup_priority, lead_id, project_id, created_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;

    const formattedStatus = capitalize(followup_status || "Pending");
    const formattedMode = capitalize(followup_mode || "Call");
    const formattedPriority = capitalize(priority || "Medium");

    const resolvedLeadId = await resolveLeadId(clientId);
    const leadIdToInsert = projectId ? null : resolvedLeadId;

    const [result] = await pool.query(query, [
      uuid,
      title,
      description,
      followup_date,
      formattedMode,
      formattedStatus,
      formattedPriority,
      leadIdToInsert,
      projectId || null,
      req.user.admin_id,
    ]);

    const followupId = result.insertId;

    // If status is "Completed", also update/insert into crm_tbl_followUpSummary
    if (formattedStatus === "Completed") {
      const summaryUuid = uuidv4();
      const querySummary = `
              INSERT INTO crm_tbl_followUpSummary (uuid, followup_id, conclusion_message, completed_at, completed_by, created_by)
              VALUES (?, ?, ?, ?, ?, ?)
            `;

      const formattedCompletedAt = new Date().toISOString().slice(0, 19).replace("T", " ");

      try {
        await pool.query(querySummary, [
          summaryUuid,
          followupId,
          follow_brief || "",
          formattedCompletedAt,
          completed_by || "System",
          req.user.admin_id,
        ]);
      } catch (summaryErr) {
        console.error("Error saving initial followup summary in createNewFollowup:", summaryErr.message);
      }
    }

    res.status(201).json({
      message: "Followup created successfully",
      followup: { id: followupId, uuid, ...req.body },
    });
  } catch (err) {
    console.error("Error in createNewFollowup:", err.message);
    res.status(500).json({ message: "Internal server error" });
  }
};

const getAllFollowups = async (req, res) => {
  try {
    const query = `
      SELECT f.*, s.conclusion_message as follow_brief, s.completed_at, s.completed_by, 
             p.project_name as projectName, p.client_id as mappedClientId,
             COALESCE(f.lead_id, (SELECT lead_id FROM crm_tbl_clients WHERE client_id = p.client_id)) as originalLeadId
      FROM crm_tbl_followups f
      LEFT JOIN crm_tbl_followUpSummary s ON f.followup_id = s.followup_id
      LEFT JOIN crm_tbl_projects p ON f.project_id = p.project_id
      ORDER BY f.followup_datetime ASC
    `;
    const [results] = await pool.query(query);

    const transformedResults = results.map((f) => ({
      id: f.followup_id,
      uuid: f.uuid,
      leadId: f.originalLeadId || f.lead_id,
      clientId: f.mappedClientId || f.lead_id,
      projectId: f.project_id,
      projectName: f.projectName,
      title: f.followup_title,
      description: f.followup_description,
      dueDate: f.followup_datetime,
      followup_mode: f.followup_mode,
      status: f.followup_status.toLowerCase(),
      priority: f.followup_priority,
      follow_brief: f.follow_brief,
      completed_at: f.completed_at,
      completed_by: f.completed_by,
    }));
    res.status(200).json(transformedResults);
  } catch (err) {
    console.error("Error fetching followups:", err.message);
    res.status(500).json({ message: "Database error" });
  }
};

const updateFollowup = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      title,
      description,
      followup_date,
      followup_mode,
      followup_status,
      priority,
      follow_brief,
      completed_at,
      completed_by,
      projectId,
    } = req.body;

    const error = validateRequest(req.body, {
      title: { required: true, minLength: 2 },
      followup_date: { required: true },
      followup_mode: { required: true, enum: ["Call", "Email", "Whatsapp", "Meeting"] },
      followup_status: { required: true, enum: ["Pending", "Completed", "Reschedule", "Cancelled"] },
      priority: { required: true, enum: ["High", "Medium", "Low"] },
    });

    if (error) {
      return res.status(400).json({ message: error.message });
    }

    const query = `
      UPDATE crm_tbl_followups 
      SET followup_title = ?, followup_description = ?, followup_datetime = ?, 
          followup_mode = ?, followup_status = ?, followup_priority = ?, project_id = ?, updated_by = ?
      WHERE followup_id = ?
    `;

    const formattedStatus = capitalize(followup_status);
    const formattedMode = capitalize(followup_mode);
    const formattedPriority = capitalize(priority);

    await pool.query(query, [
      title,
      description,
      followup_date,
      formattedMode,
      formattedStatus,
      formattedPriority,
      projectId || null,
      req.user.admin_id,
      id,
    ]);

    // Update summary if needed
    if (formattedStatus === "Completed" && follow_brief !== undefined) {
      await pool.query("DELETE FROM crm_tbl_followUpSummary WHERE followup_id = ?", [id]);

      const summaryUuid = uuidv4();
      const formattedCompletedAt = completed_at
        ? completed_at.replace("T", " ").slice(0, 19)
        : new Date().toISOString().slice(0, 19).replace("T", " ");

      const querySummary = `
        INSERT INTO crm_tbl_followUpSummary (uuid, followup_id, conclusion_message, completed_at, completed_by, created_by)
        VALUES (?, ?, ?, ?, ?, ?)
      `;

      await pool.query(querySummary, [
        summaryUuid,
        id,
        follow_brief,
        formattedCompletedAt,
        completed_by || "System",
        req.user.admin_id,
      ]);
    } else {
      await pool.query("DELETE FROM crm_tbl_followUpSummary WHERE followup_id = ?", [id]);
    }

    res.status(200).json({ message: "Followup updated successfully" });
  } catch (err) {
    console.error("Error updating followup:", err.message);
    res.status(500).json({ message: "Database error" });
  }
};

const deleteFollowup = async (req, res) => {
  try {
    const { id } = req.params;

    // Delete associated summary first
    await pool.query("DELETE FROM crm_tbl_followUpSummary WHERE followup_id = ?", [id]);

    // Then delete the followup itself
    const query = "DELETE FROM crm_tbl_followups WHERE followup_id = ?";
    const [result] = await pool.query(query, [id]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "Followup Not Found" });
    }

    res.status(200).json({ message: "Followup and related summary deleted successfully" });
  } catch (err) {
    console.error("Error deleting followup:", err.message);
    res.status(500).json({ message: "Database error" });
  }
};

const toggleFollowupStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, brief, completed_at, completed_by } = req.body;

    const error = validateRequest(req.body, {
      status: { required: true, enum: ["Pending", "Completed", "Reschedule", "Cancelled"] },
    });

    if (error) {
      return res.status(400).json({ message: error.message });
    }

    const formattedStatus = capitalize(status);

    const queryUpdate =
      "UPDATE crm_tbl_followups SET followup_status = ?, updated_by = ? WHERE followup_id = ?";
    await pool.query(queryUpdate, [formattedStatus, req.user.admin_id, id]);

    // If status is "Completed", also update/insert into crm_tbl_followUpSummary
    if (formattedStatus === "Completed") {
      await pool.query("DELETE FROM crm_tbl_followUpSummary WHERE followup_id = ?", [id]);

      const summaryUuid = uuidv4();
      const querySummary = `
          INSERT INTO crm_tbl_followUpSummary (uuid, followup_id, conclusion_message, completed_at, completed_by, created_by)
          VALUES (?, ?, ?, ?, ?, ?)
        `;

      const finalCompletedAt = completed_at
        ? completed_at.replace("T", " ").slice(0, 19)
        : new Date().toISOString().slice(0, 19).replace("T", " ");

      await pool.query(querySummary, [
        summaryUuid,
        id,
        brief || "",
        finalCompletedAt,
        completed_by || "System",
        req.user.admin_id,
      ]);
    } else {
      await pool.query("DELETE FROM crm_tbl_followUpSummary WHERE followup_id = ?", [id]);
    }

    res.status(200).json({ message: "Followup status updated successfully" });
  } catch (err) {
    console.error("Error toggling followup status:", err.message);
    res.status(500).json({ message: "Database error" });
  }
};

const getClientFollowups = async (req, res) => {
  try {
    const { clientId } = req.params;

    if (!clientId) {
      return res.status(400).json({ message: "Client ID is required" });
    }

    const query = `
      SELECT f.*, s.conclusion_message as follow_brief, s.completed_at, s.completed_by, 
             p.project_name as projectName, p.client_id as mappedClientId,
             COALESCE(f.lead_id, (SELECT lead_id FROM crm_tbl_clients WHERE client_id = p.client_id)) as originalLeadId
      FROM crm_tbl_followups f
      LEFT JOIN crm_tbl_followUpSummary s ON f.followup_id = s.followup_id
      LEFT JOIN crm_tbl_projects p ON f.project_id = p.project_id
      WHERE f.lead_id = ? 
         OR f.lead_id = (SELECT lead_id FROM crm_tbl_clients WHERE client_id = ?)
         OR f.project_id IN (SELECT project_id FROM crm_tbl_projects WHERE client_id = ?)
      ORDER BY f.followup_datetime DESC
    `;

    const [results] = await pool.query(query, [clientId, clientId, clientId]);

    const transformedResults = results.map((f) => ({
      id: f.followup_id,
      uuid: f.uuid,
      leadId: f.originalLeadId || f.lead_id,
      clientId: f.mappedClientId || f.lead_id,
      projectId: f.project_id,
      projectName: f.projectName,
      title: f.followup_title,
      description: f.followup_description,
      dueDate: f.followup_datetime,
      followup_mode: f.followup_mode,
      status: f.followup_status.toLowerCase(),
      priority: f.followup_priority,
      follow_brief: f.follow_brief,
      completed_at: f.completed_at,
      completed_by: f.completed_by,
    }));

    res.status(200).json(transformedResults);
  } catch (err) {
    console.error("Error fetching client followups:", err.message);
    res.status(500).json({ message: "Database error" });
  }
};

module.exports = {
  createNewFollowup,
  getAllFollowups,
  updateFollowup,
  deleteFollowup,
  toggleFollowupStatus,
  getClientFollowups,
};
