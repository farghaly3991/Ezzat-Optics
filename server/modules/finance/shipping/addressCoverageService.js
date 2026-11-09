/**
 * Phase A — Layered Address Coverage & Classification Service
 *
 * Implements the 5-step layered strategy required in Section 4.2:
 * 1. Normalize entered address/city (Arabic & English) and run deterministic matching
 *    against known governorates, cities, districts, aliases, and explicit coverage text.
 * 2. Optional fallback to the store's existing LLM integration when deterministic matching
 *    is ambiguous or finds no direct token match.
 * 3. Treat AI output strictly as a suggestion: validate that the suggested class exists,
 *    is active, and is eligible for the address.
 * 4. No external geocoding or paid APIs.
 * 5. When ambiguous or no reliable match is available, never silently assign an arbitrary
 *    class; instruct the customer to select an eligible class or clarify their address.
 */

const getShippingClassModel = require("./shippingClassModel");
const getAdminDataModel = require("../../settings/adminDataModel");
const { checkAiAvailable } = require("../../../core/middleware/aiDispatcher");
const { EGYPT_GEOGRAPHY_DICTIONARY } = require("../shared/constants");
const { createFinanceError } = require("../shared/validators");

const COVERAGE_STOP_WORDS = new Set([
  "governorate",
  "city",
  "district",
  "districts",
  "nearby",
  "listed",
  "area",
  "areas",
  "region",
  "regions",
  "and",
  "or",
  "the",
  "in",
  "to",
  "of",
  "all",
  "center",
  "محافظة",
  "محافظه",
  "مدينة",
  "مدينه",
  "مركز",
  "مراكز",
  "حي",
  "منطقة",
  "منطقه",
  "مناطق",
  "قرى",
  "المدن",
  "المراكز",
  "المجاورة",
  "المجاوره",
  "والمناطق",
  "والمراكز",
  "المحيطة",
  "المحيطه",
  "جميع",
  "كل",
  "في",
  "من",
  "إلى",
  "الى",
  "ما",
  "حولها"
]);

/**
 * Normalize Arabic and English geographic text for deterministic comparison.
 */
function normalizeGeoText(input = "") {
  if (!input) return "";
  return String(input)
    .toLowerCase()
    .replace(/[\u064B-\u065F\u0670\u0640]/g, "") // Remove Arabic diacritics & tatweel
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/[ىئ]/g, "ي")
    .replace(/ؤ/g, "و")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Tokenize normalized text into meaningful geographic words & phrases.
 */
function extractMeaningfulTokens(rawText = "") {
  const norm = normalizeGeoText(rawText);
  if (!norm) return [];

  // Split by common delimiters in original text first (commas, colons, dashes, slashes, "and", "و")
  const rawSegments = String(rawText || "")
    .split(/[,،;:\-–—/|()\n]+|\b(?:and|or)\b/i)
    .map((s) => normalizeGeoText(s))
    .filter(Boolean);

  const tokens = new Set();

  for (const seg of rawSegments) {
    // Strip leading/trailing stop words from segment
    const words = seg
      .split(" ")
      .map((w) => w.replace(/^و(?=.{3,})/, "")) // Strip Arabic conjunction prefix و on words >= 3 chars
      .filter((w) => w.length >= 2 && !COVERAGE_STOP_WORDS.has(w));

    if (words.length > 0) {
      const cleanedPhrase = words.join(" ");
      if (cleanedPhrase.length >= 3 && words.length <= 4) {
        tokens.add(cleanedPhrase);
      }
      for (const w of words) {
        if (w.length >= 3 && !COVERAGE_STOP_WORDS.has(w)) {
          tokens.add(w);
        }
      }
    }
  }

  return Array.from(tokens);
}

/**
 * Identify governorates and cities/districts from `EGYPT_GEOGRAPHY_DICTIONARY` present in a text.
 */
function detectDictionaryLocations(rawText = "") {
  const normText = ` ${normalizeGeoText(rawText)} `;
  if (!normText.trim()) {
    return { governorateKeys: [], matchedCities: [], byGovernorate: {} };
  }

  const governorateKeys = new Set();
  const matchedCities = [];
  const byGovernorate = {};

  for (const entry of EGYPT_GEOGRAPHY_DICTIONARY) {
    let govMatched = false;
    const govNames = [entry.governorateAr, entry.governorateEn, ...(entry.aliases || [])];
    for (const gName of govNames) {
      const normGov = normalizeGeoText(gName);
      if (normGov && normText.includes(` ${normGov} `)) {
        govMatched = true;
        break;
      }
    }

    const cityHits = [];
    for (const city of entry.citiesAndDistricts || []) {
      const normCity = normalizeGeoText(city);
      if (normCity && normText.includes(` ${normCity} `)) {
        cityHits.push(normCity);
      }
    }

    if (govMatched || cityHits.length > 0) {
      governorateKeys.add(entry.key);
      byGovernorate[entry.key] = {
        explicitGovernorateMatch: govMatched,
        cityHits
      };
      matchedCities.push(...cityHits);
    }
  }

  return {
    governorateKeys: Array.from(governorateKeys),
    matchedCities: Array.from(new Set(matchedCities)),
    byGovernorate
  };
}

/**
 * Extract structured coverage metadata from a Shipping Class's `coverageText` and `coverageRegions`.
 */
function buildClassCoverageIndex(shippingClass = {}) {
  const parts = [shippingClass.coverageText || ""];
  const regions = Array.isArray(shippingClass.coverageRegions) ? shippingClass.coverageRegions : [];

  for (const reg of regions) {
    if (reg.governorate) parts.push(reg.governorate);
    if (Array.isArray(reg.cities)) parts.push(...reg.cities);
    if (Array.isArray(reg.districts)) parts.push(...reg.districts);
    if (Array.isArray(reg.aliases)) parts.push(...reg.aliases);
  }

  const combinedText = parts.filter(Boolean).join(" , ");
  const dictDetection = detectDictionaryLocations(combinedText);
  const normalizedCoverageTokens = extractMeaningfulTokens(combinedText);

  return {
    hasCoverageRestriction: normalizedCoverageTokens.length > 0 || dictDetection.governorateKeys.length > 0,
    normalizedCoverageTokens,
    matchedGovernorateKeys: dictDetection.governorateKeys,
    matchedCities: dictDetection.matchedCities,
    byGovernorate: dictDetection.byGovernorate,
    normalizedFullText: normalizeGeoText(combinedText)
  };
}

/**
 * Score a single active shipping class against a normalized customer address.
 */
function scoreClassAgainstAddress(shippingClass, customerAddressInfo) {
  const classIndex = buildClassCoverageIndex(shippingClass);

  // If the class has no geographical restrictions defined, it is a general class
  if (!classIndex.hasCoverageRestriction) {
    return {
      classId: String(shippingClass._id),
      code: shippingClass.code,
      score: 1,
      isUnrestrictedClass: true,
      ineligibleForAddress: false,
      matchedReasons: ["general_unrestricted_class"]
    };
  }

  let score = 0;
  const matchedReasons = [];
  const addrNormPadded = ` ${customerAddressInfo.normalizedFull} `;

  // 1. Check dictionary city/district exact matches
  for (const city of classIndex.matchedCities) {
    if (addrNormPadded.includes(` ${city} `)) {
      score += 55;
      matchedReasons.push(`city_match:${city}`);
    }
  }

  // 2. Check dictionary governorate matches
  for (const govKey of classIndex.matchedGovernorateKeys) {
    if (customerAddressInfo.dict.governorateKeys.includes(govKey)) {
      score += 35;
      matchedReasons.push(`governorate_match:${govKey}`);
    }
  }

  // 3. Check explicit coverage tokens (for custom districts/villages not in static dictionary)
  for (const token of classIndex.normalizedCoverageTokens) {
    if (token.length >= 3 && addrNormPadded.includes(` ${token} `)) {
      score += token.includes(" ") ? 30 : 20;
      matchedReasons.push(`token_match:${token}`);
    }
  }

  // 4. Check explicit conflict / ineligibility:
  // If the shipping class covers specific governorates (or explicit coverage tokens),
  // and the customer's address does not match it:
  let ineligibleForAddress = false;
  if (score === 0 && classIndex.hasCoverageRestriction) {
    if (
      customerAddressInfo.dict.governorateKeys.length > 0 &&
      classIndex.matchedGovernorateKeys.length > 0 &&
      !customerAddressInfo.dict.governorateKeys.some((g) => classIndex.matchedGovernorateKeys.includes(g))
    ) {
      ineligibleForAddress = true;
    } else if (customerAddressInfo.normalizedFull.length > 0) {
      ineligibleForAddress = true;
    }
  }

  return {
    classId: String(shippingClass._id),
    code: shippingClass.code,
    score,
    isUnrestrictedClass: false,
    ineligibleForAddress,
    matchedReasons
  };
}

/**
 * Optional AI fallback using tenant's configured LLM credentials (or injected resolver for tests).
 */
async function tryAiAddressFallback({
  addressText,
  activeClasses,
  adminData = {},
  aiClassifierFn = null
}) {
  if (!addressText || activeClasses.length === 0) return null;

  if (typeof aiClassifierFn === "function") {
    return aiClassifierFn({ addressText, activeClasses });
  }

  if (!checkAiAvailable({ adminData })) {
    return null;
  }

  const classesSummary = activeClasses.map((c) => ({
    code: c.code,
    name: c.name,
    coverageText: c.coverageText || ""
  }));

  const systemPrompt = [
    "You are an address-to-shipping-class classifier for an e-commerce store.",
    "Given the active shipping classes and their geographical coverage, suggest the single best matching class code for the customer's address.",
    "If the address is ambiguous or does not plausibly belong to any listed coverage, return null for suggestedClassCode.",
    'Respond ONLY in valid JSON: {"suggestedClassCode": "CODE_OR_NULL", "confidence": "high|medium|low", "reason": "..."}'
  ].join("\n");

  const userPrompt = JSON.stringify({
    customerAddress: addressText,
    shippingClasses: classesSummary
  });

  try {
    const apiKey = (adminData.AI_API_KEY || adminData.aiApiKey || process.env.AI_API_KEY || "").trim();
    const baseUrl = (adminData.AI_BASE_URL || process.env.AI_BASE_URL || "https://api.deepseek.com").trim();
    const model = (adminData.AI_MODEL || process.env.AI_MODEL || "deepseek-chat").trim();

    if (apiKey.length > 5) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 3500);
      try {
        const response = await fetch(`${baseUrl.replace(/\/+$/, "")}/chat/completions`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            model,
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: userPrompt }
            ],
            temperature: 0.1,
            response_format: { type: "json_object" }
          }),
          signal: controller.signal
        });
        clearTimeout(timer);
        if (response.ok) {
          const data = await response.json();
          const content = (data.choices?.[0]?.message?.content || "")
            .replace(/```json/gi, "")
            .replace(/```/g, "")
            .trim();
          if (content) return JSON.parse(content);
        }
      } catch {
        clearTimeout(timer);
      }
    }
  } catch (err) {
    console.warn("[SHIPPING_AI_FALLBACK_WARN]", err.message);
  }

  return null;
}

/**
 * Classify a customer's address and suggest the matching active shipping class.
 */
async function classifyCustomerAddress(subdomain, {
  address = "",
  city = "",
  adminData = null,
  allowAiFallback = true,
  aiClassifierFn = null
} = {}) {
  const ShippingClass = getShippingClassModel(subdomain);
  const activeClasses = await ShippingClass.find({ active: true })
    .sort({ sortOrder: 1, createdAt: 1 })
    .lean();

  if (activeClasses.length === 0) {
    return {
      hasConfiguredClasses: false,
      matchedClass: null,
      suggestedClass: null,
      ambiguous: false,
      requiresCustomerSelection: false,
      matchMethod: "no_classes_configured",
      eligibleClasses: [],
      allActiveClasses: [],
      message: ""
    };
  }

  const combinedInput = [city, address].filter(Boolean).join(" ، ").trim();
  const normalizedFull = normalizeGeoText(combinedInput);
  const dict = detectDictionaryLocations(combinedInput);

  if (!normalizedFull) {
    return {
      hasConfiguredClasses: true,
      matchedClass: null,
      suggestedClass: null,
      ambiguous: true,
      requiresCustomerSelection: true,
      matchMethod: "empty_address",
      eligibleClasses: activeClasses,
      allActiveClasses: activeClasses,
      message: "يرجى إدخال العنوان والمدينة لتحديد فئة الشحن المناسبة أو اختيار الفئة يدوياً."
    };
  }

  const customerAddressInfo = {
    raw: combinedInput,
    normalizedFull,
    dict
  };

  const scored = activeClasses.map((cls) => ({
    shippingClass: cls,
    evaluation: scoreClassAgainstAddress(cls, customerAddressInfo)
  }));

  // Separate regional matches (score > 1) from unrestricted fallback classes (score === 1)
  const regionalMatches = scored
    .filter((s) => !s.evaluation.isUnrestrictedClass && s.evaluation.score > 0)
    .sort((a, b) => b.evaluation.score - a.evaluation.score);

  const unrestrictedClasses = scored
    .filter((s) => s.evaluation.isUnrestrictedClass)
    .map((s) => s.shippingClass);

  // Check if customer entered conflicting governorates that map to different shipping classes
  if (dict.governorateKeys.length > 1 && regionalMatches.length > 1) {
    const distinctTopClasses = regionalMatches.filter((m) => m.evaluation.score >= 30);
    if (distinctTopClasses.length > 1) {
      const candidateClasses = distinctTopClasses.map((m) => m.shippingClass);
      return {
        hasConfiguredClasses: true,
        matchedClass: null,
        suggestedClass: null,
        ambiguous: true,
        requiresCustomerSelection: true,
        matchMethod: "ambiguous_conflicting_regions",
        candidateClasses,
        eligibleClasses: candidateClasses,
        allActiveClasses: activeClasses,
        message: "العنوان المدخل يتضمن أكثر من منطقة جغرافية. يرجى توضيح العنوان أو اختيار فئة الشحن الصحيحة لوجهتك."
      };
    }
  }

  // Case 1: Clear deterministic regional match
  if (regionalMatches.length === 1) {
    const winner = regionalMatches[0];
    return {
      hasConfiguredClasses: true,
      matchedClass: winner.shippingClass,
      suggestedClass: winner.shippingClass,
      ambiguous: false,
      requiresCustomerSelection: false,
      confidence: "high",
      matchMethod: "deterministic",
      matchedReasons: winner.evaluation.matchedReasons,
      eligibleClasses: [winner.shippingClass, ...unrestrictedClasses],
      allActiveClasses: activeClasses,
      message: `تم تحديد فئة الشحن تلقائياً: ${winner.shippingClass.name}`
    };
  }

  if (regionalMatches.length > 1) {
    const first = regionalMatches[0];
    const second = regionalMatches[1];
    // If first score is strictly greater than second score (and not conflicting governorates), it's a deterministic match
    if (first.evaluation.score > second.evaluation.score) {
      return {
        hasConfiguredClasses: true,
        matchedClass: first.shippingClass,
        suggestedClass: first.shippingClass,
        ambiguous: false,
        requiresCustomerSelection: false,
        confidence: "high",
        matchMethod: "deterministic",
        matchedReasons: first.evaluation.matchedReasons,
        eligibleClasses: regionalMatches.map((m) => m.shippingClass),
        allActiveClasses: activeClasses,
        message: `تم تحديد فئة الشحن تلقائياً: ${first.shippingClass.name}`
      };
    }

    // Tied deterministic regional scores -> ambiguous, ask customer or try AI fallback
  }

  // Case 2: Try optional AI fallback if enabled and deterministic did not produce a single winner
  if (allowAiFallback) {
    let resolvedAdminData = adminData;
    if (!resolvedAdminData && !aiClassifierFn) {
      try {
        const AdminData = getAdminDataModel(subdomain);
        resolvedAdminData = await AdminData.findOne().lean();
      } catch {
        resolvedAdminData = {};
      }
    }

    const aiSuggestion = await tryAiAddressFallback({
      addressText: combinedInput,
      activeClasses,
      adminData: resolvedAdminData || {},
      aiClassifierFn
    });

    if (aiSuggestion && aiSuggestion.suggestedClassCode) {
      const targetCode = String(aiSuggestion.suggestedClassCode).trim().toUpperCase();
      const matchedScored = scored.find((s) => s.shippingClass.code === targetCode);

      // Step 3: Validate that AI-suggested class exists, is active, and is not deterministically ineligible!
      // If the address had zero deterministic regional matches against restricted classes, only accept AI suggestion
      // if the AI confidence is high/medium AND the customer address does not contradict the class's governorate.
      if (matchedScored && matchedScored.shippingClass.active) {
        const hasContradictingGov =
          dict.governorateKeys.length > 0 &&
          matchedScored.evaluation.ineligibleForAddress;

        if (!hasContradictingGov && aiSuggestion.confidence !== "low") {
          return {
            hasConfiguredClasses: true,
            matchedClass: matchedScored.shippingClass,
            suggestedClass: matchedScored.shippingClass,
            isAiSuggestion: true,
            ambiguous: false,
            requiresCustomerSelection: false,
            confidence: aiSuggestion.confidence || "medium",
            matchMethod: "ai_suggestion",
            eligibleClasses: activeClasses,
            allActiveClasses: activeClasses,
            message: `اقتراح فئة الشحن حسب العنوان: ${matchedScored.shippingClass.name} (يرجى التأكد من مطابقتها لوجهتك)`
          };
        }
      }
    }
  }

  // Case 3: If only unrestricted general classes exist and no regional classes are configured at all
  const restrictedClassesCount = scored.filter((s) => !s.evaluation.isUnrestrictedClass).length;
  if (restrictedClassesCount === 0 && unrestrictedClasses.length === 1) {
    return {
      hasConfiguredClasses: true,
      matchedClass: unrestrictedClasses[0],
      suggestedClass: unrestrictedClasses[0],
      ambiguous: false,
      requiresCustomerSelection: false,
      confidence: "medium",
      matchMethod: "general_class",
      eligibleClasses: unrestrictedClasses,
      allActiveClasses: activeClasses,
      message: `فئة الشحن الافتراضية: ${unrestrictedClasses[0].name}`
    };
  }

  // Step 5: Ambiguous or no reliable match -> never silently assign an arbitrary class!
  const candidateClasses =
    regionalMatches.length > 0
      ? regionalMatches.map((m) => m.shippingClass)
      : activeClasses;

  return {
    hasConfiguredClasses: true,
    matchedClass: null,
    suggestedClass: null,
    ambiguous: true,
    requiresCustomerSelection: true,
    confidence: "none",
    matchMethod: regionalMatches.length > 1 ? "ambiguous_tie" : "unmatched",
    candidateClasses,
    eligibleClasses: candidateClasses,
    allActiveClasses: activeClasses,
    message:
      regionalMatches.length > 1
        ? "العنوان المدخل يطابق أكثر من فئة شحن. يرجى اختيار فئة الشحن المناسبة لوجهتك."
        : "لم نتمكن من مطابقة العنوان تلقائياً مع مناطق التغطية المسجلة. يرجى توضيح المحافظة/المدينة أو اختيار فئة الشحن التي تغطي وجهتك."
  };
}

/**
 * Validate a customer-submitted or server-resolved shipping class against the destination address.
 */
async function validateShippingClassForAddress(subdomain, {
  shippingClassId = null,
  shippingClassCode = null,
  address = "",
  city = "",
  requireCoverageMatch = true
} = {}) {
  const ShippingClass = getShippingClassModel(subdomain);

  let selectedClass = null;
  if (shippingClassId) {
    const mongoose = require("mongoose");
    if (!mongoose.isValidObjectId(shippingClassId)) {
      throw createFinanceError("معرف فئة الشحن المختارة غير صالح", 400, "INVALID_SHIPPING_CLASS_ID");
    }
    selectedClass = await ShippingClass.findById(shippingClassId).lean();
  } else if (shippingClassCode) {
    selectedClass = await ShippingClass.findOne({
      code: String(shippingClassCode).trim().toUpperCase()
    }).lean();
  }

  if (!selectedClass) {
    throw createFinanceError("فئة الشحن المختارة غير موجودة", 400, "SHIPPING_CLASS_NOT_FOUND");
  }

  if (!selectedClass.active) {
    throw createFinanceError("فئة الشحن المختارة غير نشطة حالياً ولا يمكن استخدامها", 400, "SHIPPING_CLASS_INACTIVE");
  }

  const combinedInput = [city, address].filter(Boolean).join(" ، ").trim();
  if (combinedInput && requireCoverageMatch) {
    const customerAddressInfo = {
      raw: combinedInput,
      normalizedFull: normalizeGeoText(combinedInput),
      dict: detectDictionaryLocations(combinedInput)
    };
    const evalResult = scoreClassAgainstAddress(selectedClass, customerAddressInfo);

    // If the customer's address clearly specifies a known governorate/city that is covered by ANOTHER active class,
    // or if this selected class explicitly covers specific governorates/regions and the address clearly specifies
    // a different governorate or has zero overlap when another class matches:
    if (evalResult.ineligibleForAddress) {
      const classIndex = buildClassCoverageIndex(selectedClass);
      const allActive = await ShippingClass.find({ active: true }).lean();
      const otherMatchingClass = allActive.find((other) => {
        if (String(other._id) === String(selectedClass._id)) return false;
        const otherEval = scoreClassAgainstAddress(other, customerAddressInfo);
        return !otherEval.isUnrestrictedClass && otherEval.score > 0;
      });

      const explicitGovernorateConflict =
        customerAddressInfo.dict.governorateKeys.length > 0 &&
        classIndex.matchedGovernorateKeys.length > 0 &&
        !customerAddressInfo.dict.governorateKeys.some((g) => classIndex.matchedGovernorateKeys.includes(g));

      if (explicitGovernorateConflict || otherMatchingClass) {
        throw createFinanceError(
          `فئة الشحن المختارة (${selectedClass.name}) لا تغطي العنوان المحدد (${combinedInput}). يرجى اختيار الفئة المناسبة لوجهتك.`,
          400,
          "SHIPPING_CLASS_COVERAGE_MISMATCH"
        );
      }
    }
  }

  return selectedClass;
}

module.exports = {
  normalizeGeoText,
  extractMeaningfulTokens,
  detectDictionaryLocations,
  buildClassCoverageIndex,
  scoreClassAgainstAddress,
  classifyCustomerAddress,
  validateShippingClassForAddress
};
