const db = require("../config/db");
const { v4: uuidv4 } = require("uuid");

// Helper to safely format a MySQL DATE/DATETIME value to YYYY-MM-DD string.
// MySQL driver returns JS Date objects which get serialized as UTC,
// causing a 1-day shift for timezones ahead of UTC (e.g. IST=UTC+5:30).
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


const createProject = (req, res) => {
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

  if (
    !project_name ||
    !project_description ||
    !project_category ||
    !project_status ||
    !project_priority ||
    !project_budget ||
    !onboarding_date ||
    !deadline_date ||
    !client_id
  ) {
    return res.status(400).json({ message: "All fields are required" });
  }
  const uuid = uuidv4();
  const query =
    "INSERT INTO crm_tbl_projects (uuid,project_name,project_description,project_category,project_status,project_priority,project_budget,onboarding_date,deadline_date,scope_document,client_id) VALUES (?,?,?,?,?,?,?,?,?,?,?)";
  db.query(
    query,
    [
      uuid,
      project_name,
      project_description,
      project_category,
      project_status,
      project_priority,
      project_budget,
      onboarding_date,
      deadline_date,
      scope_document,
      client_id,
    ],
    (err, result) => {
      if (err) {
        console.log(err);
        return res.status(500).json({ message: "Failed to create project" });
      }
      
      const projectId = result.insertId;
      db.query(
        "SELECT * FROM crm_tbl_projects WHERE project_id = ?",
        [projectId],
        (err, projects) => {
          if (err) {
            return res.status(201).json({ message: "Project created successfully", uuid });
          }
          res.status(201).json({ message: "Project created successfully", project: formatProjectDates(projects[0]) });
        }
      );
    },
  );
};

const updateProject = (req, res) => {
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

  const scope_document = req.file ? req.file.filename : req.body.scope_document;

  let query = `UPDATE crm_tbl_projects SET 
    project_name = ?, 
    project_description = ?, 
    project_category = ?, 
    project_status = ?, 
    project_priority = ?, 
    project_budget = ?, 
    onboarding_date = ?, 
    deadline_date = ?`;
  
  const queryParams = [
    project_name,
    project_description,
    project_category,
    project_status,
    project_priority,
    project_budget,
    onboarding_date,
    deadline_date,
  ];

  if (scope_document) {
    query += `, scope_document = ?`;
    queryParams.push(scope_document);
  }

  query += ` WHERE project_id = ?`;
  queryParams.push(id);

  db.query(query, queryParams, (err, result) => {
    if (err) {
      console.error("Database error updating project:", err.message);
      return res.status(500).json({ message: "Failed to update project" });
    }
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "Project Not Found!" });
    }
    
    // Fetch and return the updated project
    db.query(
      "SELECT * FROM crm_tbl_projects WHERE project_id = ?",
      [id],
      (err, projects) => {
        if (err) {
          return res.status(200).json({ message: "Project Updated Successfully!" });
        }
        res.status(200).json({ 
          message: "Project Updated Successfully!", 
          project: formatProjectDates(projects[0]) 
        });
      }
    );
  });
};

const getProjects = (req, res) => {
  const query = "SELECT * FROM crm_tbl_projects";
  db.query(query, (err, result) => {
    if (err) {
      console.error("Error fetching projects:", err.message);
      return res.status(500).json({ message: "Failed to fetch projects" });
    }
    res.status(200).json(result.map(formatProjectDates));
  });
};

const updateProjectStatus = (req, res) => {
  const { id } = req.params;
  const { project_status } = req.body;

  if (!project_status) {
    return res.status(400).json({ message: "Project status is required" });
  }

  const query = "UPDATE crm_tbl_projects SET project_status = ? WHERE project_id = ?";
  db.query(query, [project_status, id], (err, result) => {
    if (err) {
      console.error("Database error updating project status:", err.message);
      return res.status(500).json({ message: "Failed to update project status" });
    }
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "Project Not Found!" });
    }
    res.status(200).json({ message: "Project Status Updated Successfully!" });
  });
};

const deleteProject = (req, res) => {
  const { id } = req.params;

  // 1. Delete associated follow-up summaries
  const deleteSummariesQuery = "DELETE FROM crm_tbl_followUpSummary WHERE project_id = ?";
  db.query(deleteSummariesQuery, [id], (summaryErr) => {
    if (summaryErr) {
      console.error("Error deleting related follow-up summaries:", summaryErr.message);
      // We continue to try deleting follow-ups even if summaries fail
    }

    // 2. Delete associated follow-ups
    const deleteFollowupsQuery = "DELETE FROM crm_tbl_followups WHERE project_id = ?";
    db.query(deleteFollowupsQuery, [id], (followupErr) => {
      if (followupErr) {
        console.error("Error deleting related follow-ups:", followupErr.message);
        return res.status(500).json({ message: "Failed to delete related follow-ups" });
      }

      // 3. Finally delete the project itself
      const deleteProjectQuery = "DELETE FROM crm_tbl_projects WHERE project_id = ?";
      db.query(deleteProjectQuery, [id], (err, result) => {
        if (err) {
          console.error("Database error deleting project:", err.message);
          return res.status(500).json({ message: "Failed to delete project" });
        }
        if (result.affectedRows === 0) {
          return res.status(404).json({ message: "Project Not Found!" });
        }
        res.status(200).json({ message: "Project and all related data deleted successfully!" });
      });
    });
  });
};

module.exports = { createProject, getProjects, updateProject, updateProjectStatus, deleteProject };
