const axios = require("axios");

/**
 * Resolves credentials and active providers for Vision & Image AI.
 */
function getVisualCredentials(adminData = {}) {
  const geminiKey = (
    adminData.GEMINI_API_KEY ||
    process.env.GEMINI_API_KEY ||
    adminData.geminiApiKey ||
    ""
  ).trim();

  const imageAiKey = (
    adminData.IMAGE_AI_API_KEY ||
    process.env.IMAGE_AI_API_KEY ||
    ""
  ).trim();

  const imageBaseUrl = (
    adminData.IMAGE_AI_BASE_URL ||
    process.env.IMAGE_AI_BASE_URL ||
    (geminiKey ? "https://generativelanguage.googleapis.com/v1beta" : "https://api.openai.com/v1")
  )
    .trim()
    .replace(/\/+$/, "");

  const imageModel = (
    adminData.IMAGE_AI_MODEL ||
    process.env.IMAGE_AI_MODEL ||
    (geminiKey ? "gemini-2.5-flash-image" : "gpt-image-1")
  ).trim();

  const openaiKey = (
    adminData.OPENAI_API_KEY ||
    process.env.OPENAI_API_KEY ||
    imageAiKey ||
    ""
  ).trim();

  const hasGemini = Boolean(geminiKey && geminiKey.length > 5);
  const hasOpenAiImage = Boolean(imageAiKey && imageAiKey.length > 5 && !imageBaseUrl.includes("generativelanguage.googleapis.com"));
  const isImageAiReady = Boolean(
    (adminData.imageAiEnabled !== false) &&
    (hasOpenAiImage || (hasGemini && imageModel.toLowerCase().includes("gemini")))
  );

  return {
    geminiKey,
    imageAiKey,
    imageBaseUrl,
    imageModel,
    openaiKey,
    hasGemini,
    hasOpenAiImage,
    isImageAiReady
  };
}

/**
 * Multimodal Vision Analysis (JSON or Text output).
 * Analyzes an image or scanned document using Gemini (Priority 1) or OpenAI Vision (Priority 2).
 */
async function analyzeImageWithVision({
  imageBuffer,
  mimeType = "image/jpeg",
  prompt = "",
  systemPrompt = "",
  responseFormat = "json",
  adminData = {}
}) {
  if (!Buffer.isBuffer(imageBuffer)) {
    throw new Error("Invalid imageBuffer provided for vision analysis");
  }

  const cleanMimeType = (mimeType || "image/jpeg").split(";")[0].trim();
  const creds = getVisualCredentials(adminData);

  // 1. Primary: Google Gemini Multimodal Vision
  if (creds.hasGemini) {
    const geminiModels = [
      "gemini-3.5-flash",
      "gemini-3.5-flash-lite",
      "gemini-3.1-flash-lite"
    ];
    const base64Data = imageBuffer.toString("base64");
    const fullPrompt = [systemPrompt, prompt].filter(Boolean).join("\n\n");

    for (const model of geminiModels) {
      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${creds.geminiKey}`;
        const body = {
          contents: [
            {
              role: "user",
              parts: [
                {
                  inlineData: {
                    mimeType: cleanMimeType,
                    data: base64Data
                  }
                },
                { text: fullPrompt }
              ]
            }
          ]
        };

        if (responseFormat === "json") {
          body.generationConfig = {
            responseMimeType: "application/json",
            temperature: 0.1
          };
        }

        const resp = await axios.post(url, body, {
          headers: { "Content-Type": "application/json" },
          timeout: 45000
        });

        const text = resp.data?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (text) {
          if (responseFormat === "json") {
            const cleanJson = text.replace(/```json/gi, "").replace(/```/g, "").trim();
            return JSON.parse(cleanJson);
          }
          return text.trim();
        }
      } catch (gemErr) {
        console.warn(`[GEMINI_VISION_WARN (${model})]:`, gemErr.response?.data?.error?.message || gemErr.message);
      }
    }
  }

  // 2. Fallback: OpenAI Vision (gpt-4o-mini / gpt-4o)
  const openAiKey = creds.openaiKey || creds.imageAiKey;
  if (openAiKey && openAiKey.length > 5) {
    try {
      const openAiBase = creds.imageBaseUrl.includes("generativelanguage.googleapis.com")
        ? "https://api.openai.com/v1"
        : creds.imageBaseUrl;
      const b64 = imageBuffer.toString("base64");
      const messages = [];

      if (systemPrompt) {
        messages.push({ role: "system", content: systemPrompt });
      }

      messages.push({
        role: "user",
        content: [
          { type: "text", text: prompt || "Analyze this image in detail." },
          {
            type: "image_url",
            image_url: { url: `data:${cleanMimeType};base64,${b64}` }
          }
        ]
      });

      const body = {
        model: "gpt-4o-mini",
        messages,
        temperature: 0.1
      };

      if (responseFormat === "json") {
        body.response_format = { type: "json_object" };
      }

      const resp = await axios.post(`${openAiBase}/chat/completions`, body, {
        headers: {
          Authorization: `Bearer ${openAiKey}`,
          "Content-Type": "application/json"
        },
        timeout: 40000
      });

      const content = resp.data?.choices?.[0]?.message?.content;
      if (content) {
        if (responseFormat === "json") {
          return JSON.parse(content.replace(/```json/gi, "").replace(/```/g, "").trim());
        }
        return content.trim();
      }
    } catch (oErr) {
      console.warn("[OPENAI_VISION_WARN]:", oErr.response?.data?.error?.message || oErr.message);
    }
  }

  throw new Error("تعذر فحص وتحليل الصورة بالرؤية الحاسوبية. يرجى التأكد من ضبط GEMINI_API_KEY أو مفتاح AI للصور.");
}

/**
 * Inspects a reference product image to extract precise visual attributes
 * (color palette, physical materials, geometry, branding styling, ports/controls)
 * so image generation models can recreate or blend the product accurately.
 */
async function inspectVisualReference(imageBuffer, mimeType = "image/jpeg", options = {}) {
  const {
    instruction = "Describe this commercial product in precise visual detail for a studio product photographer (exact shape, color, material, buttons, screen, brand styling, proportions) in 3 concise sentences.",
    adminData = {}
  } = options;

  try {
    const description = await analyzeImageWithVision({
      imageBuffer,
      mimeType,
      prompt: instruction,
      systemPrompt: "You are an expert commercial product photography director and visual styling analyst.",
      responseFormat: "text",
      adminData
    });
    return (description || "").trim();
  } catch (err) {
    console.warn("[INSPECT_VISUAL_REF_WARN]", err.message);
    return "";
  }
}

/**
 * Generates an image using AI (Gemini Imagen or OpenAI Image API)
 * Returns: { buffer: Buffer, mimeType: string }
 */
async function generateImageWithAi({
  prompt,
  rawImages = [], // array of { buffer: Buffer, mimeType: string, filename?: string }
  options = {},
  adminData = {}
}) {
  if (!prompt || typeof prompt !== "string") {
    throw new Error("Prompt is required for generateImageWithAi");
  }

  const creds = getVisualCredentials(adminData);
  const apiKey = (options.apiKey || creds.imageAiKey || creds.geminiKey || "").trim();
  const baseUrl = (options.baseUrl || creds.imageBaseUrl || "").trim().replace(/\/+$/, "");
  const model = (options.model || creds.imageModel || "gemini-2.5-flash-image").trim();

  if (!apiKey) {
    throw new Error("مفتاح API الخاص بتوليد الصور غير متوفر في الإعدادات.");
  }

  let outputBuffer = null;
  let outputMime = "image/png";

  // -------------------------------------------------------------
  // Provider 1: Google Gemini / Imagen Multimodal Image Generation
  // -------------------------------------------------------------
  const isGeminiEndpoint =
    baseUrl.includes("generativelanguage.googleapis.com") ||
    model.toLowerCase().includes("gemini") ||
    model.toLowerCase().includes("imagen");

  if (isGeminiEndpoint) {
    const geminiEndpoint = baseUrl.includes("generativelanguage.googleapis.com")
      ? baseUrl
      : "https://generativelanguage.googleapis.com/v1beta";

    const parts = [];
    if (Array.isArray(rawImages)) {
      for (const img of rawImages.slice(0, 4)) {
        if (img?.buffer) {
          parts.push({
            inlineData: {
              mimeType: img.mimeType || "image/png",
              data: img.buffer.toString("base64")
            }
          });
        }
      }
    }
    parts.push({ text: prompt });

    const targetModels = [
      model,
      "gemini-2.5-flash-image",
      "gemini-3.1-flash-image",
      "gemini-3.1-flash-lite-image"
    ];

    let lastError = null;
    for (const targetModel of targetModels) {
      try {
        const url = `${geminiEndpoint}/models/${targetModel}:generateContent?key=${apiKey}`;
        const resp = await axios.post(
          url,
          {
            contents: [{ role: "user", parts }],
            generationConfig: {
              responseModalities: ["TEXT", "IMAGE"]
            }
          },
          {
            headers: { "Content-Type": "application/json" },
            timeout: 65000
          }
        );

        const candidateParts = resp.data?.candidates?.[0]?.content?.parts || [];
        const imgPart = candidateParts.find((p) => p.inlineData && p.inlineData.data);
        if (imgPart) {
          outputBuffer = Buffer.from(imgPart.inlineData.data, "base64");
          outputMime = imgPart.inlineData.mimeType || "image/png";
          break;
        }
      } catch (gErr) {
        lastError = gErr;
        console.warn(`[GEMINI_IMAGE_GEN_WARN (${targetModel})]:`, gErr.response?.data?.error?.message || gErr.message);
      }
    }

    if (!outputBuffer && lastError) {
      // If direct image response modality failed, throw with clear detail
      throw new Error(
        lastError.response?.data?.error?.message ||
        lastError.message ||
        "تعذر توليد الصورة عبر محرك Gemini"
      );
    }
  }

  // -------------------------------------------------------------
  // Provider 2: OpenAI Images API (/images/edits or /images/generations)
  // -------------------------------------------------------------
  if (!outputBuffer && !isGeminiEndpoint) {
    let usedEdits = false;

    // A) If reference images are attached and model supports edits
    if (rawImages.length > 0 && model.includes("gpt-image")) {
      try {
        const formData = new FormData();
        if (rawImages.length === 1) {
          const blob = new Blob([rawImages[0].buffer], { type: rawImages[0].mimeType || "image/png" });
          formData.append("image", blob, rawImages[0].filename || "product-1.png");
        } else {
          rawImages.forEach((img, idx) => {
            const blob = new Blob([img.buffer], { type: img.mimeType || "image/png" });
            formData.append("image[]", blob, img.filename || `product-${idx + 1}.png`);
          });
        }
        formData.append("model", model);
        formData.append("prompt", prompt);
        formData.append("n", "1");
        formData.append("size", options.size || "1024x1024");

        const editRes = await fetch(`${baseUrl}/images/edits`, {
          method: "POST",
          headers: { Authorization: `Bearer ${apiKey}` },
          body: formData
        });

        if (editRes.ok) {
          const editData = await editRes.json();
          const item = editData?.data?.[0];
          if (item?.b64_json) {
            outputBuffer = Buffer.from(item.b64_json, "base64");
            usedEdits = true;
          } else if (item?.url) {
            const dl = await axios.get(item.url, { responseType: "arraybuffer", timeout: 25000 });
            outputBuffer = Buffer.from(dl.data);
            usedEdits = true;
          }
        }
      } catch (editErr) {
        console.warn("[OPENAI_IMAGE_EDITS_FALLBACK]", editErr.message);
      }
    }

    // B) Standard /images/generations with prompt
    if (!usedEdits) {
      let finalPrompt = prompt;
      if (rawImages.length > 0) {
        // Inspect reference images to enrich the prompt
        try {
          const refDesc = await inspectVisualReference(rawImages[0].buffer, rawImages[0].mimeType, {
            adminData
          });
          if (refDesc) {
            finalPrompt = `${prompt} Exact visual reference details of the featured product: ${refDesc}`;
          }
        } catch {
          // non-blocking
        }
      }

      const genRes = await axios.post(
        `${baseUrl}/images/generations`,
        {
          model: model || "dall-e-3",
          prompt: finalPrompt,
          n: 1,
          size: options.size || "1024x1024"
        },
        {
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json"
          },
          timeout: 65000
        }
      );

      const item = genRes.data?.data?.[0];
      if (item?.b64_json) {
        outputBuffer = Buffer.from(item.b64_json, "base64");
      } else if (item?.url) {
        const dl = await axios.get(item.url, { responseType: "arraybuffer", timeout: 25000 });
        outputBuffer = Buffer.from(dl.data);
      }
    }
  }

  if (!outputBuffer) {
    throw new Error("لم يرجع موديل الصور بيانات صورة صالحة");
  }

  return {
    buffer: outputBuffer,
    mimeType: outputMime
  };
}

module.exports = {
  getVisualCredentials,
  analyzeImageWithVision,
  inspectVisualReference,
  generateImageWithAi
};
