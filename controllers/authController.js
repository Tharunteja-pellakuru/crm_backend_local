const db = require("../config/db");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const JWT_SECRET =
  process.env.JWT_SECRET || "your-secret-key-change-in-production";
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

    // Check if user account is active (status: 1 or true = active, 0 or false = inactive)
    if (user.status === 0 || user.status === false || user.status === "0" || user.status === "false") {
      return res.status(403).json({
        message: "Your account is inactive. Please contact administrator.",
      });
    }

    const passwordMatch = await bcrypt.compare(password, user.password);

    if (!passwordMatch) {
      return res.status(401).json({
        message: "Invalid email or password",
      });
    }

    // Generate JWT token
    const token = jwt.sign(
      {
        admin_id: user.admin_id,
        uuid: user.uuid,
        email: user.email,
        role: user.role,
      },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN },
    );

    // Construct full image URL if image exists
    const imageUrl = user.image
      ? `/uploads/admin/${user.image}`
      : null;

    res.status(200).json({  
      message: "Login successful",
      token,
      user: {
        admin_id: user.admin_id,
        uuid: user.uuid,
        full_name: user.full_name,
        email: user.email,
        role: user.role,
        image: imageUrl,
        status: user.status,
      },
    });
  });
};

module.exports = { loginAdmin };
