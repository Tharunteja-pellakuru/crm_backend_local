const db = require("../config/db.js");
const { v4: uuidv4 } = require("uuid");
const { validateRequest } = require("../middleware/validation");

const pool = db.promise;

// Extract only the numeric dial code with + prefix (e.g. "+91" from "India (+91)" or "91")
function sanitizeCountryCode(raw) {
  if (!raw) return null;
  const str = String(raw).trim();
  // If it already looks like +XX or +XXX (pure dial code), use it
  if (/^\+\d{1,4}$/.test(str)) return str;
  // Try to extract from formats like "+91 9988..." or "India (+91)"
  const match = str.match(/(\+\d{1,4})/);
  if (match) return match[1];
  // If it's just digits, prefix with +
  if (/^\d{1,4}$/.test(str)) return `+${str}`;
  // Return null if we can't parse it, to avoid DB error
  return null;
}

const createLead = async (req, res) => {
  try {
    const uuid = uuidv4();

    const {
      full_name,
      phone_number,
      lead_category,
      lead_status,
      website_url,
      email,
      message,
      country_code,
      enquiry_id,
    } = req.body;

    console.log(full_name, phone_number, lead_category, lead_status, website_url, email, message, country_code, enquiry_id);

    // Validation
    const error = validateRequest(req.body, {
      full_name: { required: true, minLength: 2 },
      lead_category: { required: true }
    });

    if (error) {
      return res.status(400).json({ message: error.message });
    }
    
    if (!email && !phone_number) {
      return res.status(400).json({ message: "Either email or phone number must be provided." });
    }

    const query = `INSERT INTO crm_tbl_leads (uuid, full_name,
      phone_number,
      lead_category,
      lead_status,
      website_url,
      email,     
      message,
      country_code,
      enquiry_id,
      created_by) VALUES (?,?,?,?,?,?,?,?,?,?,?)`;

    const sanitizedCode = sanitizeCountryCode(country_code);
    const [result] = await pool.query(query, [
      uuid,
      full_name,
      phone_number,
      lead_category,
      lead_status,
      website_url,
      email,
      message,
      sanitizedCode,
      enquiry_id,
      req.user.admin_id,
    ]);

    // Fetch the created lead to return it
    const [leads] = await pool.query(
      "SELECT * FROM crm_tbl_leads WHERE lead_id = ?",
      [result.insertId]
    );

    res.status(201).json({
      message: "Lead Created Successfully!.",
      lead: leads[0],
    });
  } catch (err) {
    console.error("Error creating lead:", err.message);
    res.status(500).json({ message: "Server Error!." });
  }
};

const updateLead = async (req, res) => {
  try {
    const { id: lead_id } = req.params;
    const updateData = req.body;

    // 1. Fetch current lead data to merge
    const [rows] = await pool.query(
      "SELECT * FROM crm_tbl_leads WHERE lead_id = ? OR uuid = ?",
      [lead_id, lead_id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ message: "Lead Not Found" });
    }

    const currentLead = rows[0];
    const actualLeadId = currentLead.lead_id;

    // 2. Map frontend fields to backend columns and merge with current values
    const full_name = updateData.full_name || updateData.name || currentLead.full_name;
    const phone_number = updateData.phone_number || updateData.phone || currentLead.phone_number;
    const email = updateData.email || currentLead.email;
    const lead_status = updateData.lead_status || updateData.leadType || currentLead.lead_status;
    const message = updateData.message || updateData.notes || updateData.projectDescription || currentLead.message;
    const lead_category = updateData.lead_category || updateData.projectCategory || currentLead.lead_category;
    const website_url = updateData.website_url || updateData.website || currentLead.website_url;
    const country_code = sanitizeCountryCode(updateData.country_code || updateData.countryCode || currentLead.country_code);

    const updateQuery = `UPDATE crm_tbl_leads SET 
      full_name = ?, 
      phone_number = ?, 
      email = ?, 
      lead_status = ?, 
      message = ?, 
      lead_category = ?, 
      website_url = ?,
      country_code = ?,
      updated_by = ?
      WHERE lead_id = ?;`;

    await pool.query(updateQuery, [
      full_name,
      phone_number,
      email,
      lead_status,
      message,
      lead_category,
      website_url,
      country_code,
      req.user.admin_id,
      actualLeadId,
    ]);

    // Sync category to project table: lead -> client -> project(s)
    try {
      const [leadRows] = await pool.query(
        "SELECT lead_category FROM crm_tbl_leads WHERE lead_id = ?", [actualLeadId]
      );
      if (leadRows.length > 0) {
        const currentCategory = leadRows[0].lead_category;
        const [clientRows] = await pool.query(
          "SELECT client_id FROM crm_tbl_clients WHERE lead_id = ?", [actualLeadId]
        );
        if (clientRows.length > 0 && clientRows[0].client_id) {
          const clientId = clientRows[0].client_id;
          console.log(`[SYNC] Propagating category ${currentCategory} from Lead ${actualLeadId} to all projects for Client ${clientId}`);
          
          const [res] = await pool.query(
            "UPDATE crm_tbl_projects SET project_category = ? WHERE client_id = ?",
            [currentCategory, clientId]
          );
          console.log(`[SYNC] Updated ${res.affectedRows} projects for Client ${clientId}`);
        } else {
          console.log(`[SYNC] No associated client found for Lead ${actualLeadId}. Skipping project sync.`);
        }
      }
    } catch (syncErr) {
      console.error("[SYNC ERROR] Failed to propagate category change from lead:", syncErr.message);
    }

    // 3. Fetch the fully updated lead to return it (aliased for frontend)
    const [updatedLeads] = await pool.query(
      "SELECT *, lead_id AS id FROM crm_tbl_leads WHERE lead_id = ?",
      [actualLeadId]
    );

    res.status(200).json({
      message: "Lead Updated Successfully",
      lead: updatedLeads[0],
    });
  } catch (err) {
    console.error("Database error updating lead:", err.message);
    return res.status(500).json({ message: err.message });
  }
};

const getLeads = async (req, res) => {
  try {
    const query = `
      SELECT 
        l.*, 
        l.lead_id AS id,
        c.organisation_name AS client_organisation,
        c.client_state AS client_state,
        c.client_country AS client_country,
        c.client_currency AS client_currency
      FROM crm_tbl_leads l
      LEFT JOIN crm_tbl_clients c ON l.lead_id = c.lead_id
    `;
    const [result] = await pool.query(query);
    res.status(200).json({ message: "Leads Fetched Successfully!.", leads: result });
  } catch (err) {
    console.error("Error fetching leads:", err.message);
    res.status(500).json({ message: err.message });
  }
};

const deleteLead = async (req, res) => {
  try {
    const { id: lead_id } = req.params;

    // Fetch the lead to get its associated enquiry_id before deleting
    const [rows] = await pool.query(
      "SELECT enquiry_id FROM crm_tbl_leads WHERE lead_id = ? OR uuid = ?",
      [lead_id, lead_id]
    );

    if (rows.length > 0) {
      const eid = rows[0].enquiry_id;
      if (eid) {
        // Delete original enquiry to maintain sync
        try {
          await pool.query("DELETE FROM crm_tbl_enquiries WHERE enquiry_id = ?", [eid]);
        } catch (deleteEnqErr) {
          console.error("Error deleting related enquiry in deleteLead:", deleteEnqErr.message);
        }
      }
    }

    const query = `DELETE FROM crm_tbl_leads WHERE lead_id = ? OR uuid = ?;`;
    const [result] = await pool.query(query, [lead_id, lead_id]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "Lead Not Found!." });
    }
    
    res.status(200).json({ message: "Lead Deleted Successfully!." });
  } catch (err) {
    console.error("Database error deleting lead:", err.message);
    return res.status(500).json({ message: err.message });
  }
};

module.exports = { createLead, updateLead, getLeads, deleteLead };
