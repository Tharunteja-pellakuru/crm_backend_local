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

    // Determine lead_id: prioritize request body, fallback to client record
    let lead_id = req.body.lead_id || null;
    
    if (!lead_id) {
      try {
        const [clientRows] = await pool.query(
          "SELECT lead_id FROM crm_tbl_clients WHERE client_id = ?",
          [client_id]
        );
        if (clientRows.length > 0) {
          lead_id = clientRows[0].lead_id;
        }
      } catch (clientErr) {
        console.error("Error fetching client lead_id in createProject:", clientErr.message);
      }
    }

    // Category is now managed at Project level only
    const effectiveCategory = project_category;

    const query =
      "INSERT INTO crm_tbl_projects (uuid,project_name,project_description,project_category,project_status,project_priority,project_budget,onboarding_date,deadline_date,scope_document,client_id,lead_id,created_by) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)";

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
      lead_id,
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

    // 1. First, get all followup_ids associated with this project
    const [followups] = await pool.query(
      "SELECT followup_id FROM crm_tbl_followups WHERE project_id = ?",
      [id]
    );

    // 2. Delete associated summaries first (before deleting followups)
    if (followups.length > 0) {
      const followupIds = followups.map((f) => f.followup_id);
      const placeholders = followupIds.map(() => "?").join(",");
      try {
        await pool.query(
          `DELETE FROM crm_tbl_followUpSummary WHERE followup_id IN (${placeholders})`,
          followupIds
        );
      } catch (summaryErr) {
        console.error("Error deleting related follow-up summaries in deleteProject:", summaryErr.message);
      }
    }

    // 3. Delete associated follow-ups
    try {
      await pool.query("DELETE FROM crm_tbl_followups WHERE project_id = ?", [id]);
    } catch (followupErr) {
      console.error("Error deleting related follow-ups in deleteProject:", followupErr.message);
    }

    // 4. Finally delete the project itself
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
