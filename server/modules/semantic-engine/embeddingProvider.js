const axios = require("axios");
const crypto = require("crypto");

const VECTOR_DIM = 768;
const GEMINI_EMBEDDING_MODEL = "gemini-embedding-001";
const GEMINI_EMBEDDING_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_EMBEDDING_MODEL}:embedContent`;
const GEMINI_BATCH_EMBEDDING_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_EMBEDDING_MODEL}:batchEmbedContents`;

// In-memory LRU cache for Gemini embeddings to avoid redundant API calls & 429 rate limits
const EMBEDDING_CACHE_MAX = 400;
const embeddingCache = new Map();

function getCachedEmbedding(cacheKey) {
  if (!embeddingCache.has(cacheKey)) return null;
  const val = embeddingCache.get(cacheKey);
  embeddingCache.delete(cacheKey);
  embeddingCache.set(cacheKey, val);
  return val;
}

function setCachedEmbedding(cacheKey, vector) {
  if (embeddingCache.size >= EMBEDDING_CACHE_MAX) {
    const oldestKey = embeddingCache.keys().next().value;
    embeddingCache.delete(oldestKey);
  }
  embeddingCache.set(cacheKey, vector);
}

function computeTextHash(text = "") {
  return crypto.createHash("sha256").update(String(text || "").trim(), "utf8").digest("hex").slice(0, 32);
}

// Arabic stop words for lexical & query tokenization
const STOP_WORDS = new Set([
  "في", "من", "على", "إلى", "عن", "مع", "هذا", "هذه", "ذلك", "تلك", "التي", "الذي",
  "الذين", "أو", "ثم", "إن", "أن", "كان", "كانت", "هو", "هي", "هم", "هن", "ما", "لم",
  "لن", "لا", "قد", "كل", "بعض", "غير", "بين", "حول", "خلال", "حيث", "كما", "لكن",
  "عايز", "عاوز", "محتاج", "ابحث", "بحث", "عندكم", "فيها", "حاجة", "حاجه", "شيء"
]);

function normalizeArabicText(text = "") {
  if (!text || typeof text !== "string") return "";
  return text
    .toLowerCase()
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/ى/g, "ي")
    .replace(/ؤ/g, "و")
    .replace(/ئ/g, "ي")
    .replace(/[\u064B-\u065F\u0670\u0640]/g, "") // Diacritics & Tatweel
    .replace(/[\u06D6-\u06ED]/g, "")
    .replace(/[^\w\s\u0600-\u06FF]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function fnv1aHash(str, seed = 2166136261) {
  let h = seed >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}

// Optics & Retail domain synonym clusters (Egyptian dialect, MSA, English terms, & Brand Transliterations)
const OPTICS_SYNONYM_GROUPS = [
  ["تشمبر", "شمبر", "شنبر", "شنابر", "اطار", "اطارات", "فريم", "فريمات", "نظاره", "نظارات", "شاسيه", "frame", "frames", "eyewear", "eyeglasses", "optical frame"],
  ["عدسه", "عدسات", "لنس", "عدسه طبيه", "عدسات طبيه", "زوج عدسات", "lens", "lenses", "optical lens"],
  ["شمس", "شمسيه", "شمسيات", "نظاره شمس", "نظارات شمس", "نظاره شمسيه", "sunglass", "sunglasses", "uv400"],
  ["بلوكت", "بلو", "كت", "بلو كات", "bluecut", "blue cut", "uv420", "شاشات", "كمبيوتر", "لابتوب", "موبايل", "اشعه زرقاء", "الاشعه الزرقاء", "اجهاد العين"],
  ["فوتو", "فوتوكروميك", "transitions", "ترانزيشن", "متغيره", "بتغمق", "شمس وطبي", "photochromic"],
  ["لاصقه", "لاصق", "عدسات لاصقه", "لينسز", "لنسز", "contact", "contacts", "contact lens"],
  ["محلول", "تعقيم", "حفظ", "محلول عدسات", "renu", "رينيو", "solution"],
  ["رايبان", "راي بان", "ريبان", "rayban", "ray-ban", "ray ban", "aviator", "افياتور"],
  ["اوكلي", "أوكلي", "oakley"],
  ["كريزال", "crizal", "اسيلور", "إسيلور", "essilor"],
  ["زيس", "زايس", "zeiss"],
  ["هويا", "hoya"],
  ["تيتانيوم", "titanium", "خفيف", "مرن", "مقاوم للكسر", "tr90"],
  ["مضغوط", "مضغوطه", "رفيعه", "فائقه النحافه", "high index", "1.67", "1.74", "1.61"]
];

/**
 * Expand tokens using built-in domain synonym clusters + optional per-tenant custom synonyms
 */
function expandDomainTokens(rawTokens = [], customSynonymGroups = []) {
  const expanded = new Set(rawTokens);
  const allGroups = [
    ...OPTICS_SYNONYM_GROUPS,
    ...(Array.isArray(customSynonymGroups) ? customSynonymGroups : [])
  ];

  for (const t of rawTokens) {
    if (!t || t.length < 2) continue;
    for (const group of allGroups) {
      if (!Array.isArray(group)) continue;
      const normalizedGroup = group.map((g) => normalizeArabicText(String(g))).filter(Boolean);
      const matched = normalizedGroup.some((g) => g === t || g.split(" ").includes(t));
      if (matched) {
        normalizedGroup.forEach((syn) => {
          syn.split(" ").forEach((s) => {
            if (s.length >= 2) expanded.add(s);
          });
        });
      }
    }
  }
  return Array.from(expanded);
}

/**
 * Checks whether a stored vector is a genuine 768-d dense Gemini neural embedding
 * rather than an empty array or a sparse local CountSketch projection.
 */
function isGeminiEmbeddingVector(vec, embeddingModel = "") {
  if (!Array.isArray(vec) || vec.length !== VECTOR_DIM) return false;
  if (embeddingModel === GEMINI_EMBEDDING_MODEL) return true;
  if (embeddingModel && embeddingModel !== GEMINI_EMBEDDING_MODEL) return false;

  // Heuristic verification for legacy documents without embeddingModel field:
  // Gemini neural vectors are dense (>96% non-zero values), whereas local CountSketch vectors have density <0.85
  let nonZero = 0;
  for (let i = 0; i < vec.length; i++) {
    if (Math.abs(vec[i]) > 1e-7) nonZero++;
  }
  return nonZero / VECTOR_DIM >= 0.95;
}

/**
 * Legacy local 768-d CountSketch projection (kept only for isolated offline unit tests if explicitly requested).
 * Product & Search pipelines NEVER mix this with Gemini embeddings.
 */
function buildLocalSemanticVector(text, extraTags = []) {
  const vec = new Float32Array(VECTOR_DIM);
  const normalized = normalizeArabicText(text);
  const rawTokens = normalized.split(" ").filter((t) => t.length >= 2 && !STOP_WORDS.has(t));
  const tokens = expandDomainTokens(rawTokens);

  function addFeature(key, weight) {
    const h1 = fnv1aHash(key, 2166136261);
    const h2 = fnv1aHash(key, 374761393);
    const idx1 = h1 % VECTOR_DIM;
    const sign1 = (h2 & 1) === 0 ? 1 : -1;
    vec[idx1] += sign1 * weight;

    const idx2 = (h2 >>> 1) % VECTOR_DIM;
    const sign2 = (h1 & 1) === 0 ? 1 : -1;
    vec[idx2] += sign2 * (weight * 0.5);
  }

  for (let i = 0; i < tokens.length; i++) {
    const tok = tokens[i];
    addFeature(`tok:${tok}`, 3.0);
    if (tok.length >= 3) {
      for (let j = 0; j <= tok.length - 3; j++) {
        addFeature(`cg3:${tok.slice(j, j + 3)}`, 0.8);
      }
    }
    if (i < tokens.length - 1) {
      addFeature(`bg:${tok}_${tokens[i + 1]}`, 1.8);
    }
  }

  if (Array.isArray(extraTags)) {
    for (const tag of extraTags) {
      const normTag = normalizeArabicText(tag);
      if (normTag) {
        addFeature(`tag:${normTag}`, 4.0);
      }
    }
  }

  return normalizeVector(Array.from(vec));
}

/**
 * Unit normalize an arbitrary vector
 */
function normalizeVector(vec) {
  if (!Array.isArray(vec) || vec.length === 0) return [];
  let sumSq = 0;
  for (let i = 0; i < vec.length; i++) {
    sumSq += vec[i] * vec[i];
  }
  const norm = Math.sqrt(sumSq);
  if (norm === 0) return vec;
  return vec.map((v) => Number((v / norm).toFixed(6)));
}

/**
 * Fast Cosine Similarity between two unit-normalized vectors.
 */
function cosineSimilarity(vecA, vecB) {
  if (!Array.isArray(vecA) || !Array.isArray(vecB) || vecA.length !== VECTOR_DIM || vecB.length !== VECTOR_DIM) {
    return 0;
  }
  let dot = 0;
  for (let i = 0; i < VECTOR_DIM; i++) {
    dot += vecA[i] * vecB[i];
  }
  return Math.max(0, Math.min(1, dot));
}

function resolveGeminiApiKey(options = {}) {
  return (
    options.apiKey ||
    options.adminData?.GEMINI_API_KEY ||
    options.adminData?.geminiApiKey ||
    process.env.GEMINI_API_KEY ||
    ""
  ).trim();
}

/**
 * Strictly generate a 768-d Google Gemini embedding (gemini-embedding-001).
 * Never returns a fake local vector. If Gemini is unavailable or fails, returns { vector: null, isGemini: false }.
 */
async function generateGeminiEmbeddingStrict(text, options = {}) {
  const cleanText = (text || "").trim();
  if (!cleanText) {
    return { vector: null, model: null, isGemini: false, error: "EMPTY_TEXT" };
  }

  const apiKey = resolveGeminiApiKey(options);
  if (!apiKey) {
    return { vector: null, model: null, isGemini: false, error: "MISSING_GEMINI_API_KEY" };
  }

  const taskType = options.taskType || "RETRIEVAL_QUERY";
  const cacheKey = `${taskType}:${computeTextHash(cleanText)}`;
  if (!options.skipCache) {
    const cached = getCachedEmbedding(cacheKey);
    if (cached) {
      return { vector: cached, model: GEMINI_EMBEDDING_MODEL, isGemini: true, cached: true };
    }
  }

  const maxAttempts = options.maxAttempts || 2;
  let lastError = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const payload = {
        model: `models/${GEMINI_EMBEDDING_MODEL}`,
        content: { parts: [{ text: cleanText }] },
        taskType,
        outputDimensionality: VECTOR_DIM
      };

      const res = await axios.post(GEMINI_EMBEDDING_URL, payload, {
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey
        },
        timeout: options.timeout || 10000
      });

      const values = res.data?.embedding?.values;
      if (Array.isArray(values) && values.length === VECTOR_DIM) {
        const normalized = normalizeVector(values);
        setCachedEmbedding(cacheKey, normalized);
        return { vector: normalized, model: GEMINI_EMBEDDING_MODEL, isGemini: true, cached: false };
      }
      lastError = "INVALID_GEMINI_VECTOR_SHAPE";
    } catch (err) {
      const status = err.response?.status;
      lastError = err.response?.data?.error?.message || err.message;
      if ((status === 429 || status === 503) && attempt < maxAttempts) {
        await new Promise((r) => setTimeout(r, 1200 * attempt));
        continue;
      }
      break;
    }
  }

  console.warn(`[GEMINI_EMBEDDING_STRICT_WARN] Gemini embedding unavailable (${lastError})`);
  return { vector: null, model: null, isGemini: false, error: lastError };
}

/**
 * Batch generate 768-d Gemini embeddings using batchEmbedContents (up to 50 texts per single HTTP request).
 * Avoids N separate network calls and prevents HTTP 429 rate-limiting when syncing product catalogs.
 */
async function generateGeminiBatchEmbeddings(texts = [], options = {}) {
  if (!Array.isArray(texts) || texts.length === 0) return [];

  const apiKey = resolveGeminiApiKey(options);
  if (!apiKey) {
    console.warn("[GEMINI_BATCH_EMBEDDING_WARN] Missing GEMINI_API_KEY");
    return texts.map(() => null);
  }

  const taskType = options.taskType || "RETRIEVAL_DOCUMENT";
  const results = new Array(texts.length).fill(null);
  const BATCH_SIZE = 50;

  for (let start = 0; start < texts.length; start += BATCH_SIZE) {
    const chunk = texts.slice(start, start + BATCH_SIZE);
    const requests = chunk.map((t) => ({
      model: `models/${GEMINI_EMBEDDING_MODEL}`,
      content: { parts: [{ text: String(t || "").trim() || "منتج" }] },
      taskType,
      outputDimensionality: VECTOR_DIM
    }));

    let attempt = 0;
    const maxAttempts = 3;
    while (attempt < maxAttempts) {
      attempt++;
      try {
        const res = await axios.post(
          GEMINI_BATCH_EMBEDDING_URL,
          { requests },
          {
            headers: {
              "Content-Type": "application/json",
              "x-goog-api-key": apiKey
            },
            timeout: 25000
          }
        );

        const embeddings = res.data?.embeddings || [];
        embeddings.forEach((emb, idx) => {
          const vals = emb?.values;
          if (Array.isArray(vals) && vals.length === VECTOR_DIM) {
            const normVec = normalizeVector(vals);
            results[start + idx] = normVec;
            const cacheKey = `${taskType}:${computeTextHash(chunk[idx])}`;
            setCachedEmbedding(cacheKey, normVec);
          }
        });
        break;
      } catch (err) {
        const status = err.response?.status;
        const msg = err.response?.data?.error?.message || err.message;
        if ((status === 429 || status === 503) && attempt < maxAttempts) {
          await new Promise((r) => setTimeout(r, 1500 * attempt));
          continue;
        }
        console.warn(`[GEMINI_BATCH_EMBEDDING_ERR] Batch [${start}..${start + chunk.length - 1}] failed: ${msg}`);
        break;
      }
    }
  }

  return results;
}

/**
 * Primary embedding generator across the platform.
 * Returns a 768-d Gemini vector, or [] if Gemini is unavailable (never mixes local hash vectors with Gemini vectors).
 */
async function generateEmbedding(text, options = {}) {
  const strictRes = await generateGeminiEmbeddingStrict(text, options);
  if (strictRes.isGemini && Array.isArray(strictRes.vector)) {
    return strictRes.vector;
  }
  if (options.allowLocalFallback === true) {
    return buildLocalSemanticVector(text, options.extraTags || []);
  }
  return [];
}

module.exports = {
  VECTOR_DIM,
  GEMINI_EMBEDDING_MODEL,
  STOP_WORDS,
  generateEmbedding,
  generateGeminiEmbeddingStrict,
  generateGeminiBatchEmbeddings,
  isGeminiEmbeddingVector,
  computeTextHash,
  buildLocalSemanticVector,
  normalizeVector,
  cosineSimilarity,
  normalizeArabicText,
  OPTICS_SYNONYM_GROUPS,
  expandDomainTokens
};
