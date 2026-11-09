const { transcribeAudio } = require("./voiceProvider");
const { loadAudioAsBuffer } = require("./audioLoader");

/**
 * Transcribes audio specifically for product intake / inventory registration
 */
async function transcribeVoiceIntake(audioSource, mimeType = "audio/webm", adminData = {}) {
  const loaded = await loadAudioAsBuffer(audioSource, { mimeType });
  if (!loaded?.buffer) {
    throw new Error("Invalid or unreadable audio source for voice product intake");
  }

  const inventoryPrompt =
    "أنت نظام ذكي لتسجيل جرد وإدخال بضائع لمتجر إلكتروني. " +
    "استمع للتسجيل الصوتي بدقة واستخرج كافة أسماء المنتجات وموديلاتها ومواصفاتها الفنية (الرام، التخزين، المقاس، اللون، إلخ) وأسعارها بالعملة المحلية " +
    "بدقة متناهية وبالألفاظ المنطوقة تماماً دون أي حشو أو تعليقات.";

  return await transcribeAudio(loaded.buffer, loaded.mimeType, {
    prompt: inventoryPrompt,
    adminData
  });
}

module.exports = {
  transcribeVoiceIntake
};
