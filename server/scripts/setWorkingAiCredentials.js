require("dotenv").config();
const mongoose = require("mongoose");
const env = require("../env.json");

async function run() {
  const dbUri = process.env.MONGO_URL || env.localhost.database;
  await mongoose.connect(dbUri);
  const AdminData = mongoose.model("admindatas", new mongoose.Schema({}, { strict: false }), "admindatas");

  const updateRes = await AdminData.updateMany(
    {},
    {
      $set: {
        aiEnabled: true,
        AI_API_KEY: process.env.AI_API_KEY || "",
        AI_BASE_URL: process.env.AI_BASE_URL || "https://api.deepseek.com",
        AI_MODEL: process.env.AI_MODEL || "deepseek-chat",
        GEMINI_API_KEY: process.env.GEMINI_API_KEY || ""
      }
    }
  );

  console.log("Updated admindatas result:", updateRes);
  const doc = await AdminData.findOne();
  console.log("Current credentials in DB:", {
    aiEnabled: doc?.aiEnabled,
    AI_BASE_URL: doc?.AI_BASE_URL,
    AI_MODEL: doc?.AI_MODEL,
    hasKey: Boolean(doc?.AI_API_KEY),
    hasGeminiKey: Boolean(doc?.GEMINI_API_KEY)
  });

  await mongoose.disconnect();
}

run().catch(console.error);

