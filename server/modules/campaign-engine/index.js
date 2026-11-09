/**
 * Unified Marketing & Campaign Engine
 * Centralized generation of commercial social ad copy, signal-driven dynamic campaigns, and visual marketing assets.
 */

const { AD_PRESETS, getPresetById } = require("./adPresets");
const { buildSignalCampaignFallback } = require("./signalCampaignBuilder");
const { generateAdPostCopy } = require("./copywritingProvider");
const {
  generateSmartCampaign,
  generateAdPosterImage
} = require("./campaignOrchestrator");

module.exports = {
  // Presets & Configurations
  AD_PRESETS,
  getPresetById,

  // Copywriting & Signal Builders
  generateAdPostCopy,
  buildSignalCampaignFallback,

  // Smart Analytics Campaign Orchestrator
  generateSmartCampaign,

  // Visual Poster Generation
  generateAdPosterImage
};
