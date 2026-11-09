const axios = require("axios");

/**
 * Discovers available credentials for speech-to-text / audio models
 */
function getAudioCredentials(adminData = {}) {
  const aiApiKeyCandidate = String(adminData.AI_API_KEY || adminData.aiApiKey || process.env.AI_API_KEY || "").trim();
  const geminiKey = (
    adminData.GEMINI_API_KEY ||
    adminData.geminiApiKey ||
    process.env.GEMINI_API_KEY ||
    (aiApiKeyCandidate.startsWith("AIza") ? aiApiKeyCandidate : "") ||
    ""
  ).trim();

  const groqKey = (
    adminData.GROQ_API_KEY ||
    process.env.GROQ_API_KEY ||
    ""
  ).trim();

  const openaiKey = (
    adminData.OPENAI_API_KEY ||
    process.env.OPENAI_API_KEY ||
    adminData.IMAGE_AI_API_KEY ||
    process.env.IMAGE_AI_API_KEY ||
    ""
  ).trim();

  const isAudioReady = Boolean(
    (geminiKey && geminiKey.length > 5) ||
    (groqKey && groqKey.length > 10) ||
    (openaiKey && openaiKey.length > 10)
  );

  return {
    geminiKey,
    groqKey,
    openaiKey,
    hasGemini: Boolean(geminiKey && geminiKey.length > 5),
    hasGroq: Boolean(groqKey && groqKey.length > 10),
    hasOpenAi: Boolean(openaiKey && openaiKey.length > 10),
    isAudioReady
  };
}

/**
 * Multi-Provider Cascade Speech-to-Text Transcription:
 * 1. Google Gemini Multimodal Audio (Native Audio Understanding & Arabic Dialect Comprehension)
 * 2. Groq Whisper (Ultra-fast whisper-large-v3)
 * 3. OpenAI Whisper (Standard whisper-1)
 */
async function transcribeAudio(audioBuffer, mimeType = "audio/webm", options = {}) {
  if (!Buffer.isBuffer(audioBuffer)) {
    throw new Error("Invalid audioBuffer provided for transcription");
  }

  const cleanMimeType = (mimeType || "audio/webm").split(";")[0].trim();
  const adminData = options.adminData || {};
  const creds = getAudioCredentials(adminData);

  const defaultPrompt =
    'أنت نظام ذكي لتحويل الصوت إلى نص لمتجر إلكتروني في مصر. استمع لهذا التسجيل الصوتي بدقة واكتب الكلمات ومواصفات وأسعار المنتجات المنطوقة باللغة العربية والعامية المصرية والمصطلحات التقنية تماماً كما نُطقت بدون أي مقدمات أو تعليقات أو علامات تنصيص. إذا كان التسجيل صامتاً تماماً أو فارغاً فاكتب "صوت غير واضح".';

  const userPrompt = options.prompt || defaultPrompt;

  // -------------------------------------------------------------
  // Priority 1: Google Gemini Multimodal Audio
  // -------------------------------------------------------------
  if (creds.hasGemini) {
    const geminiModels = [
      "gemini-3.5-flash-lite",
      "gemini-3.5-flash",
      "gemini-3.1-flash-lite"
    ];
    const base64Audio = audioBuffer.toString("base64");

    for (const model of geminiModels) {
      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${creds.geminiKey}`;
        const resp = await axios.post(
          url,
          {
            contents: [
              {
                role: "user",
                parts: [
                  {
                    inlineData: {
                      mimeType: cleanMimeType,
                      data: base64Audio
                    }
                  },
                  { text: userPrompt }
                ]
              }
            ],
            generationConfig: {
              temperature: 0.1
            }
          },
          {
            headers: { "Content-Type": "application/json" },
            timeout: 15000
          }
        );

        const parts = resp.data?.candidates?.[0]?.content?.parts || [];
        const rawText = parts
          .filter((p) => !p.thought && typeof p.text === "string")
          .map((p) => p.text)
          .join(" ")
          .trim();

        if (rawText) {
          if (rawText.includes("صوت غير واضح") || rawText === "صامت") {
            throw new Error("لم يتم سماع كلام واضح في التسجيل، يرجى التحدث بالقرب من المايك");
          }
          return rawText.replace(/^["'«»]|["'«»]$/g, "").trim();
        }
      } catch (gemErr) {
        if (gemErr.message?.includes("لم يتم سماع كلام واضح")) {
          throw gemErr;
        }
        const status = gemErr.response?.status;
        console.warn(`[GEMINI_AUDIO_WARN (${model})]:`, gemErr.response?.data?.error?.message || gemErr.message);
        if (status === 401 || status === 403) {
          break;
        }
      }
    }
  }

  // -------------------------------------------------------------
  // Priority 2: Groq Whisper (whisper-large-v3)
  // -------------------------------------------------------------
  if (creds.hasGroq) {
    try {
      const formData = new FormData();
      const file = new Blob([audioBuffer], { type: cleanMimeType });
      formData.append("file", file, "recording.webm");
      formData.append("model", "whisper-large-v3");
      formData.append("language", options.language || "ar");

      const resp = await fetch("https://api.groq.com/openai/v1/audio/transcriptions", {
        method: "POST",
        headers: { Authorization: `Bearer ${creds.groqKey}` },
        body: formData
      });

      if (resp.ok) {
        const data = await resp.json();
        if (data?.text && data.text.trim()) {
          return data.text.trim();
        }
      }
    } catch (groqErr) {
      console.warn("[GROQ_WHISPER_WARN]:", groqErr.message);
    }
  }

  // -------------------------------------------------------------
  // Priority 3: OpenAI Whisper (whisper-1)
  // -------------------------------------------------------------
  if (creds.hasOpenAi) {
    try {
      const formData = new FormData();
      const file = new Blob([audioBuffer], { type: cleanMimeType });
      formData.append("file", file, "recording.webm");
      formData.append("model", "whisper-1");
      formData.append("language", options.language || "ar");

      const resp = await fetch("https://api.openai.com/v1/audio/transcriptions", {
        method: "POST",
        headers: { Authorization: `Bearer ${creds.openaiKey}` },
        body: formData
      });

      if (resp.ok) {
        const data = await resp.json();
        if (data?.text && data.text.trim()) {
          return data.text.trim();
        }
      }
    } catch (openaiErr) {
      console.warn("[OPENAI_WHISPER_WARN]:", openaiErr.message);
    }
  }

  throw new Error(
    "تعذر تفريغ الصوت: تأكد من ضبط مفتاح GEMINI_API_KEY أو GROQ_API_KEY أو OPENAI_API_KEY في الإعدادات أو ملف server/.env"
  );
}

module.exports = {
  getAudioCredentials,
  transcribeAudio
};
