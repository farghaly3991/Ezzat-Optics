const mongoose = require("mongoose");
require("dotenv").config();
const envJson = require("../env.json");

const getProductsModel = require("../modules/products/productModel");
const getCategoriesModel = require("../modules/categories/categoryModel");
const getClientProfileModel = require("../modules/recommendation/clientProfileModel");
const { buildProductEmbeddingText } = require("../modules/semantic-engine/productRepresentation");
const { generateEmbedding, cosineSimilarity } = require("../modules/semantic-engine/embeddingProvider");

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function run() {
  const dbUri = envJson.localhost?.database || process.env.DEFAULT_DB;
  console.log("=== STARTING UNIFIED SEMANTIC ENGINE MIGRATION ===");
  console.log("Connecting to Database:", dbUri ? "URI found" : "None");

  const conn = await mongoose.createConnection(dbUri).asPromise();
  const { setMongooseConnection } = require("../core/database");
  setMongooseConnection("localhost", conn);

  const Products = getProductsModel("localhost");
  const Categories = getCategoriesModel("localhost");
  const ClientProfile = getClientProfileModel("localhost");

  // 1. Fetch categories
  const categories = await Categories.find({}).select("_id name").lean();
  const catMap = {};
  categories.forEach((c) => {
    catMap[String(c._id)] = c.name;
  });
  console.log(`Loaded ${categories.length} categories.`);

  // 2. Fetch products lean
  const products = await Products.find({ active: true })
    .select("_id name description categoryId specs tags price")
    .lean();
  console.log(`Found ${products.length} active products to embed with 768-d Gemini vectors.`);

  const BATCH_SIZE = 8;
  let syncedCount = 0;

  for (let i = 0; i < products.length; i += BATCH_SIZE) {
    const chunk = products.slice(i, i + BATCH_SIZE);
    console.log(`Processing batch [${i + 1} to ${Math.min(i + BATCH_SIZE, products.length)}] of ${products.length}...`);

    await Promise.all(
      chunk.map(async (prod) => {
        try {
          const catName = catMap[String(prod.categoryId)] || "";
          const text = buildProductEmbeddingText(prod, catName);
          const vec = await generateEmbedding(text, {
            extraTags: prod.tags || [],
            adminData: { GEMINI_API_KEY: process.env.GEMINI_API_KEY }
          });

          if (Array.isArray(vec) && vec.length === 768) {
            await Products.updateOne({ _id: prod._id }, { $set: { embedding: vec } });
            syncedCount += 1;
          }
        } catch (err) {
          console.warn(`Error on prod ${prod._id} (${prod.name}):`, err.message);
        }
      })
    );

    // Rate-limit safety margin between concurrent chunks
    await sleep(250);
  }

  console.log(`\nSuccessfully embedded ${syncedCount}/${products.length} products with 768-d Gemini vectors!`);

  // 3. Verification test
  if (products.length >= 2) {
    const p1 = await Products.findById(products[0]._id).lean();
    const p2 = await Products.findById(products[1]._id).lean();
    if (p1.embedding?.length === 768 && p2.embedding?.length === 768) {
      const sim = cosineSimilarity(p1.embedding, p2.embedding);
      console.log(`\nVerification Test:`);
      console.log(`- Product 1: "${p1.name}" (Cat: ${catMap[String(p1.categoryId)] || "عام"})`);
      console.log(`- Product 2: "${p2.name}" (Cat: ${catMap[String(p2.categoryId)] || "عام"})`);
      console.log(`- Semantic Cosine Similarity: ${(sim * 100).toFixed(1)}%`);
    }
  }

  // 4. Reset & Clean Client Profiles
  console.log("\nAuditing client profiles...");
  const resetRes = await ClientProfile.updateMany(
    {},
    {
      $set: {
        categoryProfiles: [],
        browsedProductIds: [],
        browsedHistory: [],
        searchQueries: [],
        enrichmentCount: 0
      }
    }
  );
  console.log(`Reset ${resetRes.modifiedCount} client profiles for fresh Category-Specific EMA accumulation.`);

  console.log("\n=== MIGRATION COMPLETED SUCCESSFULLY ===");
  process.exit(0);
}

run().catch((err) => {
  console.error("Migration fatal error:", err);
  process.exit(1);
});
