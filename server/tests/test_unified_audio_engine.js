const assert = require("assert");
const audioEngine = require("../modules/audio-engine");
const productIntakeAi = require("../modules/products/productIntakeAi");
const { checkAudioAiAvailable } = require("../core/middleware/aiDispatcher");
require("dotenv").config({ path: __dirname + "/../.env" });

async function runTests() {
  console.log("=== STARTING UNIFIED AUDIO & VOICE ENGINE VERIFICATION TESTS ===\n");

  // -------------------------------------------------------------
  // Test 1: Audio Asset Loader & Buffer Normalizer
  // -------------------------------------------------------------
  console.log("Test 1: Testing audioLoader.loadAudioAsBuffer...");
  const dummyAudioBase64 = "data:audio/webm;base64,GkXfo59ChoEBQveBAULygQRC84EIQoKEd2VibUKHgQJChYECGFOAZwE=";
  const loadedAudio = await audioEngine.loadAudioAsBuffer(dummyAudioBase64);
  assert(loadedAudio !== null, "Audio Data URI should be parsed successfully");
  assert.strictEqual(loadedAudio.mimeType, "audio/webm");
  assert(Buffer.isBuffer(loadedAudio.buffer), "Loaded audio asset must contain a Buffer");
  assert(loadedAudio.size > 0, "Loaded audio buffer size must be > 0");

  const rawBuffer = Buffer.from("RIFFtestWAVEfmt ");
  const loadedRaw = await audioEngine.loadAudioAsBuffer(rawBuffer, { mimeType: "audio/wav" });
  assert.strictEqual(loadedRaw.mimeType, "audio/wav");
  assert(Buffer.isBuffer(loadedRaw.buffer));

  const nullAudio = await audioEngine.loadAudioAsBuffer("/non-existent/fake-audio.mp3");
  assert.strictEqual(nullAudio, null, "Non-existent path should return null gracefully");
  console.log("  [PASS] Audio loader successfully parsed data URIs, raw buffers, and handled missing paths.\n");

  // -------------------------------------------------------------
  // Test 2: Audio Credentials & Provider Discovery
  // -------------------------------------------------------------
  console.log("Test 2: Testing voiceProvider.getAudioCredentials...");
  const creds = audioEngine.getAudioCredentials();
  assert(creds.hasGemini === true, "GEMINI_API_KEY from .env should be discovered");
  assert(creds.geminiKey.length > 5, "Discovered Gemini Key should be valid length");
  assert(creds.isAudioReady === true, "Audio engine should be ready when Gemini key is present");
  console.log(`  [PASS] Audio credentials detected. Gemini Available: ${creds.hasGemini}, Audio Ready: ${creds.isAudioReady}\n`);

  // -------------------------------------------------------------
  // Test 3: Audio Engine Exports Verification
  // -------------------------------------------------------------
  console.log("Test 3: Verifying all unified functions exported on index.js...");
  const requiredFunctions = [
    "loadAudioAsBuffer",
    "getAudioCredentials",
    "transcribeAudio",
    "transcribeVoiceIntake",
    "transcribeVoiceSearch",
    "searchCatalogByVoice"
  ];

  for (const fn of requiredFunctions) {
    assert(typeof audioEngine[fn] === "function", `audioEngine.${fn} must be a function`);
  }
  console.log(`  [PASS] All ${requiredFunctions.length} unified audio functions are cleanly exported and accessible.\n`);

  // -------------------------------------------------------------
  // Test 4: Product Intake Audio Delegation
  // -------------------------------------------------------------
  console.log("Test 4: Verifying product intake delegation...");
  assert(typeof productIntakeAi.transcribeAudio === "function", "productIntakeAi.transcribeAudio should exist");
  assert(typeof productIntakeAi.handleVoiceProductIntake === "function", "productIntakeAi.handleVoiceProductIntake should exist");
  console.log("  [PASS] Product intake voice handlers are cleanly bound to unified audio engine.\n");

  // -------------------------------------------------------------
  // Test 5: Dispatcher Audio AI Availability
  // -------------------------------------------------------------
  console.log("Test 5: Verifying aiDispatcher.checkAudioAiAvailable...");
  const isAudioAvailable = checkAudioAiAvailable({ adminData: {} });
  assert.strictEqual(isAudioAvailable, true, "checkAudioAiAvailable should return true with active credentials");
  console.log("  [PASS] AI dispatcher correctly recognizes audio engine readiness.\n");

  console.log("=== ALL UNIFIED AUDIO & VOICE ENGINE TESTS PASSED SUCCESSFULLY! 🎙️ ===");
}

runTests().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
