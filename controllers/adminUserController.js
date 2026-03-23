const db = require("../config/db");
const { v4: uuidv4 } = require("uuid");
const bcrypt = require("bcrypt");

// Get all admin users except the logged-in user
const getAllAdminUsers = async (req, res) => {
  try {
    const { excludeUuid } = req.query;

    let query = `
      SELECT 
        uuid as id, 
        full_name as name, 
        email, 
        role, 
        privileges, 
        status,
        created_at as joinDate,
        image
      FROM crm_tbl_admins
    `;

    const queryParams = [];

    if (excludeUuid) {
      query += ` WHERE uuid != ?`;
      queryParams.push(excludeUuid);
    }

    query += ` ORDER BY 
      CASE 
        WHEN role = 'Root Admin' THEN 0 
        ELSE 1 
      END, 
      created_at DESC`;

    db.query(query, queryParams, (err, results) => {
      if (err) {
        console.error(err);
        return res.status(500).json({ message: "Database error" });
      }

      // Transform results to include full image URL and format status
      const users = results.map((user) => ({
        ...user,
        status: user.status === 1 ? "Active" : "Inactive",
        joinDate: user.joinDate
          ? user.joinDate.toISOString().split("T")[0]
          : new Date().toISOString().split("T")[0],
        image: user.image
          ? `${req.protocol}://${req.get("host")}/uploads/admin/${user.image}`
          : null,
      }));

      res.json({
        message: "Admin users fetched successfully",
        users: users,
      });
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};

// Create Admin Users
const createAdminUser = async (req, res) => {
  try {
    const { full_name, email, password, role, privileges } = req.body;

    const image = req.file ? req.file.filename : null;

    const userUUID = uuidv4();

    const finalPassword = password || "Password@123";
    const hashedPassword = await bcrypt.hash(finalPassword, 10);

    const query = `
      INSERT INTO crm_tbl_admins 
      (uuid, full_name, email, password, role, privileges, image)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `;

    db.query(
      query,
      [userUUID, full_name, email, hashedPassword, role, privileges, image],
      (err, result) => {
        if (err) {
          console.error(err);
          return res.status(500).json({ message: err.message });
        }

        res.status(201).json({
          message: "Admin user created successfully",
          uuid: userUUID,
          image: image,
        });
      },
    );
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
};

// Update Admin Users
const updateAdminUser = async (req, res) => {
  try {
    const { uuid } = req.params;

    const { full_name, email, password, role, privileges, status } = req.body;

    const image = req.file ? req.file.filename : null;

    let hashedPassword = null;

    if (password) {
      hashedPassword = await bcrypt.hash(password, 10);
    }

    // Convert status to number (FormData sends it as string)
    const statusValue =
      status === "1" || status === 1 || status === "true" || status === true
        ? 1
        : 0;

    const query = `
      UPDATE crm_tbl_admins
      SET 
        full_name = ?,
        email = ?,
        password = COALESCE(?, password),
        role = ?,
        privileges = ?,
        status = ?,
        image = COALESCE(?, image)
      WHERE uuid = ?
    `;

    db.query(
      query,
      [
        full_name,
        email,
        hashedPassword,
        role,
        privileges || 3,
        statusValue,
        image,
        uuid,
      ],
      (err, result) => {
        if (err) {
          console.error(err);
          return res.status(500).json({ message: "Database error" });
        }

        // Construct full image URL
        const imageUrl = req.file
          ? `${req.protocol}://${req.get("host")}/uploads/admin/${req.file.filename}`
          : null;

        res.json({
          message: "Admin user updated successfully",
          image: imageUrl,
        });
      },
    );
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
};

// Update password
const updatePassword = async (req, res) => {
  try {
    const { uuid } = req.params;
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        message: "Current password and new password are required",
      });
    }

    // Get user from database
    const query = "SELECT * FROM crm_tbl_admins WHERE uuid = ? LIMIT 1";
    db.query(query, [uuid], async (err, results) => {
      if (err) {
        console.error(err);
        return res.status(500).json({ message: "Database error" });
      }

      if (results.length === 0) {
        return res.status(404).json({ message: "User not found" });
      }

      const user = results[0];

      // Verify current password
      const passwordMatch = await bcrypt.compare(
        currentPassword,
        user.password,
      );
      if (!passwordMatch) {
        return res
          .status(401)
          .json({ message: "Current password is incorrect" });
      }

      // Hash new password
      const hashedPassword = await bcrypt.hash(newPassword, 10);

      // Update password in database
      const updateQuery =
        "UPDATE crm_tbl_admins SET password = ? WHERE uuid = ?";
      db.query(updateQuery, [hashedPassword, uuid], (updateErr) => {
        if (updateErr) {
          console.error(updateErr);
          return res.status(500).json({ message: "Failed to update password" });
        }

        res.json({ message: "Password updated successfully" });
      });
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};

// Delete admin user
const deleteAdminUser = async (req, res) => {
  try {
    const { uuid } = req.params;

    // Check if user exists
    const checkQuery = "SELECT * FROM crm_tbl_admins WHERE uuid = ? LIMIT 1";
    db.query(checkQuery, [uuid], (err, results) => {
      if (err) {
        console.error(err);
        return res.status(500).json({ message: "Database error" });
      }

      if (results.length === 0) {
        return res.status(404).json({ message: "User not found" });
      }

      const user = results[0];

      // Prevent deletion of Root Admin
      if (user.role === "Root Admin") {
        return res
          .status(403)
          .json({ message: "Root Admin cannot be deleted" });
      }

      // Delete user from database
      const deleteQuery = "DELETE FROM crm_tbl_admins WHERE uuid = ?";
      db.query(deleteQuery, [uuid], (deleteErr) => {
        if (deleteErr) {
          console.error(deleteErr);
          return res.status(500).json({ message: "Failed to delete user" });
        }

        res.json({ message: "User deleted successfully" });
      });
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};

module.exports = {
  getAllAdminUsers,
  createAdminUser,
  updateAdminUser,
  updatePassword,
  deleteAdminUser,
};
