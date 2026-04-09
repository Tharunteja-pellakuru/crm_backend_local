const { GoogleGenAI, Type } = require("@google/genai");
const OpenAI = require("openai");
const Anthropic = require("@anthropic-ai/sdk");
const Groq = require("groq-sdk");
const { getDefaultAiModelInternal, getAiModelByIdInternal } = require("./aiModelController");

// --- Provider detection ---
const isOpenAIModel = (modelId = "") =>
  modelId.startsWith("gpt-") || modelId.startsWith("o1") || modelId.startsWith("o3");

const isAnthropicModel = (modelId = "") =>
  modelId.toLowerCase().includes("claude");

const isGroqModel = (modelId = "") =>
  modelId.toLowerCase().includes("llama") ||
  modelId.toLowerCase().includes("mixtral") ||
  modelId.toLowerCase().includes("gemma");

// --- Anthropic JSON call helper ---
const callClaude = async (apiKey, modelId, prompt) => {
  const anthropic = new Anthropic({ apiKey });
  const response = await anthropic.messages.create({
    model: modelId,
    max_tokens: 1024,
    messages: [
      {
        role: "user",
        content: prompt + "\n\nReturn MUST be valid JSON only.",
      },
    ],
  });
  const text = response.content.find((c) => c.type === "text")?.text || "{}";
  return text;
};

// --- Groq JSON call helper ---
const callGroq = async (apiKey, modelId, prompt) => {
  const groq = new Groq({ apiKey });
  const response = await groq.chat.completions.create({
    model: modelId,
    messages: [
      {
        role: "user",
        content: prompt + "\n\nReturn MUST be valid JSON only.",
      },
    ],
    response_format: { type: "json_object" },
  });
  return response.choices[0]?.message?.content || "{}";
};

// --- OpenAI JSON call helper ---
const callOpenAI = async (apiKey, modelId, prompt) => {
  const client = new OpenAI({ apiKey });
  const response = await client.chat.completions.create({
    model: modelId,
    messages: [{ role: "user", content: prompt }],
    response_format: { type: "json_object" },
  });
  return response.choices[0]?.message?.content || "{}";
};

// --- Gemini JSON call helper ---
const callGemini = async (apiKey, modelId, prompt, schema) => {
  try {
    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: modelId || "gemini-2.0-flash",
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      config: {
        responseMimeType: "application/json",
        responseSchema: schema,
      },
    });
    return response.text;
  } catch (error) {
    if (error.details) {
      console.error("Gemini API Error Details:", JSON.stringify(error.details, null, 2));
    }
    console.error("Gemini API Error:", error.message || error);
    throw error;
  }
};

// --- Error Parsing Helper ---
const parseRetryAfter = (error) => {
  const msg = error?.message || "";

  // Groq format: "Please try again in 5m43.008s"
  const groqMatch = msg.match(/try again in\s+(?:(\d+)h)?\s*(?:(\d+)m)?\s*(?:([\d.]+)s)?/i);
  if (groqMatch) {
    const hours = parseInt(groqMatch[1] || "0");
    const minutes = parseInt(groqMatch[2] || "0");
    const seconds = parseFloat(groqMatch[3] || "0");
    const totalSeconds = hours * 3600 + minutes * 60 + seconds;
    return {
      retryDelay: Math.ceil(totalSeconds) + 2,
      retryAfter: `${hours > 0 ? hours + "h " : ""}${minutes > 0 ? minutes + "m " : ""}${seconds}s`.trim(),
    };
  }

  // Gemini format: "retry in 10s"
  const geminiMatch = msg.match(/retry in ([\d.]+)s/i);
  if (geminiMatch) {
    return {
      retryDelay: Math.ceil(parseFloat(geminiMatch[1])) + 2,
      retryAfter: `${geminiMatch[1]}s`,
    };
  }

  return null;
};

// Build the analysis prompt
const buildAnalysisPrompt = (enquiry) => {
  return `
You are a strict AI enquiry classifier for EParivartan, a digital services company.
Your goal is to categorize enquiries as either RELEVANT or IRRELEVANT based on our service offerings.

EParivartan ONLY offers these services:
- Website Development (WordPress, React, HTML/CSS)
- Web Application Development (MERN stack, full-stack)
- Mobile App Development (Flutter, React Native)
- E-commerce Website Development
- SEO (Search Engine Optimization)
- Digital Marketing & Social Media Marketing
- Brand Promotion & Online Branding
- UI/UX Design (digital interfaces only)
- Media Services (video editing, thumbnails, content creation)

LABEL DEFINITIONS:
1. RELEVANT: The user is asking to BUILD, DESIGN, or MARKET something digital that falls within our services.
2. IRRELEVANT: Everything else, including:
   - Job/Internship applications ("I want to work for you", "Hiring?")
   - Physical services (Interior design, architecture, construction, farming)
   - Hardware/Product supply requests
   - Personal messages with no business intent
   - SPAM (Crypto scams, gambling, bot-generated gibberish)
   - Agencies selling THEIR services TO us

STRICT RULES:
- If it is a job application, it is IRRELEVANT.
- If it is for a service we don't provide (like interior design), it is IRRELEVANT.
- Only mark as RELEVANT if they are a potential customer for our digital/media services.

Input Enquiry:
Name: ${enquiry.name}
Email: ${enquiry.email}
Phone: ${enquiry.phone || "Not provided"}
Website: ${enquiry.website || "Not provided"}
Message: ${enquiry.message}

Return ONLY valid JSON:
{
  "isRelevant": true or false,
  "label": "RELEVANT | IRRELEVANT",
  "category": "Detailed category name (e.g., SEO, Web Dev, Job App, Spam)",
  "leadScore": number between 0 and 100,
  "reason": "Very short explanation why it is Relevant or Irrelevant"
}
  `;
};

// Analyze single enquiry
const analyzeEnquiry = async (req, res) => {
  try {
    const { enquiry, modelId } = req.body;

    if (!enquiry) {
      return res.status(400).json({ message: "Enquiry data is required" });
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

    const prompt = buildAnalysisPrompt(enquiry);
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
          isRelevant: { type: Type.BOOLEAN },
          category: { type: Type.STRING },
          leadScore: { type: Type.NUMBER },
          reason: { type: Type.STRING },
        },
        required: ["isRelevant", "category", "leadScore", "reason"],
      });
    }

    const jsonResult = JSON.parse(text || "{}");
    const label = (jsonResult.label || "").toString().toUpperCase().trim();
    const isRelevant =
      typeof jsonResult.isRelevant === "boolean"
        ? jsonResult.isRelevant
        : label === "RELEVANT";

    res.json({
      isRelevant,
      category: jsonResult.category || (isRelevant ? "Relevant Lead" : "Irrelevant"),
      label: isRelevant ? "RELEVANT" : "IRRELEVANT",
      leadScore: jsonResult.leadScore ?? (isRelevant ? 70 : 10),
      reason: jsonResult.reason || "AI analysis completed",
    });
  } catch (error) {
    console.error("AI Analysis Error:", error);
    const retryInfo = parseRetryAfter(error);
    res.status(500).json({
      message: "AI analysis failed",
      error: error.message,
      ...retryInfo,
    });
  }
};

// Batch analyze enquiries
const batchAnalyzeEnquiries = async (req, res) => {
  try {
    const { enquiries, modelId } = req.body;

    if (!enquiries || !Array.isArray(enquiries) || enquiries.length === 0) {
      return res.status(400).json({ message: "Enquiries array is required" });
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

    const enquiriesData = enquiries
      .map(
        (e, index) => `
ENTRY_ID: ${index}
Name: ${e.name}
Email: ${e.email}
Message: ${e.message}
`
      )
      .join("\n---\n");

    const prompt = `
You are a STRICT AI enquiry classifier for EParivartan.

Your task is to classify each enquiry as RELEVANT or IRRELEVANT based ONLY on business intent.

---

EParivartan SERVICES:

* Website Development
* Web Applications (MERN)
* Mobile Apps (Flutter)
* E-commerce Solutions
* SEO & Digital Marketing
* UI/UX Design
* Media Services (Video Editing, Graphic Design)

---

CLASSIFICATION RULES:

RELEVANT:

* Client wants a website, app, marketing, design, or media services
* Business inquiries for digital solutions
* Project discussions, pricing requests, service questions

IRRELEVANT:

* Job or internship applications
* Freelancers/agencies offering services to us
* Physical services (construction, interior, etc.)
* Spam, greetings, or unrelated messages

EDGE CASES:

* If intent is unclear → mark IRRELEVANT with low leadScore (0–30)
* If mixed intent → prioritize dominant intent
* Empty or meaningless text → IRRELEVANT

---

LEAD SCORE GUIDELINES (0–100):

* 90–100 → Strong client intent (ready to start project)
* 70–89 → Clear interest but needs discussion
* 40–69 → Possible lead, vague requirement
* 0–39 → Not a lead / irrelevant

---

CATEGORY VALUES (STRICT):
Use ONLY one of the following:

* Website
* Web App
* Mobile App
* E-commerce
* SEO
* Digital Marketing
* UI/UX
* Media
* Job/Internship
* Spam
* Other

---

IMPORTANT OUTPUT RULES:

* Return ONLY valid JSON
* No explanations outside JSON
* Do NOT include markdown
* Do NOT change structure
* Ensure all fields are present

---

Batch Input:
${enquiriesData}

---

Return format:
{
"results": [
{
"entryId": number,
"isRelevant": boolean,
"label": "RELEVANT" | "IRRELEVANT",
"category": "One from allowed list",
"leadScore": number,
"reason": "Max 15 words"
}
]
}

`;

    let text;
    if (isOpenAIModel(model.model_id)) {
      text = await callOpenAI(model.api_key, model.model_id, prompt);
    } else if (isAnthropicModel(model.model_id)) {
      text = await callClaude(model.api_key, model.model_id, prompt);
    } else if (isGroqModel(model.model_id)) {
      text = await callGroq(model.api_key, model.model_id, prompt);
    } else {
      text = await callGemini(model.api_key, model.model_id, prompt, {
        type: Type.OBJECT,
        properties: {
          results: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                entryId: { type: Type.NUMBER },
                isRelevant: { type: Type.BOOLEAN },
                label: { type: Type.STRING },
                category: { type: Type.STRING },
                leadScore: { type: Type.NUMBER },
                reason: { type: Type.STRING },
              },
              required: ["entryId", "isRelevant", "label", "category", "leadScore", "reason"],
            },
          },
        },
        required: ["results"],
      });
    }

    const jsonResult = JSON.parse(text || '{"results":[]}');
    const results = (jsonResult.results || []).map((res, i) => {
      // Find the corresponding enquiry either by entryId or fall back to array index
      const entryIdx = typeof res.entryId === "number" ? res.entryId : i;
      const originalEnquiry = enquiries[entryIdx];
      
      const isRel = typeof res.isRelevant === "boolean" 
        ? res.isRelevant 
        : (res.label === "RELEVANT" || res.isRelevant === "true");

      return {
        id: originalEnquiry?.enquiry_id || originalEnquiry?.id || null,
        isRelevant: isRel,
        label: isRel ? "RELEVANT" : "IRRELEVANT",
        category: res.category || (isRel ? "Relevant Lead" : "Irrelevant"),
        leadScore: res.leadScore ?? (isRel ? 70 : 10),
        reason: res.reason || "Batch analysis completed",
      };
    });

    res.json({ results });
  } catch (error) {
    console.error("Batch Analysis Error:", error);
    const retryInfo = parseRetryAfter(error);
    res.status(500).json({
      message: "Batch analysis failed",
      error: error.message,
      ...retryInfo,
    });
  }
};

module.exports = {
  analyzeEnquiry,
  batchAnalyzeEnquiries,
};
