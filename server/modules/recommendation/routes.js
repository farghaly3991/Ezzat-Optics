/**
 * Recommendation module routes (public): client profile enrichment + personalised recommendations
 * (twin-engine AI / standard).
 */

const express = require("express");
const router = express.Router();

const { aiDispatcher } = require("../../core/middleware/aiDispatcher");
const { optionalAuth } = require("../auth/authMiddleware");
const aiRecommendation = require("./aiRecommendation");
const standardRecommendation = require("./standardRecommendation");

router.post(
  "/store-public/client-profile/enrich",
  optionalAuth,
  aiDispatcher(aiRecommendation.enrichProfile, standardRecommendation.enrichProfile)
);
router.post(
  "/store-public/client-profile/filter",
  optionalAuth,
  aiDispatcher(aiRecommendation.recordFilter, standardRecommendation.recordFilter)
);
router.get(
  "/store-public/recommendations",
  optionalAuth,
  aiDispatcher(aiRecommendation.getRecommendations, standardRecommendation.getRecommendations)
);

module.exports = router;
