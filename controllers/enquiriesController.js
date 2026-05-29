const db = require("../config/db.js");
const { v4: uuidv4 } = require("uuid");
const { validateRequest } = require("../middleware/validation");
const jwt = require("jsonwebtoken");
const { JWT_SECRET } = require("../middleware/authMiddleware");

const pool = db.promise;

const getEnquiries = async (req, res) => {
  try {
    const query = `
      SELECT 
        e.*,
        e.enquiry_id AS id,
        a.full_name AS created_by_name
      FROM crm_tbl_enquiries e
      LEFT JOIN crm_tbl_admins a ON e.created_by = a.admin_id
      ORDER BY e.enquiry_id DESC
    `;
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
      source = "",
      message,
      status = "New",
      remarks = "",
    } = req.body;

    // Validation
    const error = validateRequest(req.body, {
      full_name: { required: true, minLength: 2 },
      email: { required: false, pattern: /^\S+@\S+\.\S+$/ },
      phone_number: { required: true, minLength: 10 },
      source: { required: false },
    });

    if (error) {
      return res.status(400).json({ message: error.message });
    }

    let admin_id = null;
    const authHeader = req.headers["authorization"];
    const token = authHeader && authHeader.split(" ")[1];
    if (token) {
      try {
        const decoded = jwt.verify(token, JWT_SECRET);
        admin_id = decoded.admin_id;
      } catch (err) {
        // Ignore token errors, treat as unauthenticated
      }
    }

    const query = `INSERT INTO crm_tbl_enquiries (uuid, full_name, email, phone_number, website_url, source, message, status, remarks, created_by) VALUES (?,?,?,?,?,?,?,?,?,?)`;

    const [result] = await pool.query(query, [
      uuid,
      full_name,
      email,
      phone_number,
      website_url,
      source,
      message,
      status,
      remarks,
      admin_id,
    ]);

    const [enquiries] = await pool.query(
      `SELECT e.*, a.full_name AS created_by_name 
       FROM crm_tbl_enquiries e 
       LEFT JOIN crm_tbl_admins a ON e.created_by = a.admin_id 
       WHERE e.enquiry_id = ?`,
      [result.insertId]
    );

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

const updateEnquiry = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      full_name,
      email,
      phone_number,
      website_url,
      source,
      message,
      status,
      remarks,
    } = req.body;

    // Validation
    const error = validateRequest(req.body, {
      full_name: { required: true, minLength: 2 },
      email: { required: false, pattern: /^\S+@\S+\.\S+$/ },
      phone_number: { required: true, minLength: 10 },
      source: { required: false },
    });

    if (error) {
      return res.status(400).json({ message: error.message });
    }

    const admin_id = req.user?.admin_id || null;

    // 1. Fetch current enquiry
    const [rows] = await pool.query(
      "SELECT * FROM crm_tbl_enquiries WHERE enquiry_id = ? OR uuid = ?",
      [id, id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ message: "Enquiry Not Found!" });
    }

    const currentEnquiry = rows[0];
    const actualEnquiryId = currentEnquiry.enquiry_id;

    // 2. Perform the update query
    const updateQuery = `
      UPDATE crm_tbl_enquiries 
      SET 
        full_name = ?, 
        email = ?, 
        phone_number = ?, 
        website_url = ?, 
        source = ?, 
        message = ?, 
        status = ?, 
        remarks = ?, 
        updated_by = ?
      WHERE enquiry_id = ?
    `;

    await pool.query(updateQuery, [
      full_name !== undefined ? full_name : currentEnquiry.full_name,
      email !== undefined ? email : currentEnquiry.email,
      phone_number !== undefined ? phone_number : currentEnquiry.phone_number,
      website_url !== undefined ? website_url : currentEnquiry.website_url,
      source !== undefined ? source : currentEnquiry.source,
      message !== undefined ? message : currentEnquiry.message,
      status !== undefined ? status : currentEnquiry.status,
      remarks !== undefined ? remarks : currentEnquiry.remarks,
      admin_id,
      actualEnquiryId,
    ]);

    // 3. Fetch updated enquiry with admin name
    const [enquiries] = await pool.query(
      `SELECT e.*, a.full_name AS created_by_name 
       FROM crm_tbl_enquiries e 
       LEFT JOIN crm_tbl_admins a ON e.created_by = a.admin_id 
       WHERE e.enquiry_id = ?`,
      [actualEnquiryId]
    );

    // 4. Sync corresponding details to crm_tbl_leads if they were converted
    try {
      await pool.query(
        `UPDATE crm_tbl_leads 
         SET 
           full_name = ?, 
           phone_number = ?, 
           email = ?, 
           website_url = ?, 
           message = ?,
           source = ?,
           updated_by = ?
         WHERE enquiry_id = ?`,
        [
          full_name !== undefined ? full_name : currentEnquiry.full_name,
          phone_number !== undefined ? phone_number : currentEnquiry.phone_number,
          email !== undefined ? email : currentEnquiry.email,
          website_url !== undefined ? website_url : currentEnquiry.website_url,
          message !== undefined ? message : currentEnquiry.message,
          source !== undefined ? source : currentEnquiry.source,
          admin_id,
          actualEnquiryId,
        ]
      );
    } catch (leadSyncErr) {
      console.error("Error syncing lead details on enquiry update:", leadSyncErr.message);
    }

    res.status(200).json({
      message: "Enquiry Updated Successfully!",
      enquiry: enquiries[0],
    });
  } catch (err) {
    console.error("Error updating enquiry:", err.message);
    res.status(500).json({ message: "Server Error!" });
  }
};

module.exports = { getEnquiries, addEnquiry, updateEnquiryStatus, deleteEnquiry, updateEnquiry };
