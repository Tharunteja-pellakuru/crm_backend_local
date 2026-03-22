const db = require("../config/db");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key-change-in-production";
const JWT_EXPIRES_IN = "7d"; // 7 days

const loginAdmin = (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({
      message: "Email and password are required",
    });
  }

  const query = "SELECT * FROM crm_tbl_admins WHERE email = ? LIMIT 1";

  db.query(query, [email], async (err, result) => {
    if (err) {
      return res.status(500).json({ message: "Database error" });
    }

    if (result.length === 0) {
      return res.status(401).json({
        message: "Invalid email or password",
      });
    }

    const user = result[0];

    const passwordMatch = await bcrypt.compare(password, user.password);

    if (!passwordMatch) {
      return res.status(401).json({
        message: "Invalid email or password",
      });
    }

    // Generate JWT token
    const token = jwt.sign(
      {
        id: user.id,
        uuid: user.uuid,
        email: user.email,
        role: user.role,
      },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );

    // Construct full image URL if image exists
    const imageUrl = user.image 
      ? `http://localhost:5000/uploads/admin/${user.image}`
      : null;

    res.status(200).json({
      message: "Login successful",
      token,
      user: {
        id: user.id,
        uuid: user.uuid,
        full_name: user.full_name,
        email: user.email,
        role: user.role,
        privileges: user.privileges,
        image: imageUrl,
        status: user.status,
      },
    });
  });
};

module.exports = { loginAdmin };
