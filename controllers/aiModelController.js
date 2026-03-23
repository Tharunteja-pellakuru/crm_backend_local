const db = require("../config/db");
const { v4: uuidv4 } = require("uuid");

// Get all AI models (without API keys)
const getAllAiModels = async (req, res) => {
  try {
    const query =
      "SELECT id, name, provider, model_id, api_key, is_default, created_at FROM crm_tbl_aiModels ORDER BY created_at ASC";
    db.query(query, (err, results) => {
      if (err) {
        console.error("Error fetching AI models:", err);
        return res.status(500).json({ message: "Failed to fetch AI models" });
      }
      res.json(results);
    });
  } catch (error) {
    console.error("Get AI models error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// Create new AI model
const createAiModel = async (req, res) => {
  try {
    const { name, provider, modelId, apiKey, isDefault } = req.body;

    if (!name || !provider || !modelId || !apiKey) {
      return res.status(400).json({
        message: "Name, provider, model ID, and API key are required",
      });
    }

    // If setting as default, unset other defaults
    if (isDefault) {
      db.query("UPDATE crm_tbl_aiModels SET is_default = FALSE", (err) => {
        if (err) console.error("Error unsetting defaults:", err);
      });
    }

    const query =
      "INSERT INTO crm_tbl_aiModels (name, provider, model_id, api_key, is_default) VALUES (?, ?, ?, ?, ?)";
    db.query(
      query,
      [name, provider, modelId, apiKey, isDefault || false],
      (err, result) => {
        if (err) {
          console.error("Error creating AI model:", err);
          return res.status(500).json({ message: "Failed to create AI model" });
        }
        res.status(201).json({
          message: "AI model created successfully",
          id: result.insertId,
        });
      },
    );
  } catch (error) {
    console.error("Create AI model error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// Update AI model
const updateAiModel = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, provider, modelId, apiKey, isDefault } = req.body;

    // Check if model exists
    db.query(
      "SELECT * FROM crm_tbl_aiModels WHERE id = ?",
      [id],
      (err, results) => {
        if (err) {
          console.error("Error finding AI model:", err);
          return res.status(500).json({ message: "Database error" });
        }

        if (results.length === 0) {
          return res.status(404).json({ message: "AI model not found" });
        }

        // If setting as default, unset other defaults
        if (isDefault) {
          db.query("UPDATE crm_tbl_aiModels SET is_default = FALSE", (err) => {
            if (err) console.error("Error unsetting defaults:", err);
          });
        }

        // Build update query dynamically
        let updates = [];
        let values = [];

        if (name) {
          updates.push("name = ?");
          values.push(name);
        }
        if (provider) {
          updates.push("provider = ?");
          values.push(provider);
        }
        if (modelId) {
          updates.push("model_id = ?");
          values.push(modelId);
        }
        if (apiKey) {
          updates.push("api_key = ?");
          values.push(apiKey);
        }
        if (isDefault !== undefined) {
          updates.push("is_default = ?");
          values.push(isDefault);
        }

        if (updates.length === 0) {
          return res.status(400).json({ message: "No fields to update" });
        }

        values.push(id);
        const query = `UPDATE crm_tbl_aiModels SET ${updates.join(", ")} WHERE id = ?`;

        db.query(query, values, (err) => {
          if (err) {
            console.error("Error updating AI model:", err);
            return res
              .status(500)
              .json({ message: "Failed to update AI model" });
          }
          res.json({ message: "AI model updated successfully" });
        });
      },
    );
  } catch (error) {
    console.error("Update AI model error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// Delete AI model
const deleteAiModel = async (req, res) => {
  try {
    const { id } = req.params;

    db.query(
      "DELETE FROM crm_tbl_aiModels WHERE id = ?",
      [id],
      (err, result) => {
        if (err) {
          console.error("Error deleting AI model:", err);
          return res.status(500).json({ message: "Failed to delete AI model" });
        }

        if (result.affectedRows === 0) {
          return res.status(404).json({ message: "AI model not found" });
        }

        res.json({ message: "AI model deleted successfully" });
      },
    );
  } catch (error) {
    console.error("Delete AI model error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// Get default AI model with API key (internal use)
const getDefaultAiModelInternal = () => {
  return new Promise((resolve, reject) => {
    db.query(
      "SELECT * FROM crm_tbl_aiModels WHERE is_default = TRUE LIMIT 1",
      (err, results) => {
        if (err) {
          reject(err);
        } else if (results.length > 0) {
          resolve(results[0]);
        } else {
          // Return first model if no default
          db.query("SELECT * FROM crm_tbl_aiModels LIMIT 1", (err, results) => {
            if (err) reject(err);
            else resolve(results[0] || null);
          });
        }
      },
    );
  });
};

// Get AI model by ID with API key (internal use)
// modified to also check provider-specific model_id column so callers
// can pass either the database record id or the provider's model identifier
const getAiModelByIdInternal = (identifier) => {
  return new Promise((resolve, reject) => {
    // try to match on primary key first, then fall back to model_id value
    db.query(
      "SELECT * FROM crm_tbl_aiModels WHERE id = ? OR model_id = ? LIMIT 1",
      [identifier, identifier],
      (err, results) => {
        if (err) reject(err);
        else resolve(results[0] || null);
      },
    );
  });
};

module.exports = {
  getAllAiModels,
  createAiModel,
  updateAiModel,
  deleteAiModel,
  getDefaultAiModelInternal,
  getAiModelByIdInternal,
};
