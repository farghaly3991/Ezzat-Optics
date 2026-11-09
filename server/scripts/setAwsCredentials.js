const mongoose = require("mongoose");
const env = require("../env.json");

async function run() {
  await mongoose.connect(env.localhost.database);
  const AdminData = mongoose.model("admindatas", new mongoose.Schema({}, { strict: false }), "admindatas");
  
  const updateRes = await AdminData.updateMany(
    {},
    {
      $set: {
        AWS_API_KEY_ID: "DO8014X99GCXKUDU8MU8",
        AWS_API_KEY_SECRET: "y1UvMVEb0yV8m4ejNaxmJRhTZ9itcdO9+clRewoG5bM"
      }
    }
  );

  console.log("Updated admindatas AWS credentials:", updateRes);
  const doc = await AdminData.findOne();
  console.log("Verified AWS credentials in DB:", {
    AWS_API_KEY_ID: doc.AWS_API_KEY_ID,
    AWS_API_KEY_SECRET: doc.AWS_API_KEY_SECRET ? "EXISTS" : "MISSING"
  });

  await mongoose.disconnect();
}

run().catch(console.error);
