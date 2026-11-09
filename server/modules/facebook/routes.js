/**
 * Facebook module routes (admin & public webhook):
 * - AI copy/image generation, connection check, post CRUD + publish + schedule (Meta Graph)
 * - Social Commerce: AI Inbox, Comments/Messenger analysis, Smart Grounded Replies, Customer History, Analytics & Webhook
 */

const express = require("express");
const router = express.Router();

const facebookPostAi = require("./facebookPostAi");
const facebookPostsController = require("./facebookPostsController");
const facebookSocialController = require("./facebookSocialController");

// --- Public Meta Webhook (for automated real-time comments & messages) ---
router.get("/facebook/webhook", facebookSocialController.verifyWebhook);
router.post("/facebook/webhook", facebookSocialController.handleWebhookPayload);

// --- Admin Post Studio & Meta Graph Publisher ---
router.get("/admin/facebook/presets", facebookPostAi.getPresets);
router.get("/admin/facebook/ad-signals", facebookPostAi.handleGetAdSignals);
router.post("/admin/facebook/smart-ad-campaign", facebookPostAi.handleGenerateSmartCampaign);
router.post("/admin/facebook/generate-copy", facebookPostAi.handleGeneratePostCopy);
router.post("/admin/facebook/generate-image", facebookPostAi.handleGeneratePostImage);
router.post("/admin/facebook/verify", facebookPostsController.verifyFacebookConnection);
router.get("/admin/facebook/posts", facebookPostsController.listPosts);
router.post("/admin/facebook/posts", facebookPostsController.createPost);
router.put("/admin/facebook/posts/:id", facebookPostsController.updatePost);
router.delete("/admin/facebook/posts/:id", facebookPostsController.deletePost);
router.post("/admin/facebook/posts/:id/publish", facebookPostsController.publishPostNow);
router.post("/admin/facebook/posts/:id/schedule", facebookPostsController.schedulePost);

// --- Admin Social Commerce Inbox & AI Agent ---
router.get("/admin/facebook/social/interactions", facebookSocialController.listSocialInteractions);
router.post("/admin/facebook/social/interactions/:id/reply", facebookSocialController.sendSocialReply);
router.get("/admin/facebook/social/customers/:senderId/history", facebookSocialController.getCustomerSocialHistory);
router.get("/admin/facebook/social/analytics", facebookSocialController.getSocialAnalytics);
router.post("/admin/facebook/social/simulate", facebookSocialController.simulateInteraction);
router.post("/admin/facebook/social/subscribe-webhooks", facebookSocialController.subscribePageWebhooks);

module.exports = router;
