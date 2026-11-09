/**
 * Unified AI Reasoning, Chat, Intake & Tool-Calling Engine
 *
 * Enforces a single, consistent model hierarchy across the entire platform:
 *   1. Primary Configured Model (from DB `adminData`: e.g. DeepSeek `deepseek-chat` or any OpenAI-compatible model).
 *   2. Default Fallback Model: Google Gemini (`GEMINI_API_KEY` + `GEMINI_FALLBACK_MODEL` stored in DB `adminData`).
 *
 * Also ensures that if fallback credentials exist in `.env` but are missing in the tenant's
 * MongoDB `adminData` document, they are automatically persisted into the database.
 */

const axios = require("axios");
const getAdminDataModel = require("../../modules/settings/adminDataModel");

/**
 * Resilient JSON parser for LLM responses
 */
function safeParseJson(rawText) {
  if (!rawText || typeof rawText !== "string") return null;
  const cleaned = rawText
    .replace(/```json/gi, "")
    .replace(/```/g, "")
    .trim();

  try {
    return JSON.parse(cleaned);
  } catch (err) {
    const objMatch = cleaned.match(/\{[\s\S]*\}/);
    if (objMatch) {
      try {
        return JSON.parse(objMatch[0]);
      } catch {}
      const noTrailing = objMatch[0].replace(/,\s*([\}\]])/g, "$1");
      try {
        return JSON.parse(noTrailing);
      } catch {}
    }
    const arrMatch = cleaned.match(/\[[\s\S]*\]/);
    if (arrMatch) {
      try {
        return JSON.parse(arrMatch[0]);
      } catch {}
    }
    return null;
  }
}

/**
 * Ensures default & fallback AI credentials are saved in the tenant's `adminData` document in MongoDB
 * if they are currently missing/empty.
 */
async function ensureDbAiCredentials(subdomain, existingAdminData = null) {
  let adminData = existingAdminData || {};
  if (!subdomain) return adminData;

  try {
    const AdminData = getAdminDataModel(subdomain);
    if (!existingAdminData || Object.keys(existingAdminData).length === 0) {
      adminData = (await AdminData.findOne().lean()) || {};
    }

    const updates = {};
    const envAiKey = (process.env.AI_API_KEY || process.env.DEEPSEEK_API_KEY || "").trim();
    const envAiBase = (process.env.AI_BASE_URL || "https://api.deepseek.com").trim();
    const envAiModel = (process.env.AI_MODEL || "deepseek-chat").trim();
    const envGeminiKey = (process.env.GEMINI_API_KEY || "").trim();
    const envGeminiModel = (process.env.GEMINI_FALLBACK_MODEL || "gemini-3.5-flash").trim();

    if (!adminData.AI_API_KEY && !adminData.aiApiKey && envAiKey) {
      updates.AI_API_KEY = envAiKey;
      updates.aiApiKey = envAiKey;
    }
    if (!adminData.AI_BASE_URL && envAiBase) {
      updates.AI_BASE_URL = envAiBase;
    }
    if (!adminData.AI_MODEL && envAiModel) {
      updates.AI_MODEL = envAiModel;
    }
    if (!adminData.GEMINI_API_KEY && envGeminiKey) {
      updates.GEMINI_API_KEY = envGeminiKey;
    }
    if (!adminData.GEMINI_FALLBACK_MODEL && envGeminiModel) {
      updates.GEMINI_FALLBACK_MODEL = envGeminiModel;
    }

    if (Object.keys(updates).length > 0) {
      await AdminData.updateOne({}, { $set: updates }, { upsert: true });
      adminData = { ...adminData, ...updates };
    }
  } catch (err) {
    console.warn("[UNIFIED_LLM_DB_SEED_WARN]:", err.message);
  }

  return adminData;
}

/**
 * Resolves Primary (DeepSeek / External) + Fallback (Gemini) credentials
 */
function resolveAiCredentialsSync(adminData = {}) {
  const primaryKey = (
    adminData.AI_API_KEY ||
    adminData.aiApiKey ||
    process.env.AI_API_KEY ||
    process.env.DEEPSEEK_API_KEY ||
    ""
  ).trim();

  const primaryBaseUrl = (
    adminData.AI_BASE_URL ||
    process.env.AI_BASE_URL ||
    "https://api.deepseek.com"
  )
    .trim()
    .replace(/\/+$/, "");

  const primaryModel = (
    adminData.AI_MODEL ||
    process.env.AI_MODEL ||
    "deepseek-chat"
  ).trim();

  const geminiKey = (
    adminData.GEMINI_API_KEY ||
    adminData.geminiApiKey ||
    process.env.GEMINI_API_KEY ||
    (primaryKey.startsWith("AIza") ? primaryKey : "") ||
    ""
  ).trim();

  const geminiFallbackModel = (
    adminData.GEMINI_FALLBACK_MODEL ||
    process.env.GEMINI_FALLBACK_MODEL ||
    "gemini-3.5-flash"
  ).trim();

  const isPrimaryGemini =
    primaryBaseUrl.includes("generativelanguage.googleapis.com") ||
    primaryModel.toLowerCase().startsWith("gemini") ||
    primaryKey.startsWith("AIza");

  return {
    primaryKey: isPrimaryGemini ? "" : primaryKey,
    primaryBaseUrl,
    primaryModel,
    geminiKey: isPrimaryGemini ? primaryKey || geminiKey : geminiKey,
    geminiFallbackModel,
    hasPrimary: Boolean(!isPrimaryGemini && primaryKey.length > 5),
    hasGemini: Boolean((isPrimaryGemini ? primaryKey || geminiKey : geminiKey).length > 5)
  };
}

/**
 * Internal helper: Call Google Gemini GenerateContent (Text / JSON)
 */
async function callGeminiTextInternal({
  geminiKey,
  preferredModel = "gemini-2.5-flash",
  messages = [],
  systemPrompt = "",
  userPrompt = "",
  temperature = 0.1,
  jsonMode = false,
  timeout = 25000
}) {
  if (!geminiKey) {
    throw new Error("مفتاح Gemini API الاحتياطي غير متوفر");
  }

  const candidateModels = Array.from(
    new Set(
      [
        preferredModel,
        "gemini-3.5-flash",
        "gemini-3.5-flash-lite",
        "gemini-3.1-flash-lite"
      ].filter((m) => m && !m.includes("2.5") && !m.includes("2.0") && !m.includes("1.5"))
    )
  );

  // Convert messages array or systemPrompt+userPrompt into Gemini contents
  let finalSystemText = systemPrompt || "";
  const contents = [];

  if (Array.isArray(messages) && messages.length > 0) {
    for (const m of messages) {
      if (m.role === "system") {
        finalSystemText += (finalSystemText ? "\n\n" : "") + String(m.content || "");
      } else {
        contents.push({
          role: m.role === "assistant" ? "model" : "user",
          parts: [{ text: String(m.content || "") }]
        });
      }
    }
  }

  if (contents.length === 0 && userPrompt) {
    contents.push({
      role: "user",
      parts: [{ text: String(userPrompt) }]
    });
  }

  // Prepend system instruction into first user turn for universal model compatibility
  if (finalSystemText && contents.length > 0) {
    contents[0].parts[0].text = `${finalSystemText}\n\n---\n${contents[0].parts[0].text}`;
  } else if (finalSystemText && contents.length === 0) {
    contents.push({ role: "user", parts: [{ text: finalSystemText }] });
  }

  let lastErr = null;
  for (const model of candidateModels) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiKey}`;
      const generationConfig = { temperature };
      if (jsonMode) {
        generationConfig.responseMimeType = "application/json";
      }

      const response = await axios.post(
        url,
        { contents, generationConfig },
        {
          headers: { "Content-Type": "application/json" },
          timeout
        }
      );

      const parts = response.data?.candidates?.[0]?.content?.parts || [];
      const text = parts
        .filter((p) => !p.thought && typeof p.text === "string")
        .map((p) => p.text)
        .join("\n")
        .trim();
      if (text) {
        return {
          text,
          parsed: jsonMode ? safeParseJson(text) : null,
          provider: "gemini",
          model
        };
      }
    } catch (err) {
      lastErr = err;
      const status = err.response?.status;
      console.warn(`[UNIFIED_LLM_GEMINI_WARN (${model})]:`, err.response?.data?.error?.message || err.message);
      if (status === 401 || status === 403) {
        break;
      }
    }
  }

  throw lastErr || new Error("تعذر الاتصال بمحرك Gemini الاحتياطي");
}

/**
 * Unified Chat / Reasoning / Extraction Completion:
 * Tries Configured Primary Model (e.g. DeepSeek) first, then automatically falls back to Gemini.
 */
async function callUnifiedChat({
  subdomain = null,
  adminData = null,
  messages = [],
  systemPrompt = "",
  userPrompt = "",
  temperature = 0.1,
  jsonMode = false,
  timeout = 25000
}) {
  const effectiveAdminData = subdomain
    ? await ensureDbAiCredentials(subdomain, adminData)
    : adminData || {};

  const creds = resolveAiCredentialsSync(effectiveAdminData);

  // Build normalized OpenAI-style messages array if systemPrompt/userPrompt were passed
  const normalizedMessages =
    Array.isArray(messages) && messages.length > 0
      ? messages
      : [
          ...(systemPrompt ? [{ role: "system", content: systemPrompt }] : []),
          ...(userPrompt ? [{ role: "user", content: userPrompt }] : [])
        ];

  // 1. Primary Configured Model (DeepSeek / OpenAI-compatible)
  if (creds.hasPrimary) {
    try {
      const payload = {
        model: creds.primaryModel,
        messages: normalizedMessages,
        temperature
      };
      if (jsonMode) {
        payload.response_format = { type: "json_object" };
      }

      const response = await axios.post(`${creds.primaryBaseUrl}/chat/completions`, payload, {
        headers: {
          Authorization: `Bearer ${creds.primaryKey}`,
          "Content-Type": "application/json"
        },
        timeout
      });

      const content = response.data?.choices?.[0]?.message?.content;
      if (content && content.trim()) {
        return {
          text: content.trim(),
          parsed: jsonMode ? safeParseJson(content) : null,
          provider: "primary",
          model: creds.primaryModel
        };
      }
    } catch (primaryErr) {
      console.warn(
        `[UNIFIED_LLM_PRIMARY_FAIL -> GEMINI_FALLBACK] (${creds.primaryModel}):`,
        primaryErr.response?.data?.error?.message || primaryErr.message
      );
    }
  }

  // 2. Default Fallback: Google Gemini
  if (creds.hasGemini) {
    return await callGeminiTextInternal({
      geminiKey: creds.geminiKey,
      preferredModel: creds.geminiFallbackModel,
      messages: normalizedMessages,
      temperature,
      jsonMode,
      timeout
    });
  }

  throw new Error("لم يتم تفعيل مفتاح الذكاء الاصطناعي الأساسي أو الاحتياطي (Gemini)");
}

/**
 * Unified Tool-Calling Completion (for Copilot & Agentic Workflows):
 * Tries Primary Model (DeepSeek/OpenAI tool calling) first, then automatically falls back to Gemini Function Calling!
 */
async function callUnifiedWithTools({
  subdomain = null,
  adminData = null,
  messages = [],
  tools = [],
  temperature = 0.2,
  timeout = 35000
}) {
  const effectiveAdminData = subdomain
    ? await ensureDbAiCredentials(subdomain, adminData)
    : adminData || {};

  const creds = resolveAiCredentialsSync(effectiveAdminData);

  // 1. Primary Model (DeepSeek / OpenAI-compatible)
  if (creds.hasPrimary) {
    try {
      const response = await axios.post(
        `${creds.primaryBaseUrl}/chat/completions`,
        {
          model: creds.primaryModel,
          messages,
          tools,
          tool_choice: "auto",
          temperature
        },
        {
          headers: {
            Authorization: `Bearer ${creds.primaryKey}`,
            "Content-Type": "application/json"
          },
          timeout
        }
      );

      const resMessage = response.data?.choices?.[0]?.message;
      if (resMessage) {
        return {
          message: resMessage,
          provider: "primary",
          model: creds.primaryModel
        };
      }
    } catch (primaryErr) {
      console.warn(
        `[UNIFIED_TOOLS_PRIMARY_FAIL -> GEMINI_FALLBACK] (${creds.primaryModel}):`,
        primaryErr.response?.data?.error?.message || primaryErr.message
      );
    }
  }

  // 2. Default Fallback: Google Gemini Native Function Calling
  if (creds.hasGemini) {
    const functionDeclarations = (tools || [])
      .filter((t) => t?.function?.name)
      .map((t) => ({
        name: t.function.name,
        description: t.function.description || "",
        parameters: t.function.parameters || { type: "OBJECT", properties: {} }
      }));

    let systemText = "";
    const contents = [];

    for (const m of messages) {
      if (m.role === "system") {
        systemText += (systemText ? "\n\n" : "") + String(m.content || "");
      } else if (m.role === "user") {
        contents.push({
          role: "user",
          parts: [{ text: String(m.content || "") }]
        });
      } else if (m.role === "assistant") {
        if (Array.isArray(m.tool_calls) && m.tool_calls.length > 0) {
          const parts = m.tool_calls.map((tc) => {
            let argsObj = {};
            try {
              argsObj = JSON.parse(tc.function?.arguments || "{}");
            } catch {}
            return {
              functionCall: {
                name: tc.function?.name,
                args: argsObj
              }
            };
          });
          contents.push({ role: "model", parts });
        } else if (m.content) {
          contents.push({
            role: "model",
            parts: [{ text: String(m.content) }]
          });
        }
      } else if (m.role === "tool") {
        let respObj = {};
        try {
          respObj = JSON.parse(m.content || "{}");
        } catch {
          respObj = { result: m.content };
        }
        contents.push({
          role: "function",
          parts: [
            {
              functionResponse: {
                name: m.name || "tool",
                response: respObj
              }
            }
          ]
        });
      }
    }

    const candidateModels = Array.from(
      new Set(
        [
          creds.geminiFallbackModel,
          "gemini-3.5-flash",
          "gemini-3.5-flash-lite",
          "gemini-3.1-flash-lite"
        ].filter((m) => m && !m.includes("2.5") && !m.includes("2.0") && !m.includes("1.5"))
      )
    );

    let lastErr = null;
    for (const model of candidateModels) {
      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${creds.geminiKey}`;
        const body = {
          contents,
          generationConfig: { temperature }
        };
        if (systemText) {
          body.systemInstruction = { parts: [{ text: systemText }] };
        }
        if (functionDeclarations.length > 0) {
          body.tools = [{ functionDeclarations }];
        }

        const resp = await axios.post(url, body, {
          headers: { "Content-Type": "application/json" },
          timeout
        });

        const parts = resp.data?.candidates?.[0]?.content?.parts || [];
        const functionCalls = parts.filter((p) => p.functionCall);
        const textParts = parts.filter((p) => p.text).map((p) => p.text).join("\n");

        if (functionCalls.length > 0) {
          return {
            message: {
              role: "assistant",
              content: textParts || null,
              tool_calls: functionCalls.map((fc, idx) => ({
                id: `gemini_call_${Date.now()}_${idx}`,
                type: "function",
                function: {
                  name: fc.functionCall.name,
                  arguments: JSON.stringify(fc.functionCall.args || {})
                }
              }))
            },
            provider: "gemini",
            model
          };
        }

        if (textParts) {
          return {
            message: {
              role: "assistant",
              content: textParts
            },
            provider: "gemini",
            model
          };
        }
      } catch (err) {
        lastErr = err;
        const status = err.response?.status;
        console.warn(`[UNIFIED_TOOLS_GEMINI_WARN (${model})]:`, err.response?.data?.error?.message || err.message);
        if (status === 400 || status === 401 || status === 403) {
          break;
        }
      }
    }

    throw lastErr || new Error("تعذر تنفيذ استدعاء الأدوات عبر Gemini");
  }

  throw new Error("لا تتوفر مفاتيح ذكاء اصطناعي صالحة");
}

module.exports = {
  safeParseJson,
  ensureDbAiCredentials,
  resolveAiCredentialsSync,
  callUnifiedChat,
  callUnifiedWithTools
};
