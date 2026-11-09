/**
 * Unified Audio & Voice Engine
 * Centralized Speech-to-Text transcription, voice product intake, and storefront voice search.
 */

const audioLoader = require("./audioLoader");
const voiceProvider = require("./voiceProvider");
const voiceProductIntake = require("./voiceProductIntake");
const voiceSearchEngine = require("./voiceSearchEngine");

module.exports = {
  // Asset Loading
  loadAudioAsBuffer: audioLoader.loadAudioAsBuffer,

  // Voice Provider & Credentials
  getAudioCredentials: voiceProvider.getAudioCredentials,
  transcribeAudio: voiceProvider.transcribeAudio,

  // Voice Product Intake
  transcribeVoiceIntake: voiceProductIntake.transcribeVoiceIntake,

  // Voice Storefront Search
  transcribeVoiceSearch: voiceSearchEngine.transcribeVoiceSearch,
  searchCatalogByVoice: voiceSearchEngine.searchCatalogByVoice
};
