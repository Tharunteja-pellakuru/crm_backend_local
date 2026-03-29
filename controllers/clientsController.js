const db = require("../config/db");
const { v4: uuidv4 } = require("uuid");
const { validateRequest } = require("../middleware/validation");

const createClient = (req, res) => {
  const {
    organisation_name,
    client_name,
    client_country,
    client_state,
    client_currency,
    client_status,
    lead_id,
  } = req.body;

  const error = validateRequest(req.body, {
    organisation_name: { required: true },
    client_name: { required: true },
    client_country: { required: true },
    client_state: { required: true },
    client_currency: { required: true },
    client_status: { required: true, enum: ['Active', 'Inactive', 'On Hold', 'Completed', 'Dropped'] },
    lead_id: { required: true }
  });

  if (error) {
    return res.status(400).json({ message: error.message });
  }
  const uuid = uuidv4();
  const query =
    "INSERT INTO crm_tbl_clients (uuid,organisation_name,client_name,client_country,client_state,client_currency,client_status,lead_id) VALUES (?,?,?,?,?,?,?,?)";
  db.query(
    query,
    [
      uuid,
      organisation_name,
      client_name,
      client_country,
      client_state,
      client_currency,
      client_status,
      lead_id,
    ],
    (err, result) => {
      if (err) {
        console.log(err);
        return res.status(500).json({ message: "Failed to create client" });
      }

      const clientId = result.insertId;

      // Update lead status if lead_id is provided
      if (lead_id) {
        const updateLeadQuery =
          "UPDATE crm_tbl_leads SET lead_status = 'Converted' WHERE id = ?";
        db.query(updateLeadQuery, [lead_id], (leadErr) => {
          if (leadErr) {
            console.error("Error updating lead status:", leadErr.message);
            // We don't return error here because client is already created
          }
        });
      }

      db.query(
        "SELECT * FROM crm_tbl_clients WHERE client_id = ?",
        [clientId],
        (err, clients) => {
          if (err) {
            return res
              .status(201)
              .json({ message: "Client created successfully", uuid });
          }
          res
            .status(201)
            .json({ message: "Client created successfully", client: clients[0] });
        },
      );
    },
  );
};

const updateClient = (req, res) => {
  const { id } = req.params;
  const {
    organisation_name,
    client_name,
    client_country,
    client_state,
    client_currency,
    client_status,
  } = req.body;

  const error = validateRequest(req.body, {
    organisation_name: { required: true },
    client_name: { required: true },
    client_country: { required: true },
    client_state: { required: true },
    client_currency: { required: true },
    client_status: { required: true, enum: ['Active', 'Inactive'] }
  });

  if (error) {
    return res.status(400).json({ message: error.message });
  }

  const query = `UPDATE crm_tbl_clients SET 
    organisation_name = ?, 
    client_name = ?, 
    client_country = ?, 
    client_state = ?, 
    client_currency = ?, 
    client_status = ?
    WHERE client_id = ?`;

  db.query(
    query,
    [
      organisation_name,
      client_name,
      client_country,
      client_state,
      client_currency,
      client_status,
      id,
    ],
    (err, result) => {
      if (err) {
        console.error("Database error updating client:", err.message);
        return res.status(500).json({ message: "Failed to update client" });
      }
      if (result.affectedRows === 0) {
        return res.status(404).json({ message: "Client Not Found!" });
      }
      res.status(200).json({ message: "Client Updated Successfully!" });
    },
  );
};

const getClients = (req, res) => {
  const query = `
    SELECT 
      c.*, 
      l.email, 
      l.phone_number AS phone,
      l.lead_category AS projectCategory,
      l.website_url AS website,
      l.message AS brief_message
    FROM crm_tbl_clients c
    LEFT JOIN crm_tbl_leads l ON c.lead_id = l.id
  `;
  db.query(query, (err, result) => {
    if (err) {
      console.error("Error fetching clients:", err.message);
      return res.status(500).json({ message: "Failed to fetch clients" });
    }
    res.status(200).json(result);
  });
};

module.exports = { createClient, getClients, updateClient };
