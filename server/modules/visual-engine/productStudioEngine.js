const { loadAssetAsBuffer, saveVisualAsset } = require("./assetLoader");
const {
  getVisualCredentials,
  inspectVisualReference,
  generateImageWithAi
} = require("./visualProvider");

const ANGLE_DESCRIPTIONS = [
  "Front studio hero view, centered, ultra-clean commercial e-commerce lighting, pure studio background, crisp product details",
  "45-degree three-quarter side angle perspective showing depth, profile, and side build quality in matching studio lighting",
  "Alternative angle showing back/rear and top design details, ports or controls, commercial studio photography",
  "Close-up macro studio angle highlighting premium texture, finish, and key functional details"
];

/**
 * Builds standard commercial e-commerce photography prompt
 */
function buildProductStudioPrompt({
  productName = "منتج تجاري",
  categoryName = "",
  specs = {},
  mode = "enhance_only",
  notes = "",
  visualReferenceDescription = ""
}) {
  const specsSummary = Object.entries(specs || {})
    .filter(([, v]) => Boolean(v))
    .map(([k, v]) => `${k}: ${v}`)
    .join(", ");

  let objective = "";
  if (mode === "enhance_only") {
    objective =
      "Enhanced professional studio product photography, clean commercial lighting, high resolution, sharp details, pure neutral e-commerce studio background with soft ground shadow";
  } else if (mode === "extract_item_from_collection") {
    objective = `Isolate and extract ONLY the specific item "${productName}" from this composite or multi-product collection reference image. Crop out all other surrounding devices or items, center the extracted item, and render it alone in professional commercial studio lighting on a pure neutral studio background, 8k crisp details`;
  } else {
    objective = ANGLE_DESCRIPTIONS[0];
  }

  return [
    `Professional commercial e-commerce product photography of: "${productName}"${categoryName ? ` (${categoryName})` : ""}.`,
    specsSummary ? `Product specifications: ${specsSummary}.` : "",
    visualReferenceDescription ? `Exact visual reference traits: ${visualReferenceDescription}.` : "",
    `Style & Objective: ${objective}.`,
    notes && notes.trim() ? `Important custom instructions / notes: ${notes.trim()}.` : "",
    "Photorealistic, 8k studio lighting, clean commercial presentation, no text watermarks."
  ]
    .filter(Boolean)
    .join(" ");
}

/**
 * Generates product studio images (Enhance, Multi-Angle, or Extract from Collection)
 */
async function generateProductStudioImages(req, payload = {}) {
  const adminData = req.adminData || {};
  const {
    imageUrl = "",
    productName = "منتج تجاري",
    categoryName = "",
    specs = {},
    mode = "enhance_only",
    anglesCount = 2,
    notes = "",
    generatePromptOnly = false
  } = payload;

  const numAngles =
    mode === "enhance_and_angles" ? Math.max(1, Math.min(Number(anglesCount) || 2, 4)) : 1;

  // 1. Build initial prompt
  const initialPrompt = buildProductStudioPrompt({
    productName,
    categoryName,
    specs,
    mode,
    notes
  });

  if (generatePromptOnly) {
    return {
      mode,
      anglesCount: numAngles,
      images: [],
      prompt: initialPrompt
    };
  }

  // 2. Validate Image AI Credentials
  const creds = getVisualCredentials(adminData);
  if (!creds.isImageAiReady && !creds.hasGemini) {
    const err = new Error(
      "خدمة توليد وتعديل الصور بالـ AI غير مفعلة في السيرفر. يمكنك نسخ الـ Prompt واستخدامه في ChatGPT Plus أو Midjourney ثم استيراد النتيجة."
    );
    err.status = 403;
    throw err;
  }

  // 3. Load reference image as Buffer (if available)
  let referenceAsset = null;
  let visualReferenceDescription = "";

  if (imageUrl) {
    referenceAsset = await loadAssetAsBuffer(imageUrl);
    if (referenceAsset?.buffer) {
      visualReferenceDescription = await inspectVisualReference(
        referenceAsset.buffer,
        referenceAsset.mimeType,
        { adminData }
      );
    }
  }

  // 4. Multi-angle generation loop
  const generatedUrls = [];
  const rawImages = referenceAsset ? [referenceAsset] : [];

  for (let i = 0; i < numAngles; i++) {
    const angleDesc =
      mode === "enhance_only"
        ? "Enhanced professional studio product photography, clean commercial lighting, high resolution, sharp details, pure neutral studio background"
        : mode === "extract_item_from_collection"
        ? `Isolate and extract ONLY the item "${productName}", perfectly centered, pure studio lighting`
        : ANGLE_DESCRIPTIONS[i % ANGLE_DESCRIPTIONS.length];

    const anglePrompt = [
      `Professional commercial e-commerce product photography of: "${productName}"${categoryName ? ` (${categoryName})` : ""}.`,
      visualReferenceDescription ? `Exact visual reference traits: ${visualReferenceDescription}.` : "",
      `Perspective & Angle: ${angleDesc}.`,
      notes && notes.trim() ? `Notes: ${notes.trim()}.` : "",
      "Photorealistic, 8k studio lighting, clean commercial presentation, no text watermarks."
    ]
      .filter(Boolean)
      .join(" ");

    const { buffer, mimeType } = await generateImageWithAi({
      prompt: anglePrompt,
      rawImages,
      options: { size: "1024x1024" },
      adminData
    });

    const uploadedUrl = await saveVisualAsset(
      buffer,
      mimeType,
      `product-studio-${mode}-angle-${i + 1}.png`,
      req
    );

    generatedUrls.push(uploadedUrl);
  }

  return {
    mode,
    anglesCount: numAngles,
    images: generatedUrls,
    prompt: initialPrompt
  };
}

module.exports = {
  buildProductStudioPrompt,
  generateProductStudioImages
};
