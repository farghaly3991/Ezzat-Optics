const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });

const { ensureTenantConnection } = require("../core/database");
const { syncAllProductEmbeddings, searchProducts, isGeminiEmbeddingVector } = require("../modules/semantic-engine");
const getProductsModel = require("../modules/products/productModel");
const getAdminDataModel = require("../modules/settings/adminDataModel");

let envJsonData = {};
try {
  envJsonData = require("../env.json");
} catch {}

async function main() {
  const subdomain = process.argv[2] || "localhost";
  const tenantEnv = envJsonData[subdomain] || envJsonData.localhost || {};
  if (tenantEnv.GEMINI_API_KEY && !process.env.GEMINI_API_KEY) {
    process.env.GEMINI_API_KEY = tenantEnv.GEMINI_API_KEY;
  }
  const dbUrl = tenantEnv.database || process.env.DEFAULT_DB || "mongodb://127.0.0.1:27017/multu_tenant_store";
  await ensureTenantConnection(subdomain, dbUrl);

  console.log(`[1/4] Syncing all product embeddings for tenant "${subdomain}" using Gemini 768-d (gemini-embedding-001)...`);

  // Ensure aiInstructions & desiredProducts are enabled in tenant AdminData
  const AdminData = getAdminDataModel(subdomain);
  const adminDoc = await AdminData.findOne();
  if (adminDoc) {
    adminDoc.enabledModules = {
      ...(adminDoc.enabledModules || {}),
      aiInstructions: true,
      desiredProducts: true
    };
    adminDoc.navigationLabels = {
      ...(adminDoc.navigationLabels || {}),
      aiInstructions: adminDoc.navigationLabels?.aiInstructions || "تعليمات المساعد الذكي (AI)",
      desiredProducts: adminDoc.navigationLabels?.desiredProducts || "قوائم الانتظار ونواقص الطلب"
    };
    adminDoc.markModified("enabledModules");
    adminDoc.markModified("navigationLabels");
    await adminDoc.save();
    console.log(`[AdminData] Enabled aiInstructions & desiredProducts tabs for "${subdomain}".`);
  }

  const forceSync = process.argv.includes("--force");
  const syncStats = await syncAllProductEmbeddings(subdomain, { force: forceSync });
  console.log("[2/4] Batch Sync Stats:", syncStats);

  // Verify stored product embeddings in MongoDB
  const Products = getProductsModel(subdomain);
  const allProducts = await Products.find({}).select("name productType embedding embeddingModel embeddingTextHash").lean();

  console.log("\n[3/4] Verifying Stored Product Vectors in MongoDB:");
  for (const p of allProducts) {
    const vec = p.embedding || [];
    const nonZero = vec.filter((v) => Math.abs(v) > 1e-7).length;
    const density = vec.length > 0 ? (nonZero / vec.length).toFixed(3) : "0.000";
    const validGemini = isGeminiEmbeddingVector(vec, p.embeddingModel);
    console.log(
      ` - [${p.productType}] ${p.name} | dim=${vec.length} | model=${p.embeddingModel} | density=${density} | validGemini=${validGemini}`
    );
  }

  console.log("\n[4/4] Testing Search Pipeline (Lexical + Gemini 768-d Semantic + Fallback):");
  const testQueries = [
    "تشمبر",
    "إطار نظارة",
    "فريم",
    "حاجة تحمي عيني من شاشة اللابتوب والكمبيوتر",
    "نظارة مرنة للأطفال ما بتتكسرش",
    "عدسات بتغمق في الشمس لوحدها"
  ];

  for (const q of testQueries) {
    const res = await searchProducts(subdomain, { query: q, limit: 3 });
    console.log(`\nQuery: "${q}" | Strategy: ${res.searchStrategy} | Total: ${res.total}`);
    for (const hit of res.products) {
      console.log(
        `   -> ${hit.name} (${hit.productType}) | combined=${hit.similarityScore} | lex=${hit.lexicalScore} | geminiVecSim=${hit.vectorSimilarity} | src=${hit.matchSource}`
      );
    }
  }

  process.exit(0);
}

main().catch((err) => {
  console.error("Sync error:", err);
  process.exit(1);
});
