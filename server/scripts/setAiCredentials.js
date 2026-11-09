const mongoose = require("mongoose");
const env = require("../env.json");

async function run() {
  const uri = env.localhost.database;
  console.log("Connecting to MongoDB:", uri);
  await mongoose.connect(uri);

  const adminDataSchema = new mongoose.Schema({}, { strict: false });
  const AdminData = mongoose.model("admindatas", adminDataSchema, "admindatas");

  const doc = await AdminData.findOne();
  console.log("Current adminData id:", doc?._id);

  const res = await AdminData.updateMany(
    {},
    {
      $set: {
        aiEnabled: true,
        AI_API_KEY: "sk-d70b641bac8e47a89ec5b7313cbc275d",
        aiApiKey: "sk-d70b641bac8e47a89ec5b7313cbc275d",
        AI_BASE_URL: "https://api.deepseek.com",
        AI_MODEL: "deepseek-chat"
      }
    },
    { upsert: true }
  );

  console.log("Updated admindatas:", res);
  
  const updatedDoc = await AdminData.findOne();
  console.log("Verified admindatas:", {
    aiEnabled: updatedDoc.aiEnabled,
    AI_API_KEY: updatedDoc.AI_API_KEY ? "EXISTS" : "MISSING",
    aiApiKey: updatedDoc.aiApiKey ? "EXISTS" : "MISSING",
    AI_BASE_URL: updatedDoc.AI_BASE_URL,
    AI_MODEL: updatedDoc.AI_MODEL
  });

  await mongoose.disconnect();
}

run().catch(console.error);
