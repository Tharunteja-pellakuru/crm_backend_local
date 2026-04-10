const db = require("../config/db.js");
const { v4: uuidv4 } = require("uuid");
const { validateRequest } = require("../middleware/validation");

const pool = db.promise;

const getEnquiries = async (req, res) => {
  try {
    const query = `SELECT *, enquiry_id AS id FROM crm_tbl_enquiries ORDER BY enquiry_id DESC`;
    const [result] = await pool.query(query);
    res.status(200).json({ message: "Enquiries Fetched Successfully!", enquiries: result });
  } catch (err) {
    console.error("Error fetching enquiries:", err.message);
    res.status(500).json({ message: "Server Error!" });
  }
};

const addEnquiry = async (req, res) => {
  try {
    const uuid = uuidv4();
    const {
      full_name,
      email,
      phone_number,
      website_url,
      message,
      status = "New",
      remarks = "",
    } = req.body;

    // Validation
    const error = validateRequest(req.body, {
      full_name: { required: true, minLength: 2 },
      email: { required: true, pattern: /^\S+@\S+\.\S+$/ },
      phone_number: { required: true, minLength: 10 },
    });

    if (error) {
      return res.status(400).json({ message: error.message });
    }

    const admin_id = req.user?.admin_id || null;
    const query = `INSERT INTO crm_tbl_enquiries (uuid, full_name, email, phone_number, website_url, message, status, remarks, created_by) VALUES (?,?,?,?,?,?,?,?,?)`;

    const [result] = await pool.query(query, [
      uuid,
      full_name,
      email,
      phone_number,
      website_url,
      message,
      status,
      remarks,
      admin_id,
    ]);

    const [enquiries] = await pool.query("SELECT * FROM crm_tbl_enquiries WHERE enquiry_id = ?", [
      result.insertId,
    ]);

    res.status(201).json({
      message: "Enquiry Created Successfully!",
      enquiry: enquiries[0],
    });
  } catch (err) {
    console.error("Error creating enquiry:", err.message);
    res.status(500).json({ message: "Server Error!" });
  }
};

const updateEnquiryStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, remarks, message } = req.body;

    const admin_id = req.user?.admin_id || null;
    let query = `UPDATE crm_tbl_enquiries SET status = ?, updated_by = ?`;
    let params = [status, admin_id];

    if (remarks !== undefined) {
      query += `, remarks = ?`;
      params.push(remarks);
    }

    if (message !== undefined) {
      query += `, message = ?`;
      params.push(message);
    }

    query += ` WHERE enquiry_id = ? OR uuid = ?`;
    params.push(id, id);

    const [result] = await pool.query(query, params);

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "Enquiry Not Found!" });
    }

    // If status is restored to something other than Converted, delete the associated lead
    if (status !== "Converted") {
      try {
        const [rows] = await pool.query(
          "SELECT enquiry_id FROM crm_tbl_enquiries WHERE enquiry_id = ? OR uuid = ?",
          [id, id],
        );
        if (rows.length > 0) {
          const eid = rows[0].enquiry_id;
          await pool.query("DELETE FROM crm_tbl_leads WHERE enquiry_id = ?", [eid]);
        }
      } catch (leadErr) {
        console.error("Error deleting linked lead in updateEnquiryStatus:", leadErr.message);
      }
    }

    res.status(200).json({ message: "Enquiry Status Updated Successfully!" });
  } catch (err) {
    console.error("Error updating enquiry status:", err.message);
    res.status(500).json({ message: "Server Error!" });
  }
};

const deleteEnquiry = async (req, res) => {
  try {
    const { id } = req.params;

    // Fetch actual enquiry_id first
    const [rows] = await pool.query(
      "SELECT enquiry_id FROM crm_tbl_enquiries WHERE enquiry_id = ? OR uuid = ?",
      [id, id],
    );

    if (rows.length > 0) {
      const eid = rows[0].enquiry_id;
      // 1. Delete associated leads first to maintain order
      try {
        await pool.query("DELETE FROM crm_tbl_leads WHERE enquiry_id = ?", [eid]);
      } catch (leadErr) {
        console.error("Error deleting linked leads in deleteEnquiry:", leadErr.message);
      }
    }

    // 2. Delete the enquiry itself
    const query = `DELETE FROM crm_tbl_enquiries WHERE enquiry_id = ? OR uuid = ?`;
    const [result] = await pool.query(query, [id, id]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "Enquiry Not Found!" });
    }

    res.status(200).json({ message: "Enquiry Deleted Successfully!" });
  } catch (err) {
    console.error("Error deleting enquiry:", err.message);
    res.status(500).json({ message: "Server Error!" });
  }
};

module.exports = { getEnquiries, addEnquiry, updateEnquiryStatus, deleteEnquiry };
