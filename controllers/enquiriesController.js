const db = require("../config/db.js");
const { v4: uuidv4 } = require("uuid");

const getEnquiries = (req, res) => {
  try {
    const query = `SELECT * FROM crm_tbl_enquiries ORDER BY enquiry_id DESC`;
    db.query(query, (err, result) => {
      if (err) {
        console.error("Error fetching enquiries:", err.message);
        return res.status(500).json({ message: err.message });
      }
      res.status(200).json({ message: "Enquiries Fetched Successfully!", enquiries: result });
    });
  } catch (err) {
    console.error("Server error fetching enquiries:", err.message);
    res.status(500).json({ message: "Server Error!" });
  }
};

const addEnquiry = (req, res) => {
  try {
    const uuid = uuidv4();
    const {
      full_name,
      email,
      phone_number,
      website_url,
      message,
      status = 'New',
      remarks = ''
    } = req.body;

    const query = `INSERT INTO crm_tbl_enquiries (uuid, full_name, email, phone_number, website_url, message, status, remarks) VALUES (?,?,?,?,?,?,?,?)`;

    db.query(
      query,
      [uuid, full_name, email, phone_number, website_url, message, status, remarks],
      (err, result) => {
        if (err) {
          console.error("Error creating enquiry:", err.message);
          return res.status(500).json({ message: err.message });
        }

        db.query(
          "SELECT * FROM crm_tbl_enquiries WHERE enquiry_id = ?",
          [result.insertId],
          (err, enquiries) => {
            if (err) {
              return res.status(201).json({ message: "Enquiry Created Successfully!", uuid: uuid });
            }
            res.status(201).json({
              message: "Enquiry Created Successfully!",
              enquiry: enquiries[0],
            });
          }
        );
      }
    );
  } catch (err) {
    console.error("Server error creating enquiry:", err.message);
    res.status(500).json({ message: "Server Error!" });
  }
};

const updateEnquiryStatus = (req, res) => {
  try {
    const { id } = req.params;
    const { status, remarks } = req.body;

    let query = `UPDATE crm_tbl_enquiries SET status = ?`;
    let params = [status];

    if (remarks !== undefined) {
      query += `, remarks = ?`;
      params.push(remarks);
    }

    query += ` WHERE enquiry_id = ? OR uuid = ?`;
    params.push(id, id);

    db.query(query, params, (err, result) => {
      if (err) {
        console.error("Error updating enquiry status:", err.message);
        return res.status(500).json({ message: err.message });
      }
      if (result.affectedRows === 0) {
        return res.status(404).json({ message: "Enquiry Not Found!" });
      }

      // If status is restored to something other than Converted, delete the associated lead
      if (status !== 'Converted') {
        db.query("SELECT enquiry_id FROM crm_tbl_enquiries WHERE enquiry_id = ? OR uuid = ?", [id, id], (err, rows) => {
          if (!err && rows.length > 0) {
            const eid = rows[0].enquiry_id;
            db.query("DELETE FROM crm_tbl_leads WHERE enquiry_id = ?", [eid], (err) => {
              if (err) console.error("Error deleting linked lead:", err.message);
            });
          }
        });
      }

      res.status(200).json({ message: "Enquiry Status Updated Successfully!" });
    });
  } catch (err) {
    console.error("Server error updating enquiry:", err.message);
    res.status(500).json({ message: "Server Error!" });
  }
};

const deleteEnquiry = (req, res) => {
  try {
    const { id } = req.params;

    // Fetch the actual enquiry_id to safely delete any linked leads
    db.query("SELECT enquiry_id FROM crm_tbl_enquiries WHERE enquiry_id = ? OR uuid = ?", [id, id], (selectErr, rows) => {
      if (!selectErr && rows.length > 0) {
        const eid = rows[0].enquiry_id;
        // Delete the associated lead, ensuring no orphaned leads if the enquiry is deleted
        db.query("DELETE FROM crm_tbl_leads WHERE enquiry_id = ?", [eid], (deleteErr) => {
          if (deleteErr) console.error("Error deleting linked lead:", deleteErr.message);
        });
      }

      const query = `DELETE FROM crm_tbl_enquiries WHERE enquiry_id = ? OR uuid = ?`;
      db.query(query, [id, id], (err, result) => {
        if (err) {
          console.error("Error deleting enquiry:", err.message);
          return res.status(500).json({ message: err.message });
        }
        if (result.affectedRows === 0) {
          return res.status(404).json({ message: "Enquiry Not Found!" });
        }
        res.status(200).json({ message: "Enquiry Deleted Successfully!" });
      });
    });
  } catch (err) {
    console.error("Server error deleting enquiry:", err.message);
    res.status(500).json({ message: "Server Error!" });
  }
};

module.exports = { getEnquiries, addEnquiry, updateEnquiryStatus, deleteEnquiry };
