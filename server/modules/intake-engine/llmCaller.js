const axios = require("axios");

/**
 * Robust JSON extraction from LLM response text
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
    // Regex fallback to extract outer JSON object or array
    const objMatch = cleaned.match(/\{[\s\S]*\}/);
    if (objMatch) {
      try {
        return JSON.parse(objMatch[0]);
      } catch {}
    }
    const arrMatch = cleaned.match(/\[[\s\S]*\]/);
    if (arrMatch) {
      try {
        return JSON.parse(arrMatch[0]);
      } catch {}
    }
    throw new Error(`Failed to parse JSON from LLM: ${err.message}`);
  }
}

/**
 * Call DeepSeek Chat API
 */
async function callDeepSeek(messages, adminData = {}, temperature = 0.1) {
  const apiKey = (
    adminData.AI_API_KEY ||
    adminData.aiApiKey ||
    process.env.AI_API_KEY ||
    ""
  ).trim();
  const baseUrl = (
    adminData.AI_BASE_URL ||
    process.env.AI_BASE_URL ||
    "https://api.deepseek.com"
  )
    .trim()
    .replace(/\/+$/, "");
  const model = (adminData.AI_MODEL || process.env.AI_MODEL || "deepseek-chat").trim();

  if (!apiKey) {
    throw new Error("مفتاح DeepSeek API غير متوفر في الإعدادات");
  }

  const response = await axios.post(
    `${baseUrl}/chat/completions`,
    {
      model,
      messages,
      temperature,
      response_format: { type: "json_object" }
    },
    {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      timeout: 50000
    }
  );

  const content = response.data?.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error("استجابة DeepSeek فارغة");
  }

  return safeParseJson(content);
}

/**
 * Call Google Gemini GenerateContent API (with JSON response modality)
 */
async function callGemini(systemPrompt, userPrompt, adminData = {}) {
  const apiKey = (
    adminData.GEMINI_API_KEY ||
    process.env.GEMINI_API_KEY ||
    adminData.geminiApiKey ||
    ""
  ).trim();

  if (!apiKey) {
    throw new Error("مفتاح Gemini API غير متوفر في الإعدادات");
  }

  const models = [
    "gemini-3.5-flash",
    "gemini-3.5-flash-lite",
    "gemini-3.1-flash-lite"
  ];

  let lastErr = null;
  for (const model of models) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
      const response = await axios.post(
        url,
        {
          contents: [
            {
              role: "user",
              parts: [{ text: `${systemPrompt}\n\n---\nنص الإدخال:\n${userPrompt}` }]
            }
          ],
          generationConfig: {
            responseMimeType: "application/json",
            temperature: 0.1
          }
        },
        {
          headers: { "Content-Type": "application/json" },
          timeout: 45000
        }
      );

      const text = response.data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (text) {
        return safeParseJson(text);
      }
    } catch (err) {
      lastErr = err;
      const status = err.response?.status;
      console.warn(`[GEMINI_EXTRACT_WARN (${model})]:`, err.response?.data?.error?.message || err.message);
      if (status === 400 || status === 401 || status === 403) {
        break;
      }
    }
  }

  throw lastErr || new Error("فشلت جميع محاولات استدعاء Gemini");
}

module.exports = {
  safeParseJson,
  callDeepSeek,
  callGemini
};
