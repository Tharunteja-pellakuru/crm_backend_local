const db = require("../config/db");
const { v4: uuidv4 } = require("uuid");
const { validateRequest } = require("../middleware/validation");

// Create new followup
const createNewFollowup = async (req, res) => {
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
  } = req.body;

  const error = validateRequest(req.body, {
    clientId: { required: true },
    title: { required: true, minLength: 2 },
    followup_date: { required: true },
    followup_mode: { required: true, enum: ['Call', 'Email', 'Whatsapp', 'Meeting'] },
    followup_status: { required: true, enum: ['Pending', 'Completed', 'Reschedule', 'Cancelled'] },
    priority: { required: true, enum: ['High', 'Medium', 'Low'] }
  });

  if (error) {
    return res.status(400).json({ message: error.message });
  }

  try {
    const uuid = uuidv4();
    const query = `
        INSERT INTO crm_tbl_followups (
          uuid, followup_title, followup_description, followup_datetime, 
          followup_mode, followup_status, followup_priority, lead_id, project_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;

    const capitalize = (s) => {
      if (!s) return s;
      let lower = s.toLowerCase();
      if (lower === "rescheduled") lower = "reschedule";
      return lower.charAt(0).toUpperCase() + lower.slice(1);
    };
    const formattedStatus = capitalize(followup_status || "Pending");
    const formattedMode = capitalize(followup_mode || "Call");
    const formattedPriority = capitalize(priority || "Medium");

    const resolveLeadId = (id, callback) => {
      // First check if it's a valid lead_id
      db.query("SELECT id FROM crm_tbl_leads WHERE id = ?", [id], (err, leads) => {
        if (!err && leads.length > 0) {
          return callback(id);
        }
        // If not found in leads, check if it's a client_id and get its lead_id
        db.query("SELECT lead_id FROM crm_tbl_clients WHERE client_id = ?", [id], (err, clients) => {
          if (!err && clients.length > 0) {
            return callback(clients[0].lead_id);
          }
          // Fallback to original ID and let DB handle constraint if it fails
          callback(id);
        });
      });
    };

    resolveLeadId(clientId, (finalLeadId) => {
      // If projectId is present, we prioritize it and set lead_id to null as per requirement
      const leadIdToInsert = projectId ? null : finalLeadId;
      
      db.query(
        query,
        [
          uuid,
          title,
          description,
          followup_date,
          formattedMode,
          formattedStatus,
          formattedPriority,
          leadIdToInsert,
          projectId || null,
        ],
        (err, result) => {
          if (err) {
            console.error("Error creating followup:", err);
            return res.status(500).json({ message: "Database error: " + err.message });
          }

          const followupId = result.insertId;

          // If status is "Completed", also update/insert into crm_tbl_followUpSummary
          if (formattedStatus === "Completed") {
            const summaryUuid = uuidv4();
            const querySummary = `
              INSERT INTO crm_tbl_followUpSummary (uuid, followup_id, project_id, conclusion_message, completed_at, completed_by)
              VALUES (?, ?, ?, ?, ?, ?)
            `;

            const formattedCompletedAt = new Date()
              .toISOString()
              .slice(0, 19)
              .replace("T", " ");

            db.query(
              querySummary,
              [
                summaryUuid,
                followupId,
                projectId || null,
                follow_brief || "",
                formattedCompletedAt,
                "System",
              ],
              (summaryErr) => {
                if (summaryErr) {
                  console.error(
                    "Error saving initial followup summary:",
                    summaryErr,
                  );
                }
                res.status(201).json({
                  message: "Followup created and summary saved",
                  followup: { id: followupId, uuid, ...req.body },
                });
              },
            );
          } else {
            res.status(201).json({
              message: "Followup created successfully",
              followup: { id: followupId, uuid, ...req.body },
            });
          }
        },
      );
    });
  } catch (error) {
    console.error("Error in createNewFollowup:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// Get all followups
const getAllFollowups = async (req, res) => {
  const query = `
    SELECT f.*, s.conclusion_message as follow_brief, s.completed_at, s.completed_by, 
           p.project_name as projectName, p.client_id as mappedClientId,
           COALESCE(f.lead_id, (SELECT lead_id FROM crm_tbl_clients WHERE client_id = p.client_id)) as originalLeadId
    FROM crm_tbl_followups f
    LEFT JOIN crm_tbl_followUpSummary s ON f.id = s.followup_id
    LEFT JOIN crm_tbl_projects p ON f.project_id = p.project_id
    ORDER BY f.followup_datetime ASC
  `;
  db.query(query, (err, results) => {
    if (err) {
      console.error("Error fetching followups:", err);
      return res.status(500).json({ message: "Database error" });
    }
    const transformedResults = results.map((f) => ({
      id: f.id,
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
  });
};

// Update followup
const updateFollowup = async (req, res) => {
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
    followup_mode: { required: true, enum: ['Call', 'Email', 'Whatsapp', 'Meeting'] },
    followup_status: { required: true, enum: ['Pending', 'Completed', 'Reschedule', 'Cancelled'] },
    priority: { required: true, enum: ['High', 'Medium', 'Low'] }
  });

  if (error) {
    return res.status(400).json({ message: error.message });
  }

  const query = `
    UPDATE crm_tbl_followups 
    SET followup_title = ?, followup_description = ?, followup_datetime = ?, 
        followup_mode = ?, followup_status = ?, followup_priority = ?, project_id = ?
    WHERE id = ?
  `;

  const capitalize = (s) => {
    if (!s) return s;
    let lower = s.toLowerCase();
    if (lower === "rescheduled") lower = "reschedule";
    return lower.charAt(0).toUpperCase() + lower.slice(1);
  };
  const formattedStatus = capitalize(followup_status);
  const formattedMode = capitalize(followup_mode);
  const formattedPriority = capitalize(priority);

  db.query(
    query,
    [
      title,
      description,
      followup_date,
      formattedMode,
      formattedStatus,
      formattedPriority,
      projectId || null,
      id,
    ],
    (err, result) => {
      if (err) {
        console.error("Error updating followup:", err);
        return res.status(500).json({ message: "Database error" });
      }

      if (formattedStatus === "Completed" && follow_brief !== undefined) {
        // DELETE then INSERT to avoid duplication issues
        const deleteSummaryQuery =
          "DELETE FROM crm_tbl_followUpSummary WHERE followup_id = ?";
        db.query(deleteSummaryQuery, [id], (deleteErr) => {
          if (deleteErr) {
            console.error("Error deleting old summary in edit:", deleteErr);
          }

          const summaryUuid = uuidv4();
          const formattedCompletedAt = completed_at
            ? completed_at.replace("T", " ").slice(0, 19)
            : new Date().toISOString().slice(0, 19).replace("T", " ");

          const querySummary = `
            INSERT INTO crm_tbl_followUpSummary (uuid, followup_id, project_id, conclusion_message, completed_at, completed_by)
            VALUES (?, ?, (SELECT project_id FROM crm_tbl_followups WHERE id = ?), ?, ?, ?)
          `;

          db.query(
            querySummary,
            [
              summaryUuid,
              id,
              id,
              follow_brief,
              formattedCompletedAt,
              completed_by || "System",
            ],
            (summaryErr) => {
              if (summaryErr) {
                console.error(
                  "Error saving followup summary in edit:",
                  summaryErr,
                );
              }
              res
                .status(200)
                .json({ message: "Followup updated successfully" });
            },
          );
        });
      } else {
        const deleteSummaryQuery =
          "DELETE FROM crm_tbl_followUpSummary WHERE followup_id = ?";
        db.query(deleteSummaryQuery, [id], (summaryErr) => {
          if (summaryErr) {
            console.error(
              "Error deleting old followup summary on status change:",
              summaryErr,
            );
          }
          res.status(200).json({ message: "Followup updated successfully" });
        });
      }
    },
  );
};

const deleteFollowup = async (req, res) => {
  const { id } = req.params;

  // First delete associated summary if it exists
  const deleteSummaryQuery =
    "DELETE FROM crm_tbl_followUpSummary WHERE followup_id = ?";
  db.query(deleteSummaryQuery, [id], (summaryErr) => {
    if (summaryErr) {
      console.error("Error deleting followup summary:", summaryErr);
      return res
        .status(500)
        .json({ message: "Database error while deleting summary" });
    }

    // Then delete the followup itself
    const query = "DELETE FROM crm_tbl_followups WHERE id = ?";
    db.query(query, [id], (err, result) => {
      if (err) {
        console.error("Error deleting followup:", err);
        return res.status(500).json({ message: "Database error" });
      }
      res
        .status(200)
        .json({ message: "Followup and related summary deleted successfully" });
    });
  });
};

// Toggle status
const toggleFollowupStatus = async (req, res) => {
  const { id } = req.params;
  const { status, brief, completed_at, completed_by } = req.body;

  const error = validateRequest(req.body, {
    status: { required: true, enum: ['Pending', 'Completed', 'Reschedule', 'Cancelled'] }
  });

  if (error) {
    return res.status(400).json({ message: error.message });
  }

  const capitalize = (s) => {
    if (!s) return s;
    let lower = s.toLowerCase();
    if (lower === "rescheduled") lower = "reschedule";
    return lower.charAt(0).toUpperCase() + lower.slice(1);
  };
  const formattedStatus = capitalize(status);

  // Use a transaction or sequential execution
  const queryUpdate =
    "UPDATE crm_tbl_followups SET followup_status = ? WHERE id = ?";
  db.query(queryUpdate, [formattedStatus, id], (err, result) => {
    if (err) {
      console.error("Error toggling followup status:", err);
      return res.status(500).json({ message: "Database error" });
    }

    // If status is "Completed", also update/insert into crm_tbl_followUpSummary
    if (formattedStatus === "Completed") {
      // DELETE then INSERT to avoid duplication issues
      const deleteSummaryQuery =
        "DELETE FROM crm_tbl_followUpSummary WHERE followup_id = ?";
      db.query(deleteSummaryQuery, [id], (deleteErr) => {
        if (deleteErr) {
          console.error("Error deleting old summary in toggle:", deleteErr);
        }

        const summaryUuid = uuidv4();
        const querySummary = `
          INSERT INTO crm_tbl_followUpSummary (uuid, followup_id, project_id, conclusion_message, completed_at, completed_by)
          VALUES (?, ?, (SELECT project_id FROM crm_tbl_followups WHERE id = ?), ?, ?, ?)
        `;

        db.query(
          querySummary,
          [
            summaryUuid,
            id,
            id,
            brief || "",
            completed_at
              ? completed_at.replace("T", " ").slice(0, 19)
              : new Date()
                  .toLocaleString("sv-SE")
                  .replace(" ", "T")
                  .slice(0, 19)
                  .replace("T", " "),
            completed_by || "System",
          ],
          (summaryErr) => {
            if (summaryErr) {
              console.error(
                "Error saving followup summary in toggle:",
                summaryErr,
              );
            }
            res
              .status(200)
              .json({ message: "Followup status and summary updated" });
          },
        );
      });
    } else {
      const deleteSummaryQuery =
        "DELETE FROM crm_tbl_followUpSummary WHERE followup_id = ?";
      db.query(deleteSummaryQuery, [id], (summaryErr) => {
        if (summaryErr) {
          console.error(
            "Error deleting old followup summary on status toggle:",
            summaryErr,
          );
        }
        res.status(200).json({ message: "Followup status updated" });
      });
    }
  });
};

// Get followups for a specific client (including lead history)
const getClientFollowups = async (req, res) => {
  const { clientId } = req.params;

  if (!clientId) {
    return res.status(400).json({ message: "Client ID is required" });
  }

  const query = `
    SELECT f.*, s.conclusion_message as follow_brief, s.completed_at, s.completed_by, 
           p.project_name as projectName, p.client_id as mappedClientId,
           COALESCE(f.lead_id, (SELECT lead_id FROM crm_tbl_clients WHERE client_id = p.client_id)) as originalLeadId
    FROM crm_tbl_followups f
    LEFT JOIN crm_tbl_followUpSummary s ON f.id = s.followup_id
    LEFT JOIN crm_tbl_projects p ON f.project_id = p.project_id
    WHERE f.lead_id = ? 
       OR f.lead_id = (SELECT lead_id FROM crm_tbl_clients WHERE client_id = ?)
       OR f.project_id IN (SELECT project_id FROM crm_tbl_projects WHERE client_id = ?)
    ORDER BY f.followup_datetime DESC
  `;

  db.query(query, [clientId, clientId, clientId], (err, results) => {
    if (err) {
      console.error("Error fetching client followups:", err);
      return res.status(500).json({ message: "Database error" });
    }

    const transformedResults = results.map((f) => ({
      id: f.id,
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
  });
};

module.exports = {
  createNewFollowup,
  getAllFollowups,
  updateFollowup,
  deleteFollowup,
  toggleFollowupStatus,
  getClientFollowups,
};
