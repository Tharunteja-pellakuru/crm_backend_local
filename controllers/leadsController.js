const db = require("../config/db.js");
const { v4: uuidv4 } = require("uuid");
const { validateRequest } = require("../middleware/validation");

const createLead = (req, res) => {
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
      enquiry_id) VALUES (?,?,?,?,?,?,?,?,?,?)`;

    db.query(
      query,
      [
        uuid,
        full_name,
        phone_number,
        lead_category,
        lead_status,
        website_url,
        email,
        message,
        country_code,
        enquiry_id,
      ],
      (err, result) => {
        if (err) {
          console.error("Error creating lead:", err.message);
          return res.status(500).json({ message: err.message });
        }

        // Fetch the created lead to return it
        db.query(
          "SELECT * FROM crm_tbl_leads WHERE lead_id = ?",
          [result.insertId],
          (err, leads) => {
            if (err) {
              return res
                .status(201)
                .json({ message: "Lead Created Successfully!.", uuid: uuid });
            }
            res.status(201).json({
              message: "Lead Created Successfully!.",
              lead: leads[0],
            });
          },
        );
      },
    );
  } catch (err) {
    res.status(500).json({ message: "Server Error!." });
  }
};

const updateLead = (req, res) => {
  try {
    const { id: lead_id } = req.params;
    const {
      full_name,
      phone_number,
      email,
      lead_status,
      message,
      lead_category,
      website_url,
      country_code,
    } = req.body;

    const query = `UPDATE crm_tbl_leads SET 
      full_name = ?, 
      phone_number = ?, 
      email = ?, 
      lead_status = ?, 
      message = ?, 
      lead_category = ?, 
      website_url = ?,
      country_code = ?
      WHERE lead_id = ?;`;

    db.query(
      query,
      [
        full_name,
        phone_number,
        email,
        lead_status,
        message,
        lead_category,
        website_url,
        country_code,
        lead_id,
      ],
      (err, result) => {
        if (err) {
          console.error("Database error updating lead:", err.message);
          return res.status(500).json({ message: err.message });
        }
        if (result.affectedRows === 0) {
          return res.status(404).json({ message: "Lead Not Found!." });
        }

        // Fetch the updated lead to return it
        db.query(
          "SELECT * FROM crm_tbl_leads WHERE lead_id = ?",
          [lead_id],
          (err, leads) => {
            if (err) {
              return res
                .status(200)
                .json({ message: "Lead Updated Successfully!." });
            }
            res.status(200).json({
              message: "Lead Updated Successfully!.",
              lead: leads[0],
            });
          },
        );
      },
    );
  } catch (err) {
    console.error("Catch block error updating lead:", err.message);
    return res.status(500).json({ message: "Server Error!." });
  }
};

const getLeads = (req, res) => {
  try {
    const query = `SELECT * FROM crm_tbl_leads`;
    db.query(query, (err, result) => {
      if (err) {
        return res.status(500).json({ message: err.message });
      }
      res
        .status(200)
        .json({ message: "Leads Fetched Successfully!.", leads: result });
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const deleteLead = (req, res) => {
  try {
    const { id: lead_id } = req.params;

    // Fetch the lead to get its associated enquiry_id before deleting
    db.query("SELECT enquiry_id FROM crm_tbl_leads WHERE lead_id = ? OR uuid = ?", [lead_id, lead_id], (fetchErr, rows) => {
      if (!fetchErr && rows.length > 0) {
        const eid = rows[0].enquiry_id;
        if (eid) {
          // Delete original enquiry to maintain sync
          db.query("DELETE FROM crm_tbl_enquiries WHERE enquiry_id = ?", [eid], (deleteEnqErr) => {
            if (deleteEnqErr) console.error("Error deleting related enquiry:", deleteEnqErr.message);
          });
        }
      }

      const query = `DELETE FROM crm_tbl_leads WHERE lead_id = ? OR uuid = ?;`;
      db.query(query, [lead_id, lead_id], (err, result) => {
        if (err) {
          console.error("Database error deleting lead:", err.message);
          return res.status(500).json({ message: err.message });
        }
        if (result.affectedRows === 0) {
          return res.status(404).json({ message: "Lead Not Found!." });
        }
        res.status(200).json({ message: "Lead Deleted Successfully!." });
      });
    });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

module.exports = { createLead, updateLead, getLeads, deleteLead };
