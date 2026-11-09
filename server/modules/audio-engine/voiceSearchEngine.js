const { transcribeAudio } = require("./voiceProvider");
const { loadAudioAsBuffer } = require("./audioLoader");
const { searchCatalog } = require("../semantic-engine/searchEngine");

/**
 * Transcribes audio specifically for storefront consumer product search queries
 */
async function transcribeVoiceSearch(audioSource, mimeType = "audio/webm", adminData = {}) {
  const loaded = await loadAudioAsBuffer(audioSource, { mimeType });
  if (!loaded?.buffer) {
    throw new Error("Invalid or unreadable audio source for voice search");
  }

  const searchPrompt =
    "أنت مساعد صوتي لبحث متجر تجاري في مصر. استمع للمتسوق واكتب عبارة البحث الدلالية التي يبحث عنها (اسم المنتج، الموديل، الماركة، أو القسم) " +
    "بنفس الألفاظ بدقة متناهية دون أي كلمات ترحيبية أو تعليقات.";

  return await transcribeAudio(loaded.buffer, loaded.mimeType, {
    prompt: searchPrompt,
    adminData
  });
}

/**
 * Searches the store catalog using audio speech (Voice Search).
 * Converts spoken voice to text and runs a semantic catalog query via the Unified Semantic Engine.
 */
async function searchCatalogByVoice(subdomain, options = {}) {
  const {
    audioSource = null,
    mimeType = "audio/webm",
    limit = 8,
    adminData = {}
  } = options;

  if (!audioSource) {
    throw new Error("No audio source provided for voice search");
  }

  const transcribedQuery = await transcribeVoiceSearch(audioSource, mimeType, adminData);

  let matchedProducts = [];
  if (transcribedQuery && transcribedQuery.trim()) {
    const searchRes = await searchCatalog(subdomain, {
      query: transcribedQuery.trim(),
      limit
    });
    matchedProducts = searchRes?.products || [];
  }

  return {
    transcribedQuery,
    products: matchedProducts,
    count: matchedProducts.length
  };
}

module.exports = {
  transcribeVoiceSearch,
  searchCatalogByVoice
};
