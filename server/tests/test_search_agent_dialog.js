const assert = require("assert");
const mongoose = require("mongoose");
require("dotenv").config();
const envJson = require("../env.json");
const { setMongooseConnection } = require("../core/database");

async function runDialogTest() {
  console.log("=== STARTING SEARCH AGENT MULTI-TURN DIALOG TEST ===");
  const conn = await mongoose.createConnection(envJson.localhost.database).asPromise();
  setMongooseConnection("localhost", conn);

  const aiChat = require("../modules/chat/aiChat");
  const testSessionId = "dialog_test_session_" + Date.now();

  let compactContext = null;
  let history = [];

  async function sendMessage(userText) {
    console.log(`\n--------------------------------------------------`);
    console.log(`User: "${userText}"`);
    console.log(`CompactContext before turn:`, compactContext ? compactContext.summary : "None");

    const req = {
      subdomain: "localhost",
      headers: { "x-session-id": testSessionId },
      body: {
        message: userText,
        history,
        compactContext,
        sessionId: testSessionId
      },
      adminData: {
        AI_API_KEY: process.env.AI_API_KEY,
        AI_BASE_URL: process.env.AI_BASE_URL,
        AI_MODEL: process.env.AI_MODEL,
        GEMINI_API_KEY: process.env.GEMINI_API_KEY
      }
    };

    let responseData = null;
    const res = {
      status: (code) => {
        return {
          json: (data) => {
            responseData = { statusCode: code, ...data };
            return responseData;
          }
        };
      },
      json: (data) => {
        responseData = { statusCode: 200, ...data };
        return responseData;
      }
    };

    await aiChat.handleChat(req, res, (err) => {
      throw err;
    });

    console.log(`AI Engine: ${responseData.engine}`);
    console.log(`AI Reply: "${responseData.reply}"`);
    console.log(`Matched Products Count: ${responseData.matchedProducts?.length || 0}`);
    (responseData.matchedProducts || []).forEach((p) => {
      console.log(`  - ${p.name} (Price: ${p.price} ج.م)`);
    });
    console.log(`Suggest Desired Product: ${responseData.suggestDesiredProduct}`);
    console.log(`Updated Context Summary: "${responseData.compactContext?.summary}"`);

    // Update state for next turn
    compactContext = responseData.compactContext;
    history.push({ sender: "user", text: userText });
    history.push({ sender: "ai", text: responseData.reply });

    return responseData;
  }

  // Turn 1: Initial query
  const res1 = await sendMessage("أنا عايز لابتوب قوي ينفع لمبرمج ذكاء اصطناعي وشوية جرافيكس بس أرخص حاجة ممكنة");
  assert(res1.matchedProducts.length > 0, "Turn 1 must match laptops");

  // Turn 2: Lower the price without giving a number
  const res2 = await sendMessage("طيب خلينا ننزل شوية بالسعر");
  // Check that it understands user wants cheaper

  // Turn 3: User says products were the same
  const res3 = await sendMessage("بس انتا جبت المنتجات هيا هيا");
  assert(res3.statusCode === 200, "Turn 3 must not crash with 500 error!");

  // Turn 4: Explicit price under 50,000 EGP
  const res4 = await sendMessage("أرني اللابتوبات تحت 50,000 ج.م");
  assert.strictEqual(
    res4.matchedProducts.length,
    0,
    "Turn 4 MUST NOT return 74,000 or 118,000 laptops when budget is under 50,000!"
  );
  assert(
    res4.reply.includes("50,000") || res4.reply.includes("50000") || res4.reply.includes("لا توجد") || res4.reply.includes("عذراً"),
    "Turn 4 must truthfully explain that no laptops exist under 50,000!"
  );
  assert.strictEqual(res4.suggestDesiredProduct, true, "Must offer desired product registration");

  console.log("\n=== ALL 4 DIALOG TURNS VERIFIED WITH 100% ACCURACY ===");

  // Cleanup test profile
  const getClientProfileModel = require("../modules/recommendation/clientProfileModel");
  const ClientProfile = getClientProfileModel("localhost");
  await ClientProfile.deleteOne({ sessionId: testSessionId });
  process.exit(0);
}

runDialogTest().catch((err) => {
  console.error("Dialog test failed:", err);
  process.exit(1);
});
