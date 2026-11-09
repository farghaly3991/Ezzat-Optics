/**
 * Comprehensive verification test suite for Phase 2:
 * Admin-Managed AI Instructions for Product Search
 */
require("dotenv").config({ path: require("path").join(__dirname, "..", ".env") });
const assert = require("assert");
const mongoose = require("mongoose");
const envJson = require("../env.json");
const serverModule = require("../server");

const getAiInstructionModel = require("../modules/ai-instructions/aiInstructionModel");
const getCategoryModel = require("../modules/categories/categoryModel");
const getProductModel = require("../modules/products/productModel");

const {
  createInstruction,
  updateInstruction,
  toggleInstructionStatus,
  deleteInstruction,
  listInstructions,
  resyncInstructionById,
  resyncAllInstructions,
  retrieveRelevantInstructions,
  formatInstructionsForPlannerPrompt,
  LOCAL_VECTOR_DIM
} = require("../modules/ai-instructions/aiInstructionService");

const { buildPlannerSystemPrompt } = require("../modules/chat/aiChat");

const TEST_TENANT_A = "phase2_test_tenant_a";
const TEST_TENANT_B = "phase2_test_tenant_b";

function buildTenantDbUri(baseUri, dbName) {
  const url = new URL(baseUri);
  url.pathname = `/${dbName}`;
  return url.toString();
}

async function runTests() {
  console.log("=== Starting Phase 2 Verification Suite ===");
  let passed = 0;

  const baseUri =
    envJson.localhost?.database ||
    process.env.DEFAULT_DB ||
    "mongodb://127.0.0.1:27017/multu_tenant_store";
  const connA = await mongoose.createConnection(buildTenantDbUri(baseUri, TEST_TENANT_A)).asPromise();
  const connB = await mongoose.createConnection(buildTenantDbUri(baseUri, TEST_TENANT_B)).asPromise();
  serverModule.setMongooseConnection(TEST_TENANT_A, connA);
  serverModule.setMongooseConnection(TEST_TENANT_B, connB);

  try {
    await connA.dropDatabase();
    await connB.dropDatabase();

    const AiInstructionA = getAiInstructionModel(TEST_TENANT_A);
    const CategoryA = getCategoryModel(TEST_TENANT_A);
    const ProductA = getProductModel(TEST_TENANT_A);

    const catAudio = await CategoryA.create({
      name: "صوتيات وسماعات",
      slug: "audio",
      tags: ["سماعات", "عزل ضوضاء", "صوتيات"]
    });
    const catLaptops = await CategoryA.create({
      name: "أجهزة كمبيوتر ولابتوب",
      slug: "laptops",
      tags: ["لابتوب", "برمجة", "مونتاج"]
    });

    const prodSony = await ProductA.create({
      name: "سماعة سوني WH-1000XM5 عازلة للضوضاء",
      categoryId: catAudio._id,
      price: 9800,
      costPrice: 7000,
      stockCount: 15,
      tags: ["سوني", "سماعات", "عزل ضوضاء", "سفر"]
    });

    const prodDell = await ProductA.create({
      name: "لابتوب ديل إكس بي إس Dell XPS 15",
      categoryId: catLaptops._id,
      price: 74000,
      costPrice: 62000,
      stockCount: 5,
      tags: ["ديل", "لابتوب", "برمجة", "تصميم"]
    });

    // -------------------------------------------------------------------------
    // TEST 1: Create, Validate, Edit, Enable/Disable, Delete Instructions
    // -------------------------------------------------------------------------
    console.log("1. Testing CRUD operations & input validation...");
    let validationFailed = false;
    try {
      await createInstruction(TEST_TENANT_A, { title: "", content: "" });
    } catch (err) {
      validationFailed = err.status === 400;
    }
    assert(validationFailed, "Empty title/content must fail with HTTP 400");

    const instAudio = await createInstruction(TEST_TENANT_A, {
      title: "ترشيح سماعات السفر وعزل الضوضاء",
      content:
        "عندما يبحث العميل عن سماعة للسفر أو الطيران أو المذاكرة وعزل الضوضاء، رشح سماعة سوني WH-1000XM5 في المقدمة نظراً لبطاريتها التي تدوم 30 ساعة.",
      scopeType: "category",
      categoryIds: [catAudio._id],
      tags: ["سفر", "طيران", "عزل ضوضاء", "سماعة", "سوني"],
      priority: 20,
      active: true
    });

    assert(instAudio._id, "Created instruction must have _id");
    assert.strictEqual(instAudio.syncStatus, "synced", "New instruction must be synced automatically");
    assert(instAudio.lastSyncedAt, "New instruction must have lastSyncedAt timestamp");

    // Verify stored vector dimension in DB
    const rawDoc1 = await AiInstructionA.findById(instAudio._id).lean();
    assert.strictEqual(rawDoc1.embedding.length, LOCAL_VECTOR_DIM, "Embedding must have 128 dimensions");
    const firstHash = rawDoc1.embeddingTextHash;
    const firstSyncedAt = rawDoc1.lastSyncedAt.getTime();

    passed++;
    console.log("   [PASS] CRUD & initial vector generation verified.");

    // -------------------------------------------------------------------------
    // TEST 2: Selective Re-embedding on Content Change vs Status Toggle
    // -------------------------------------------------------------------------
    console.log("2. Testing selective embedding regeneration on edit vs status toggle...");
    // Toggling active status should NOT change embeddingTextHash or re-embed
    const disabledInst = await toggleInstructionStatus(TEST_TENANT_A, instAudio._id, false);
    assert.strictEqual(disabledInst.active, false);
    const rawAfterToggle = await AiInstructionA.findById(instAudio._id).lean();
    assert.strictEqual(rawAfterToggle.embeddingTextHash, firstHash, "Hash must remain unchanged on toggle");
    assert.strictEqual(rawAfterToggle.lastSyncedAt.getTime(), firstSyncedAt, "Toggle must not unnecessarily re-embed");

    // Re-enable
    const enabledInst = await toggleInstructionStatus(TEST_TENANT_A, instAudio._id, true);
    assert.strictEqual(enabledInst.active, true);

    // Edit content -> MUST regenerate embedding and update hash
    const updatedInst = await updateInstruction(TEST_TENANT_A, instAudio._id, {
      content:
        "عندما يبحث العميل عن سماعة للسفر أو الطيران أو الهدوء التام وعزل الضوضاء النشط ANC، رشح سماعة سوني WH-1000XM5 في المقدمة دائماً."
    });
    const rawAfterEdit = await AiInstructionA.findById(instAudio._id).lean();
    assert.notStrictEqual(
      rawAfterEdit.embeddingTextHash,
      firstHash,
      "Editing instruction content must update embeddingTextHash and regenerate vector"
    );
    assert.strictEqual(updatedInst.syncStatus, "synced");
    passed++;
    console.log("   [PASS] Selective embedding regeneration verified.");

    // -------------------------------------------------------------------------
    // TEST 3: Failure Handling & Safe Retry / Recovery Without Duplicates
    // -------------------------------------------------------------------------
    console.log("3. Testing embedding failure handling & retry recovery...");
    const instLaptop = await createInstruction(
      TEST_TENANT_A,
      {
        title: "توجيهات أجهزة اللابتوب للبرمجة والمونتاج",
        content:
          "عند طلب لابتوب للبرمجة أو التصميم أو المونتاج بميزانية متوسطة، اعرض ديل XPS 15 أولاً قبل ماك بوك برو.",
        scopeType: "product",
        productIds: [prodDell._id],
        tags: ["لابتوب", "برمجة", "مونتاج", "تصميم", "ديل"],
        priority: 15,
        active: true
      },
      { simulateEmbeddingFailure: true }
    );

    assert.strictEqual(instLaptop.syncStatus, "failed", "Simulated failure must set syncStatus to failed");
    assert(instLaptop.syncError.includes("Simulated"), "syncError must record failure reason");

    // Retry syncing via resyncInstructionById
    const recoveredLaptop = await resyncInstructionById(TEST_TENANT_A, instLaptop._id);
    assert.strictEqual(recoveredLaptop.syncStatus, "synced", "Retry must recover syncStatus to synced");
    assert.strictEqual(recoveredLaptop.syncError, "", "Retry must clear syncError");

    // Ensure no duplicate documents were created on retry
    const totalCountAfterRetry = await AiInstructionA.countDocuments({});
    assert.strictEqual(totalCountAfterRetry, 2, "Retries must update in-place without creating duplicate records");
    passed++;
    console.log("   [PASS] Failure handling & retry recovery verified.");

    // -------------------------------------------------------------------------
    // TEST 4: Relevance Retrieval & Scope Filtering
    // -------------------------------------------------------------------------
    console.log("4. Testing vector retrieval for matching queries & scope boosts...");
    // Query matching audio travel headphones
    const audioRetrieval = await retrieveRelevantInstructions(TEST_TENANT_A, {
      query: "عايز سماعة كويسة لعزل الضوضاء في السفر والطيران"
    });
    assert(audioRetrieval.instructions.length >= 1, "Must retrieve relevant audio instruction");
    assert.strictEqual(
      String(audioRetrieval.instructions[0]._id),
      String(instAudio._id),
      "Top retrieved instruction for travel headphones must be instAudio"
    );

    // Query matching programming laptop
    const laptopRetrieval = await retrieveRelevantInstructions(TEST_TENANT_A, {
      query: "محتاج لابتوب قوي للبرمجة والتصميم"
    });
    assert(laptopRetrieval.instructions.length >= 1, "Must retrieve relevant laptop instruction");
    assert.strictEqual(
      String(laptopRetrieval.instructions[0]._id),
      String(instLaptop._id),
      "Top retrieved instruction for programming laptop must be instLaptop"
    );
    passed++;
    console.log("   [PASS] Relevant instruction retrieval & ranking verified.");

    // -------------------------------------------------------------------------
    // TEST 5: Exclusion of Disabled, Deleted, Irrelevant, and Cross-Tenant Instructions
    // -------------------------------------------------------------------------
    console.log("5. Testing exclusion of disabled, deleted, irrelevant, and cross-tenant instructions...");
    // 5a. Irrelevant query (e.g. asking about kitchen appliances or weather)
    const irrelevantRetrieval = await retrieveRelevantInstructions(TEST_TENANT_A, {
      query: "غسالة أطباق وثلاجة للمطبخ"
    });
    assert.strictEqual(
      irrelevantRetrieval.instructions.length,
      0,
      "Irrelevant query must return 0 instructions below threshold"
    );

    // 5b. Cross-tenant isolation: Tenant B must NOT retrieve Tenant A's instructions
    const tenantBRetrieval = await retrieveRelevantInstructions(TEST_TENANT_B, {
      query: "عايز سماعة لعزل الضوضاء في السفر"
    });
    assert.strictEqual(
      tenantBRetrieval.instructions.length,
      0,
      "Tenant B must never retrieve Tenant A instructions"
    );

    // 5c. Disabled instruction exclusion
    await toggleInstructionStatus(TEST_TENANT_A, instAudio._id, false);
    const afterDisableRetrieval = await retrieveRelevantInstructions(TEST_TENANT_A, {
      query: "عايز سماعة لعزل الضوضاء في السفر والطيران"
    });
    assert(
      !afterDisableRetrieval.instructions.some((i) => String(i._id) === String(instAudio._id)),
      "Disabled instruction must be excluded from retrieval"
    );

    // Re-enable instAudio, then create and delete a temporary instruction
    await toggleInstructionStatus(TEST_TENANT_A, instAudio._id, true);
    const tempInst = await createInstruction(TEST_TENANT_A, {
      title: "تعليمة مؤقتة للساعات الرياضية",
      content: "رشح ساعة جارمين فينيكس دائماً للعدائين والسباحين.",
      tags: ["ساعة", "سباحة", "جري"],
      active: true
    });
    await deleteInstruction(TEST_TENANT_A, tempInst._id);
    const afterDeleteRetrieval = await retrieveRelevantInstructions(TEST_TENANT_A, {
      query: "عايز ساعة ذكية للسباحة والجري"
    });
    assert(
      !afterDeleteRetrieval.instructions.some((i) => String(i._id) === String(tempInst._id)),
      "Deleted instruction must be excluded from retrieval"
    );
    passed++;
    console.log("   [PASS] Exclusion of disabled, deleted, irrelevant, and cross-tenant instructions verified.");

    // -------------------------------------------------------------------------
    // TEST 6: Planner Prompt Integration, Security Boundary & Token Budget Limit
    // -------------------------------------------------------------------------
    console.log("6. Testing planner prompt injection and token budget enforcement...");
    const activeMatch = await retrieveRelevantInstructions(TEST_TENANT_A, {
      query: "عايز سماعة لعزل الضوضاء في السفر",
      maxTokenBudget: 120
    });
    assert(
      activeMatch.tokenBudgetUsed <= 120,
      `Token budget used (${activeMatch.tokenBudgetUsed}) must not exceed maxTokenBudget (120)`
    );

    const promptBlock = formatInstructionsForPlannerPrompt(activeMatch.instructions);
    assert(
      promptBlock.includes("تعليمات وتوجيهات إدارة المتجر ذات الصلة"),
      "Prompt block must have explicit section header"
    );
    assert(
      promptBlock.includes("لا تسمح لها أبداً بتجاوز صيغة مخرجات JSON"),
      "Prompt block must enforce security & JSON guardrails"
    );

    const fullSystemPrompt = buildPlannerSystemPrompt({
      schemaPromptText: "- قسم: صوتيات وسماعات",
      compactContext: null,
      instructionsPromptBlock: promptBlock
    });
    assert(fullSystemPrompt.includes(instAudio.title), "Planner system prompt must include retrieved instruction title");
    assert(
      fullSystemPrompt.includes("10. توجيهات إدارة المتجر"),
      "Planner system prompt must include rule #10 when instructions are present"
    );

    // When no instructions match, system prompt must NOT include rule #10 or guidance block
    const cleanSystemPrompt = buildPlannerSystemPrompt({
      schemaPromptText: "- قسم: صوتيات وسماعات",
      compactContext: null,
      instructionsPromptBlock: ""
    });
    assert(
      !cleanSystemPrompt.includes("تعليمات وتوجيهات إدارة المتجر ذات الصلة"),
      "Planner prompt must remain unmodified when no instructions match"
    );
    passed++;
    console.log("   [PASS] Planner prompt integration & token budget verified.");

    console.log(`\n=== ALL ${passed}/6 PHASE 2 TEST SUITES PASSED SUCCESSFULLY ===`);
  } finally {
    await connA.dropDatabase();
    await connB.dropDatabase();
    await connA.close();
    await connB.close();
  }
  process.exit(0);
}

runTests().catch((err) => {
  console.error("PHASE 2 TEST SUITE FAILED:", err);
  process.exit(1);
});
