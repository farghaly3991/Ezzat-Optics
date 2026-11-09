const axios = require("axios");
const getProductsModel = require("../products/productModel");
const getCategoriesModel = require("../categories/categoryModel");
const { getStoreCategorySchema } = require("../../core/ai/schemaExtractor");
const { callUnifiedChat } = require("../../core/ai/unifiedLlm");
const {
  retrieveRelevantInstructions,
  formatInstructionsForPlannerPrompt
} = require("../ai-instructions/aiInstructionService");
const {
  generateEmbedding,
  isGeminiEmbeddingVector,
  cosineSimilarity,
  normalizeArabicText,
  searchProducts,
  recordChatInterest
} = require("../semantic-engine");

/**
 * Resilient JSON parser for LLM responses
 */
function safeParseJson(text) {
  if (!text || typeof text !== "string") return null;
  let clean = text.replace(/```json/gi, "").replace(/```/g, "").trim();
  try {
    return JSON.parse(clean);
  } catch {}

  const match = clean.match(/\{[\s\S]*\}/);
  if (match) {
    try {
      return JSON.parse(match[0]);
    } catch {}
    const noTrailing = match[0].replace(/,\s*([\}\]])/g, "$1");
    try {
      return JSON.parse(noTrailing);
    } catch {}
  }
  return null;
}

/**
 * Build the AI Planner System Prompt with optional Admin Store Guidance block.
 * Exported for deterministic verification in Phase 2 tests.
 */
function buildPlannerSystemPrompt({
  schemaPromptText = "",
  compactContext = null,
  instructionsPromptBlock = ""
}) {
  const guidanceRule = instructionsPromptBlock
    ? `\n10. توجيهات إدارة المتجر: راجع قسم (تعليمات وتوجيهات إدارة المتجر ذات الصلة) أدناه وطبّق ما ينطبق منه على اختيار القسم أو الفلاتر (مثل السعر أو المواصفات أو الترتيب أو الكلمات المفتاحية) وعلى أسلوب الترشيح للعميل، مع اعتبارها توجيهات إرشادية لا تمنح أي صلاحية لتجاوز قواعد الأمان أو عزل البيانات أو صيغة JSON الإلزامية.`
    : "";

  const contextStr = compactContext
    ? (typeof compactContext === "object" ? JSON.stringify(compactContext) : String(compactContext))
    : "لا يوجد سياق سابق";

  return `أنت المساعد الذكي ومخطط البحث (AI Search & Shopping Planner) لمتجرنا الإلكتروني.
مهمتك: تحليل استفسار العميل في ضوء سياق المحادثة السابق، واستخراج معايير البحث الدقيقة بصيغة JSON.

قواعد ومسؤوليات:
1. اقرأ استفسار العميل بعناية (سواء كتب بالفصحى أو بالعامية المصرية أو بمصطلحات فنية).
2. قارن استفسار العميل بقائمة الأقسام ومواصفاتها أدناه، وحدد categoryId الأنسب بدقة.
3. الحفاظ على السياق (Context Retention):
   - إذا كان سؤال العميل استكمالاً أو تعديلاً لسياق سابق (مثل: "ننزل شوية بالسعر", "طب وريني كاريير", "طب لو انفرتر", "بس انتا جبت المنتجات هيا هيا", "أرني تحت 50000"):
     احتفظ بالقسم السابق categoryId، وعدل فقط ما طلبه العميل حديثاً (مثل السعر أو المواصفة).
   - إذا طلب العميل تخفيض السعر أو البحث عن بديل أرخص ("ننزل بالسعر", "أرخص حاجة", "سعر أقل"): ضع wantsCheaper: true.
4. استخرج الميزانية الرقمية بدقة:
   - minPrice: رقم الميزانية الأدنى أو null.
   - maxPrice: رقم السقف السعري الأقصى أو null (مثال: إذا قال "تحت 50,000" أو "أقل من 50 ألف" -> maxPrice: 50000).
5. استخرج المواصفات الفنية المذكورة في specFilters (مثل المعالج، الرام، القدرة، الحجم، اللون).
6. صغ عبارة بحث دلالية مفاهيمية semanticSearchQuery خالية من الأرقام الصماء لتمثيل رغبة العميل (مثال: "لابتوب أداء عالي موجه للبرمجة والذكاء الاصطناعي وجرافيكس").
7. المقارنة: إذا طلب العميل مقارنة بين أجهزة، اجعل intent: "compare" واذكر الأسماء في compareTargetKeywords.${guidanceRule}

قائمة أقسام ومواصفات وأوسام المتجر:
${schemaPromptText}

سياق المحادثة السابقة:
${contextStr}${instructionsPromptBlock ? `\n${instructionsPromptBlock}\n` : ""}

يجب أن ترجع إجابتك بصيغة JSON فقط:
{
  "intent": "search" | "compare" | "budget_change" | "feedback" | "general",
  "categoryId": "معرف القسم من القائمة أعلاه أو null",
  "minPrice": 0,
  "maxPrice": 0,
  "wantsCheaper": false,
  "tags": ["الوسوم المطابقة"],
  "specFilters": { "اسم_المواصفة": "القيمة" },
  "searchKeywords": "اسم الماركة أو الموديل إن وجد",
  "semanticSearchQuery": "صياغة مفاهيمية دلالية للبحث بدون أرقام ميزانية",
  "compareTargetKeywords": [],
  "explanation": "رد مبدئي واضح",
  "compactSummary": "ملخص لحالة الطلب الحالية"
}`;
}

exports.buildPlannerSystemPrompt = buildPlannerSystemPrompt;

exports.handleChat = async (req, res, next) => {
  try {
    const {
      message = "",
      history = [],
      compactContext = null,
      selectedProductIds = [],
      mode = "search",
      sessionId: explicitSessionId = null
    } = req.body;

    const sessionId = explicitSessionId || req.headers["x-session-id"] || null;
    const userId = req.user ? req.user._id : null;

    const userMessage = message.trim();
    if (!userMessage) {
      return res.status(400).json({ error: "الرسالة فارغة" });
    }

    const adminData = req.adminData || {};
    const apiKey = (adminData.AI_API_KEY || adminData.aiApiKey || process.env.AI_API_KEY || "").trim();
    const geminiKey = (adminData.GEMINI_API_KEY || adminData.geminiApiKey || process.env.GEMINI_API_KEY || "").trim();
    const baseUrl = (adminData.AI_BASE_URL || process.env.AI_BASE_URL || "https://api.deepseek.com").trim();
    const model = (adminData.AI_MODEL || process.env.AI_MODEL || "deepseek-chat").trim();

    if (!apiKey && !geminiKey) {
      return res.status(403).json({
        done: false,
        error: "خدمة الذكاء الاصطناعي غير مفعلة أو لم يتم تعيين مفتاح API"
      });
    }

    const Products = getProductsModel(req.subdomain);
    const Categories = getCategoriesModel(req.subdomain);

    // Retrieve active store instructions safely
    let retrievedInstructions = [];
    let instructionsPromptBlock = "";
    try {
      const retrievalResult = await retrieveRelevantInstructions(req.subdomain, {
        query: userMessage,
        compactContext,
        selectedProductIds
      });
      retrievedInstructions = retrievalResult.instructions || [];
      instructionsPromptBlock = formatInstructionsForPlannerPrompt(retrievedInstructions);
    } catch (instErr) {
      console.warn("[AI_CHAT_INSTRUCTIONS_WARN] Continuing without custom instructions:", instErr.message);
    }

    const appliedInstructionsMeta = retrievedInstructions.map((inst) => ({
      _id: String(inst._id),
      title: inst.title,
      scopeType: inst.scopeType,
      similarityScore: inst.similarityScore
    }));

    // =========================================================================
    // SPECIAL MODE: COMPARE CONSULTATION ON FIXED PRE-LOADED PRODUCTS
    // =========================================================================
    if (mode === "compare_consult" && Array.isArray(selectedProductIds) && selectedProductIds.length >= 2) {
      const fixedProducts = await Products.find({
        _id: { $in: selectedProductIds.map(String) },
        active: true
      })
        .populate("categoryId")
        .lean();

      if (fixedProducts.length >= 2) {
        const prodSummaries = fixedProducts.map((p, idx) => {
          const combinedSpecs = { ...(p.opticsSpecs || {}), ...(p.specs || {}) };
          const specsStr = Object.entries(combinedSpecs)
            .filter(([k, v]) => v !== undefined && v !== null && v !== "" && k !== "matrixStock")
            .map(([k, v]) => `  - ${k}: ${Array.isArray(v) ? v.join("، ") : v}`)
            .join("\n");
          return `المنتج ${idx + 1}: "${p.name}"\nالسعر: ${p.price?.toLocaleString()} ج.م\nالتقييم: ${p.ratingAvg || 0} من 5 (${p.ratingCount || 0} تقييم)\nالقسم: ${p.categoryId?.name || "عام"}\nالمواصفات:\n${specsStr || "  - لا توجد مواصفات مفصلة"}`;
        }).join("\n\n");

        const compareSystemPrompt = `أنت الخبير الفني ومستشار التسوق الذكي المتخصص في المقارنات.
أمامك أجهزة محددة بدقة تم اختيارها للمقارنة:
${prodSummaries}

القواعد:
1. قارن بين هذه الأجهزة المحددة فقط وأجب عن سؤال العميل بدقة بناءً على المواصفات الحقيقية المذكورة.${instructionsPromptBlock ? `\n${instructionsPromptBlock}\n` : ""}
2. أرجع إجابتك بصيغة JSON فقط:
{
  "explanation": "ردك التفصيلي المقارن والواضح والمهني على العميل",
  "winnerProductId": "معرف _id للأفضل في نقطة المقارنة أو null",
  "suggestedActions": ["3 أسئلة لاحقة ذكية"]
}`;

        const conversationMessages = [
          { role: "system", content: compareSystemPrompt },
          ...history.slice(-4).map((h) => ({
            role: h.sender === "user" ? "user" : "assistant",
            content: typeof h.text === "string" ? h.text : JSON.stringify(h.text)
          })),
          { role: "user", content: userMessage }
        ];

        const llmCompareRes = await callUnifiedChat({
          subdomain: req.subdomain,
          adminData,
          messages: conversationMessages,
          temperature: 0.2,
          jsonMode: true,
          timeout: 22000
        });

        const parsed = llmCompareRes.parsed || safeParseJson(llmCompareRes.text) || {
          explanation: llmCompareRes.text || "إليك المقارنة المطلوبة:"
        };

        return res.json({
          done: true,
          engine: "ai-llm-comparison-consultant",
          mode: "compare_consult",
          reply: parsed.explanation || "إليك مقارنة دقيقة بين المنتجات:",
          matchedProducts: fixedProducts,
          comparisonProducts: fixedProducts,
          comparisonIds: fixedProducts.map((p) => String(p._id)),
          intent: "compare",
          winnerProductId: parsed.winnerProductId || null,
          appliedInstructions: appliedInstructionsMeta,
          suggestedActions: parsed.suggestedActions?.length > 0 ? parsed.suggestedActions : [
            "أيهما أفضل للألعاب والأداء الشاق؟",
            "أيهما كاميرته وشاشته أفضل لمشاهدة المحتوى؟",
            "أيهما يقدم أفضل قيمة مقابل السعر؟"
          ]
        });
      }
    }

    // =========================================================================
    // AGENT STEP 1: PLANNING & PARAMETER EXTRACTION
    // =========================================================================
    const { schemaPromptText } = await getStoreCategorySchema(req.subdomain);
    const plannerSystemPrompt = buildPlannerSystemPrompt({
      schemaPromptText,
      compactContext,
      instructionsPromptBlock
    });

    const conversationMessages = [
      { role: "system", content: plannerSystemPrompt },
      ...history.slice(-4).map((h) => ({
        role: h.sender === "user" ? "user" : "assistant",
        content: typeof h.text === "string" ? h.text : JSON.stringify(h.text)
      })),
      { role: "user", content: userMessage }
    ];

    let plan = null;
    try {
      const planRes = await callUnifiedChat({
        subdomain: req.subdomain,
        adminData,
        messages: conversationMessages,
        temperature: 0.1,
        jsonMode: true,
        timeout: 18000
      });
      plan = planRes.parsed || safeParseJson(planRes.text);
    } catch (err) {
      console.warn("[AI_CHAT_PLANNER_WARN] Planner call failed, using heuristic extraction:", err.message);
    }

    // Resilient fallback plan if LLM failed
    if (!plan) {
      const underMatch = userMessage.match(/(?:تحت|أقل من|اقل من|حدود|ميزانية)\s*(\d+)/i);
      plan = {
        intent: "search",
        categoryId: compactContext?.lastCategory || null,
        minPrice: null,
        maxPrice: underMatch ? Number(underMatch[1]) : (compactContext?.lastMaxPrice || null),
        wantsCheaper: userMessage.includes("ارخص") || userMessage.includes("أرخص") || userMessage.includes("ننزل"),
        searchKeywords: userMessage.replace(/[^\w\s\u0600-\u06FF]/g, " ").trim(),
        semanticSearchQuery: userMessage,
        specFilters: compactContext?.activeSpecs || {},
        compactSummary: compactContext?.summary || ""
      };
    }

    // Context Retention: inherit previous category if user continued in the same flow
    const effectiveCategoryId =
      plan.categoryId ||
      compactContext?.lastCategory ||
      compactContext?.activeCategory ||
      null;

    let targetCategory = null;
    if (effectiveCategoryId) {
      targetCategory = await Categories.findById(effectiveCategoryId).lean();
    }

    // Determine hard price constraints
    let minPriceConstraint = typeof plan.minPrice === "number" && plan.minPrice > 0 ? plan.minPrice : null;
    let maxPriceConstraint = typeof plan.maxPrice === "number" && plan.maxPrice > 0 ? plan.maxPrice : null;

    // Handle "ننزل بالسعر" or "عايز أرخص" when user didn't specify an explicit number
    if (plan.wantsCheaper && !maxPriceConstraint && compactContext?.activeProductPrices?.length) {
      const prevMin = Math.min(...compactContext.activeProductPrices.filter((p) => p > 0));
      if (prevMin > 0) {
        maxPriceConstraint = prevMin - 1; // Strictly lower than what was previously shown
      }
    }

    // =========================================================================
    // AGENT STEP 2: DETERMINISTIC DATABASE RETRIEVAL (STRICT CONSTRAINTS)
    // =========================================================================
    const mongoQuery = { active: true };

    if (effectiveCategoryId) {
      const childCategories = await Categories.find({ parentId: effectiveCategoryId, active: true }).lean();
      if (childCategories.length > 0) {
        mongoQuery.categoryId = { $in: [effectiveCategoryId, ...childCategories.map((c) => c._id)] };
      } else {
        mongoQuery.categoryId = effectiveCategoryId;
      }
    }

    if (minPriceConstraint || maxPriceConstraint) {
      mongoQuery.price = {};
      if (minPriceConstraint) mongoQuery.price.$gte = minPriceConstraint;
      if (maxPriceConstraint) mongoQuery.price.$lte = maxPriceConstraint;
    }

    if (plan.searchKeywords && !plan.wantsCheaper) {
      const kwClean = plan.searchKeywords.trim();
      if (kwClean.length >= 2) {
        const regex = new RegExp(kwClean.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
        mongoQuery.$or = [{ name: regex }, { tags: { $in: [regex] } }, { description: regex }];
      }
    }

    // Execute Strict Candidate Query
    let candidateProducts = await Products.find(mongoQuery)
      .populate("categoryId", "name slug")
      .select("_id name price oldPrice images ratingAvg visited salesCount categoryId productType opticsSpecs specs tags description embedding embeddingModel")
      .lean();

    // If strict regex returned 0 because user used dialect/synonyms (e.g. تشمبر، بلوكت، فريم),
    // fall back to our Unified Lexical + Gemini Semantic Search Engine!
    if (candidateProducts.length === 0 && !effectiveCategoryId) {
      const unifiedRes = await searchProducts(req.subdomain, {
        query: plan.semanticSearchQuery || plan.searchKeywords || userMessage,
        minPrice: minPriceConstraint,
        maxPrice: maxPriceConstraint,
        limit: 8,
        adminData
      });
      if (unifiedRes?.products?.length > 0) {
        candidateProducts = unifiedRes.products;
      }
    }

    // Check if zero products match due to budget
    let isOutOfBudget = false;
    let lowestAvailableInStore = null;

    if (candidateProducts.length === 0 && (maxPriceConstraint || plan.wantsCheaper) && effectiveCategoryId) {
      // Find the absolute cheapest active product in this category to inform the user honestly
      const cheapestInCat = await Products.find({ categoryId: mongoQuery.categoryId, active: true })
        .sort({ price: 1 })
        .limit(2)
        .populate("categoryId", "name slug")
        .lean();

      if (cheapestInCat.length > 0) {
        isOutOfBudget = true;
        lowestAvailableInStore = cheapestInCat[0].price;
        // Do NOT pretend they match the budget! Keep candidateProducts empty, but provide them as nearest reference
        candidateProducts = [];
      }
    }

    // =========================================================================
    // AGENT STEP 3: SEMANTIC VECTOR RESCORING (768-D GEMINI EMBEDDING)
    // =========================================================================
    let rankedProducts = [];

    if (candidateProducts.length > 0) {
      const semanticQuery = (plan.semanticSearchQuery || userMessage).trim();
      let queryVec = null;
      try {
        queryVec = await generateEmbedding(semanticQuery, { adminData, taskType: "RETRIEVAL_QUERY" });
      } catch (embErr) {
        console.warn("[AI_CHAT_EMBEDDING_WARN]", embErr.message);
      }

      const hasQueryGemini = isGeminiEmbeddingVector(queryVec);

      rankedProducts = candidateProducts.map((prod) => {
        let sim = typeof prod.similarityScore === "number" ? prod.similarityScore : 0.5;
        if (hasQueryGemini && isGeminiEmbeddingVector(prod.embedding, prod.embeddingModel)) {
          sim = cosineSimilarity(queryVec, prod.embedding);
        }

        // Price affinity score: if user mentioned min/max, reward items closer to target
        let priceBonus = 0;
        if (maxPriceConstraint && prod.price <= maxPriceConstraint) {
          priceBonus = 0.2;
        }

        const score = Math.round((sim * 0.7 + priceBonus + 0.1) * 100);
        return {
          ...prod,
          similarityScore: score,
          recommendationReason: `متوافق مع طلبك في قسم ${prod.categoryId?.name || "المتجر"}`
        };
      });

      rankedProducts.sort((a, b) => (b.similarityScore || 0) - (a.similarityScore || 0));
    }

    // =========================================================================
    // AGENT STEP 4: GROUNDED SYNTHESIS (HONEST, VERIFIED RESPONSE)
    // =========================================================================
    let replyText = "";
    let suggestedActions = [];
    let updatedSummary = "";

    const verifiedFacts = {
      userQuery: userMessage,
      categoryName: targetCategory?.name || "عام",
      maxPriceConstraint,
      isOutOfBudget,
      lowestAvailableInStore,
      matchedCount: rankedProducts.length,
      matchedItems: rankedProducts.slice(0, 3).map((p) => ({
        name: p.name,
        price: p.price,
        specs: { ...(p.opticsSpecs || {}), ...(p.specs || {}) }
      }))
    };

    const synthesisPrompt = `أنت مستشار التسوق الذكي لمتجرنا.
مهمتك: صياغة الرد النهائي على العميل بناءً على نتائج قاعدة البيانات الحقيقية المؤكدة فقط.

الوقائع المؤكدة من قاعدة البيانات:
${JSON.stringify(verifiedFacts, null, 2)}

سياق المحادثة السابق:
${compactContext?.summary || "بداية المحادثة"}

قواعد الصدق والدقة:
1. إذا كانت النتيجة أن السعر المطلوب غير متوفر (isOutOfBudget = true):
   - اعترف بذلك بوضوح وود: أخبر العميل أنه لا توجد أجهزة في المتجر بسعر تحت ${maxPriceConstraint?.toLocaleString() || ""} ج.م، وأن أقل لابتوب/جهاز متوفر لدينا حالياً سعره هو ${lowestAvailableInStore?.toLocaleString() || ""} ج.م.
   - لا تزعم أبداً أن هناك أجهزة مطابقة للميزانية إذا لم تكن موجودة!
   - اعرض عليه تسجيل رغبته لتبليغه فور توفر منتج بميزانيته المطلوبة.
2. إذا وجدت منتجات مطابقة (matchedCount > 0):
   - رحب به ورشح له المنتجات المذكورة في matchedItems فقط ووضح له سبب ترشيحها بناءً على مواصفاتها.
3. إذا أبدى العميل ملاحظة مثل "بس انت جبت المنتجات هيا هيا":
   - تجاوب معه بذكاء ووضوح، واشرح له طبيعة الموديلات المتاحة في المتجر في هذا القسم أو البدائل الممكنة.
4. حدث ملخص السياق (compactSummary) في سطرين يلخصان بدقة ما طلبه العميل، وما هي ميزانيته، وماذا تم إخباره به حتى الآن.

أرجع إجابتك بصيغة JSON فقط:
{
  "reply": "نص ردك الصادق والودود والمهني باللغة العربية",
  "compactSummary": "ملخص محدث وشامل لحالة العميل وميزانيته وطلباته للجولات القادمة",
  "suggestedActions": ["3 اقتراحات أو أسئلة ذكية ملائمة للوضع الحالي"],
  "suggestDesiredProduct": ${isOutOfBudget ? "true" : "false"}
}`;

    try {
      const synRes = await callUnifiedChat({
        subdomain: req.subdomain,
        adminData,
        messages: [{ role: "user", content: synthesisPrompt }],
        temperature: 0.3,
        jsonMode: true,
        timeout: 18000
      });

      const parsedSyn = synRes.parsed || safeParseJson(synRes.text);
      if (parsedSyn && parsedSyn.reply) {
        replyText = parsedSyn.reply;
        updatedSummary = parsedSyn.compactSummary || "";
        suggestedActions = parsedSyn.suggestedActions || [];
      }
    } catch (synErr) {
      console.warn("[AI_CHAT_SYNTHESIS_WARN] Synthesis LLM call failed, generating deterministic response:", synErr.message);
    }

    // Deterministic fallback if synthesis call didn't succeed
    if (!replyText) {
      if (isOutOfBudget) {
        replyText = `عذراً يا فندم، لا توجد حالياً موديلات لابتوب في المتجر بسعر أقل من ${maxPriceConstraint?.toLocaleString()} ج.م. أقل لابتوب متوفر لدينا حالياً سعره ${lowestAvailableInStore?.toLocaleString()} ج.م. يمكنك تسجيل رغبتك لنقوم بإشعارك فور توفر موديلات اقتصادية بالميزانية المطلوبة.`;
        suggestedActions = [
          `عرض أقل لابتوب متاح بسعر ${lowestAvailableInStore?.toLocaleString()} ج.م`,
          "تسجيل رغبة لابتوب اقتصادي",
          "تصفح قسم الكمبيوتر واللابتوب"
        ];
      } else if (rankedProducts.length > 0) {
        replyText = `إليك أفضل الخيارات المطابقة لطلبك في قسم ${targetCategory?.name || "المتجر"}:`;
        suggestedActions = ["قارن بين المنتجات", "المنتجات الأعلى تقييماً", "تصفح الكتالوج"];
      } else {
        replyText = "لم نجد منتجات تطابق المواصفات المطلوبة بدقة حالياً، يمكنك مراجعة أقسام المتجر أو تسجيل رغبة توفير منتج.";
      }
    }

    const finalProductsToShow = rankedProducts.slice(0, 4);

    // =========================================================================
    // AGENT STEP 5: ASYNC USER CATEGORY PROFILE ENRICHMENT
    // =========================================================================
    if (sessionId || userId) {
      const targetCatId =
        effectiveCategoryId ||
        finalProductsToShow[0]?.categoryId?._id ||
        finalProductsToShow[0]?.categoryId ||
        null;
      const targetCatName =
        targetCategory?.name ||
        finalProductsToShow[0]?.categoryId?.name ||
        "";

      let derivedPrices = [];
      if (minPriceConstraint) derivedPrices.push(minPriceConstraint);
      if (maxPriceConstraint) derivedPrices.push(maxPriceConstraint);
      if (derivedPrices.length === 0 && finalProductsToShow.length > 0) {
        derivedPrices = finalProductsToShow.map((p) => p.price).filter((p) => p > 0);
      }

      recordChatInterest(req.subdomain, {
        userId,
        sessionId,
        categoryId: targetCatId,
        categoryName: targetCatName,
        specFilters: plan.specFilters || {},
        minPrice: minPriceConstraint || (derivedPrices.length ? Math.min(...derivedPrices) : null),
        maxPrice: maxPriceConstraint || (derivedPrices.length ? Math.max(...derivedPrices) : null),
        searchKeywords: plan.searchKeywords || "",
        userMessage,
        adminData
      }).catch((enrichErr) => {
        console.warn("[AI_CHAT_PROFILE_ENRICH_WARN]", enrichErr.message);
      });
    }

    res.json({
      done: true,
      engine: "agent-rag-pipeline",
      reply: replyText,
      matchedProducts: finalProductsToShow,
      comparisonProducts: finalProductsToShow.slice(0, 2),
      comparisonIds: finalProductsToShow.slice(0, 2).map((p) => String(p._id)),
      intent: plan.intent || "search",
      suggestDesiredProduct: isOutOfBudget || finalProductsToShow.length === 0,
      appliedInstructions: appliedInstructionsMeta,
      compactContext: {
        lastCategory: effectiveCategoryId,
        activeCategory: effectiveCategoryId,
        categoryName: targetCategory?.name || "",
        lastMaxPrice: maxPriceConstraint,
        activeBudget: { min: minPriceConstraint, max: maxPriceConstraint },
        activeSpecs: plan.specFilters || {},
        activeProductPrices: finalProductsToShow.map((p) => p.price),
        summary: updatedSummary || plan.compactSummary || userMessage
      },
      suggestedActions: suggestedActions.length > 0 ? suggestedActions : [
        "قارن بين المنتجات",
        "الأكثر مشاهدة",
        "تصفح الكتالوج"
      ]
    });
  } catch (err) {
    console.error("[AI_CHAT_ERROR]", err);
    next(err);
  }
};
