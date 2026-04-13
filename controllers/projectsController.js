const db = require("../config/db");
const { v4: uuidv4 } = require("uuid");
const { validateRequest } = require("../middleware/validation");

const pool = db.promise;

// Helper to safely format a MySQL DATE/DATETIME value to YYYY-MM-DD string.
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

// Helper to format date fields in a project object
const formatProjectDates = (project) => {
  if (!project) return project;
  return {
    ...project,
    onboarding_date: formatDateField(project.onboarding_date),
    deadline_date: formatDateField(project.deadline_date),
  };
};

const createProject = async (req, res) => {
  try {
    const {
      project_name,
      project_description,
      project_category,
      project_status,
      project_priority,
      project_budget,
      onboarding_date,
      deadline_date,
      client_id,
    } = req.body;

    const scope_document = req.file ? req.file.filename : req.body.scope_document;

    const error = validateRequest(req.body, {
      project_name: { required: true, minLength: 2 },
      project_category: { required: true },
      project_status: { required: true, enum: ["Hold", "In Progress", "Completed", "Planning"] },
      project_priority: { required: true },
      project_budget: { required: true, type: "number" },
      onboarding_date: { required: true },
      deadline_date: { required: true },
      client_id: { required: true },
    });

    if (error) {
      return res.status(400).json({ message: error.message });
    }

    // Validate date objects
    const oDate = new Date(onboarding_date);
    const dDate = new Date(deadline_date);

    if (isNaN(oDate.getTime())) {
      return res.status(400).json({ message: "Invalid onboarding date format." });
    }
    if (isNaN(dDate.getTime())) {
      return res.status(400).json({ message: "Invalid deadline date format." });
    }

    if (dDate < oDate) {
      return res.status(400).json({ message: "Deadline cannot be before onboarding date." });
    }

    const admin_id = req.user?.admin_id || null;
    const uuid = uuidv4();

    // Fetch lead category to ensure project starts with lead's category
    const [clientRows] = await pool.query(
      "SELECT lead_id FROM crm_tbl_clients WHERE client_id = ?",
      [client_id]
    );
    let effectiveCategory = project_category;
    if (clientRows.length > 0 && clientRows[0].lead_id) {
      const [leadRows] = await pool.query(
        "SELECT lead_category FROM crm_tbl_leads WHERE lead_id = ?",
        [clientRows[0].lead_id]
      );
      if (leadRows.length > 0) {
        effectiveCategory = leadRows[0].lead_category;
      }
    }

    const query =
      "INSERT INTO crm_tbl_projects (uuid,project_name,project_description,project_category,project_status,project_priority,project_budget,onboarding_date,deadline_date,scope_document,client_id,created_by) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)";

    const [result] = await pool.query(query, [
      uuid,
      project_name,
      project_description,
      effectiveCategory,
      project_status,
      project_priority,
      parseInt(project_budget) || 0,
      onboarding_date,
      deadline_date,
      scope_document,
      client_id,
      admin_id,
    ]);

    const projectId = result.insertId;
    const [projects] = await pool.query("SELECT * FROM crm_tbl_projects WHERE project_id = ?", [
      projectId,
    ]);

    res.status(201).json({
      message: "Project created successfully",
      project: formatProjectDates(projects[0]),
    });
  } catch (err) {
    console.error("Unhandled error in createProject:", err);
    res.status(500).json({ message: "An unexpected error occurred while creating project." });
  }
};

const updateProject = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      project_name,
      project_description,
      project_category,
      project_status,
      project_priority,
      project_budget,
      onboarding_date,
      deadline_date,
    } = req.body;

    const error = validateRequest(req.body, {
      project_name: { required: true, minLength: 2 },
      project_category: { required: true },
      project_status: { required: true, enum: ["Hold", "In Progress", "Completed", "Planning"] },
      project_priority: { required: true },
      project_budget: { required: true, type: "number" },
      onboarding_date: { required: true },
      deadline_date: { required: true },
    });

    if (error) {
      console.error("Validation error in updateProject:", error.message, req.body);
      return res.status(400).json({ message: error.message });
    }

    if (onboarding_date && deadline_date && new Date(deadline_date) < new Date(onboarding_date)) {
      return res.status(400).json({ message: "Deadline cannot be before onboarding date." });
    }

    const admin_id = req.user?.admin_id || null;
    const scope_document = req.file ? req.file.filename : req.body.scope_document;

    let query = `UPDATE crm_tbl_projects SET 
      project_name = ?, 
      project_description = ?, 
      project_category = ?, 
      project_status = ?, 
      project_priority = ?, 
      project_budget = ?, 
      onboarding_date = ?, 
      deadline_date = ?,
      updated_by = ?`;

    const queryParams = [
      project_name,
      project_description,
      project_category,
      project_status,
      project_priority,
      project_budget,
      onboarding_date,
      deadline_date,
      admin_id,
    ];

    if (scope_document) {
      query += `, scope_document = ?`;
      queryParams.push(scope_document);
    }

    query += ` WHERE project_id = ?`;
    queryParams.push(id);

    const [result] = await pool.query(query, queryParams);

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "Project Not Found!" });
    }

    // Sync category to lead table: project -> client -> lead
    try {
      // 1. Get the current project to find its client_id
      const [projectRows] = await pool.query(
        "SELECT client_id, project_category FROM crm_tbl_projects WHERE project_id = ?", [id]
      );
      
      if (projectRows.length > 0 && projectRows[0].client_id) {
        const clientId = projectRows[0].client_id;
        const currentCategory = projectRows[0].project_category;
        
        // 2. Find the lead associated with this client
        const [clientRows] = await pool.query(
          "SELECT lead_id FROM crm_tbl_clients WHERE client_id = ?", [clientId]
        );
        
        if (clientRows.length > 0 && clientRows[0].lead_id) {
          const leadId = clientRows[0].lead_id;
          
          console.log(`[SYNC] Propagating category ${currentCategory} from Project ${id} to Lead ${leadId}`);
          
          // 3. Update the lead's category
          await pool.query(
            "UPDATE crm_tbl_leads SET lead_category = ? WHERE lead_id = ?",
            [currentCategory, leadId]
          );
          
          // 4. Also sync ALL OTHER projects for this same client so they remain consistent
          const [multiSyncResult] = await pool.query(
            "UPDATE crm_tbl_projects SET project_category = ? WHERE client_id = ? AND project_id != ?",
            [currentCategory, clientId, id]
          );
          
          if (multiSyncResult.affectedRows > 0) {
            console.log(`[SYNC] Updated ${multiSyncResult.affectedRows} other projects for client ${clientId} to match category ${currentCategory}`);
          }
        } else {
          console.log(`[SYNC] No associated lead_id found for Client ${clientId}. Skipping lead sync.`);
        }
      } else {
        console.warn(`[SYNC] No client_id found for Project ${id}. Skipping sync.`);
      }
    } catch (syncErr) {
      console.error("[SYNC ERROR] Failed to propagate category change:", syncErr.message);
    }

    // Fetch and return the updated project
    const [projects] = await pool.query("SELECT * FROM crm_tbl_projects WHERE project_id = ?", [id]);

    res.status(200).json({
      message: "Project Updated Successfully!",
      project: formatProjectDates(projects[0]),
    });
  } catch (err) {
    console.error("Database error updating project:", err.message);
    res.status(500).json({ message: "Failed to update project" });
  }
};

const getProjects = async (req, res) => {
  try {
    const query = "SELECT *, project_id AS id FROM crm_tbl_projects";
    const [result] = await pool.query(query);
    res.status(200).json(result.map(formatProjectDates));
  } catch (err) {
    console.error("Error fetching projects:", err.message);
    res.status(500).json({ message: "Failed to fetch projects" });
  }
};

const updateProjectStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { project_status } = req.body;

    const error = validateRequest(req.body, {
      project_status: { required: true, enum: ["Hold", "In Progress", "Completed"] },
    });

    if (error) {
      return res.status(400).json({ message: error.message });
    }

    const admin_id = req.user?.admin_id || null;
    const query = "UPDATE crm_tbl_projects SET project_status = ?, updated_by = ? WHERE project_id = ?";
    const [result] = await pool.query(query, [project_status, admin_id, id]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "Project Not Found!" });
    }
    res.status(200).json({ message: "Project Status Updated Successfully!" });
  } catch (err) {
    console.error("Database error updating project status:", err.message);
    res.status(500).json({ message: "Failed to update project status" });
  }
};

const deleteProject = async (req, res) => {
  try {
    const { id } = req.params;

    // 1. Delete associated follow-ups (Foreign key in crm_tbl_followups)
    // No need to delete summaries by project_id as that column was dropped
    try {
      await pool.query("DELETE FROM crm_tbl_followups WHERE project_id = ?", [id]);
    } catch (followupErr) {
      console.error("Error deleting related follow-ups in deleteProject:", followupErr.message);
    }

    // 2. Finally delete the project itself
    const deleteProjectQuery = "DELETE FROM crm_tbl_projects WHERE project_id = ?";
    const [result] = await pool.query(deleteProjectQuery, [id]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "Project Not Found!" });
    }

    res.status(200).json({
      message: "Project and related data deleted successfully!",
    });
  } catch (err) {
    console.error("Database error deleting project:", err.message);
    res.status(500).json({ message: "Failed to delete project" });
  }
};

module.exports = {
  createProject,
  getProjects,
  updateProject,
  updateProjectStatus,
  deleteProject,
};
