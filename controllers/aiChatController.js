const { Type } = require("@google/genai");
const db = require("../config/db.js");
const { v4: uuidv4 } = require("uuid");
const {
  getDefaultAiModelInternal,
  getAiModelByIdInternal,
} = require("./aiModelController");

const {
  isOpenAIModel,
  isAnthropicModel,
  isGroqModel,
  callClaude,
  callGroq,
  callOpenAI,
  callGemini,
} = require("./aiAnalysisController");

const pool = db.promise;

// Format Chat History for the LLM prompt
const formatChatHistory = (messages) => {
  if (!messages || !Array.isArray(messages)) return "";
  return messages
    .map((m) => `${m.sender === "user" ? "User" : "Bot"}: ${m.text}`)
    .join("\n");
};

// Build the system prompt
const buildChatPrompt = (chatHistory) => {
  return `
You are Parivartan CRM Bot, a helpful and highly capable AI assistant for a CRM platform. 
Your goal is to help users manage their CRM data through natural conversation.

You can perform Create, Read, Update, and Delete operations for these entities:
1. Enquiries (fields: full_name*, email, phone_number*, website_url, message, status)
2. Leads (fields: full_name*, phone_number, email, message, lead_status)
3. Clients (fields: client_name*, organisation_name, email*, phone, client_country)
4. Projects (fields: project_name*, client_id*, status, start_date, deadline, budget)

* = Required field for creation.

CONVERSATIONAL RULES:
- The user will tell you what they want to do. 
- If they want to CREATE an entity but haven't provided all the REQUIRED fields, you MUST ask them for the missing information.
- If they want to UPDATE or DELETE an entity, you MUST ensure you have enough identifying information (like the ID or exact name). If not, ask for it.
- Once you have ALL required information to perform the action, output the action details.

OUTPUT FORMAT:
You MUST return ONLY valid JSON matching this schema:
{
  "type": "ask_user" | "execute_action" | "message",
  "message": "The conversational reply to show the user (e.g. asking a question, or confirming the action).",
  "action": "create_enquiry" | "update_enquiry" | "delete_enquiry" | "create_lead" | "update_lead" | "delete_lead" | "create_client" | "update_client" | "delete_client" | "create_project" | "update_project" | "delete_project" | "read_data" | null,
  "payload": {
     // A key-value object containing the extracted fields for the action. For read_data, include the entity name.
  }
}

IMPORTANT:
- Never return anything other than this JSON.
- If you are asking a question, type = "ask_user" and action = null.
- If you are executing an action, type = "execute_action" and action = the exact action string. Include all gathered fields in payload.
- If you are just answering a general question, type = "message" and action = null.

Conversation History:
${chatHistory}
  `;
};

// Map action to database query
const executeAction = async (action, payload, userId) => {
  let query, params;
  const uuid = uuidv4();

  try {
    switch (action) {
      // ENQUIRIES
      case "create_enquiry":
        query = `INSERT INTO crm_tbl_enquiries (uuid, full_name, email, phone_number, website_url, message, created_by) VALUES (?,?,?,?,?,?,?)`;
        params = [uuid, payload.full_name, payload.email || null, payload.phone_number || null, payload.website_url || null, payload.message || null, userId];
        await pool.query(query, params);
        return { success: true, detail: "Enquiry created." };
      case "update_enquiry":
        // For simplicity, updating based on ID or full_name
        query = `UPDATE crm_tbl_enquiries SET status = COALESCE(?, status), message = COALESCE(?, message) WHERE enquiry_id = ? OR full_name = ?`;
        params = [payload.status || null, payload.message || null, payload.id || null, payload.full_name || null];
        await pool.query(query, params);
        return { success: true, detail: "Enquiry updated." };
      case "delete_enquiry":
        query = `DELETE FROM crm_tbl_enquiries WHERE enquiry_id = ? OR full_name = ?`;
        params = [payload.id || null, payload.full_name || null];
        await pool.query(query, params);
        return { success: true, detail: "Enquiry deleted." };

      // LEADS
      case "create_lead":
        query = `INSERT INTO crm_tbl_leads (uuid, full_name, phone_number, email, message, lead_status, created_by) VALUES (?,?,?,?,?,?,?)`;
        params = [uuid, payload.full_name, payload.phone_number || null, payload.email || null, payload.message || null, payload.lead_status || 'New', userId];
        await pool.query(query, params);
        return { success: true, detail: "Lead created." };
      case "update_lead":
        query = `UPDATE crm_tbl_leads SET lead_status = COALESCE(?, lead_status) WHERE lead_id = ? OR full_name = ?`;
        params = [payload.lead_status || null, payload.id || null, payload.full_name || null];
        await pool.query(query, params);
        return { success: true, detail: "Lead updated." };
      case "delete_lead":
        query = `DELETE FROM crm_tbl_leads WHERE lead_id = ? OR full_name = ?`;
        params = [payload.id || null, payload.full_name || null];
        await pool.query(query, params);
        return { success: true, detail: "Lead deleted." };

      // CLIENTS
      case "create_client":
        query = `INSERT INTO crm_tbl_clients (uuid, client_name, organisation_name, email, phone, client_country, created_by) VALUES (?,?,?,?,?,?,?)`;
        params = [uuid, payload.client_name, payload.organisation_name || null, payload.email || null, payload.phone || null, payload.client_country || null, userId];
        await pool.query(query, params);
        return { success: true, detail: "Client created." };
      case "update_client":
        query = `UPDATE crm_tbl_clients SET phone = COALESCE(?, phone), organisation_name = COALESCE(?, organisation_name) WHERE client_id = ? OR client_name = ?`;
        params = [payload.phone || null, payload.organisation_name || null, payload.id || null, payload.client_name || null];
        await pool.query(query, params);
        return { success: true, detail: "Client updated." };
      case "delete_client":
        query = `DELETE FROM crm_tbl_clients WHERE client_id = ? OR client_name = ?`;
        params = [payload.id || null, payload.client_name || null];
        await pool.query(query, params);
        return { success: true, detail: "Client deleted." };

      // PROJECTS
      case "create_project":
        query = `INSERT INTO crm_tbl_projects (uuid, project_name, client_id, status, start_date, deadline, budget, created_by) VALUES (?,?,?,?,?,?,?,?)`;
        params = [uuid, payload.project_name, payload.client_id || 1, payload.status || 'Not Started', payload.start_date || null, payload.deadline || null, payload.budget || null, userId];
        await pool.query(query, params);
        return { success: true, detail: "Project created." };
      case "update_project":
        query = `UPDATE crm_tbl_projects SET status = COALESCE(?, status) WHERE project_id = ? OR project_name = ?`;
        params = [payload.status || null, payload.id || null, payload.project_name || null];
        await pool.query(query, params);
        return { success: true, detail: "Project updated." };
      case "delete_project":
        query = `DELETE FROM crm_tbl_projects WHERE project_id = ? OR project_name = ?`;
        params = [payload.id || null, payload.project_name || null];
        await pool.query(query, params);
        return { success: true, detail: "Project deleted." };

      default:
        return { success: false, detail: "Unknown action." };
    }
  } catch (err) {
    console.error("Action Execution Error:", err);
    return { success: false, detail: err.message };
  }
};

const chatWithAi = async (req, res) => {
  try {
    const { messages, modelId } = req.body;
    const userId = req.user?.admin_id || null;

    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ message: "Messages array is required" });
    }

    // Get AI model
    let model;
    if (modelId) {
      model = await getAiModelByIdInternal(modelId);
    } else {
      model = await getDefaultAiModelInternal();
    }

    if (!model) {
      return res.status(404).json({ message: "No AI model configured" });
    }

    const chatHistory = formatChatHistory(messages);
    const prompt = buildChatPrompt(chatHistory);

    let text;
    // Call appropriate provider
    if (isOpenAIModel(model.model_id)) {
      text = await callOpenAI(model.api_key, model.model_id, prompt);
    } else if (isAnthropicModel(model.model_id)) {
      text = await callClaude(model.api_key, model.model_id, prompt);
    } else if (isGroqModel(model.model_id)) {
      text = await callGroq(model.api_key, model.model_id, prompt);
    } else {
      // Gemini
      text = await callGemini(model.api_key, model.model_id, prompt, {
        type: Type.OBJECT,
        properties: {
          type: { type: Type.STRING },
          message: { type: Type.STRING },
          action: { type: Type.STRING, nullable: true },
          payload: { type: Type.OBJECT, nullable: true }
        },
        required: ["type", "message"],
      });
    }

    const jsonResult = JSON.parse(text || "{}");
    
    // If it's an action, execute it!
    if (jsonResult.type === "execute_action" && jsonResult.action) {
      const dbResult = await executeAction(jsonResult.action, jsonResult.payload || {}, userId);
      
      // Append execution detail to message
      if (dbResult.success) {
        jsonResult.message += ` (Action Successful: \${dbResult.detail})`;
      } else {
        jsonResult.message += ` (Action Failed: \${dbResult.detail})`;
      }
    }

    res.json({
      botMessage: jsonResult.message || "I'm not sure how to respond to that.",
      type: jsonResult.type,
      action: jsonResult.action
    });

  } catch (error) {
    console.error("AI Chat Error:", error);
    res.status(500).json({
      message: "AI Chat processing failed",
      error: error.message
    });
  }
};

module.exports = {
  chatWithAi
};
