const express = require("express");
const router = express.Router();

const { createClient, getClients, updateClient } = require("../controllers/clientsController");

router.post("/add-client", createClient);
router.get("/get-clients", getClients);
router.put("/update-client/:id", updateClient);

module.exports = router;
