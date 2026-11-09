const facebookSocialService = require("./facebookSocialService");
const getAdminDataModel = require("../settings/adminDataModel");
const axios = require("axios");
const { resolvePageAccessToken } = require("./facebookPostsController");

/**
 * Controller for Facebook Social Commerce, AI Inbox, Lead Generation & Meta Webhook
 */

async function listSocialInteractions(req, res) {
  try {
    const data = await facebookSocialService.listInteractions(req.subdomain, req.query);
    return res.json({ success: true, ...data });
  } catch (err) {
    console.error("[listSocialInteractions_ERROR]", err);
    return res.status(500).json({ success: false, message: err.message || "فشل جلب تفاعلات فيسبوك" });
  }
}

async function sendSocialReply(req, res) {
  try {
    const { id } = req.params;
    const { replyText, channel } = req.body;
    const result = await facebookSocialService.sendReply(
      req.subdomain,
      id,
      replyText,
      channel,
      req.user
    );
    return res.json({ success: true, ...result });
  } catch (err) {
    console.error("[sendSocialReply_ERROR]", err);
    return res.status(500).json({ success: false, message: err.message || "فشل إرسال الرد" });
  }
}

async function getCustomerSocialHistory(req, res) {
  try {
    const { senderId } = req.params;
    const phone = req.query.phone || "";
    const history = await facebookSocialService.getCustomerHistory(req.subdomain, senderId, phone);
    return res.json({ success: true, history });
  } catch (err) {
    console.error("[getCustomerSocialHistory_ERROR]", err);
    return res.status(500).json({ success: false, message: err.message || "فشل جلب سجل العميل" });
  }
}

async function getSocialAnalytics(req, res) {
  try {
    const analytics = await facebookSocialService.getSocialAnalytics(req.subdomain);
    return res.json({ success: true, analytics });
  } catch (err) {
    console.error("[getSocialAnalytics_ERROR]", err);
    return res.status(500).json({ success: false, message: err.message || "فشل جلب إحصائيات التفاعل الاجتماعي" });
  }
}

async function simulateInteraction(req, res) {
  try {
    const interaction = await facebookSocialService.processSocialInteraction(req.subdomain, req.body);
    return res.json({
      success: true,
      message: "تم محاكاة التفاعل وتحليله بالذكاء الاصطناعي بنجاح",
      interaction
    });
  } catch (err) {
    console.error("[simulateInteraction_ERROR]", err);
    return res.status(500).json({ success: false, message: err.message || "فشل إنشاء محاكاة التفاعل" });
  }
}

/**
 * Meta Webhook verification (GET /api/facebook/webhook)
 */
async function verifyWebhook(req, res) {
  try {
    const mode = req.query["hub.mode"];
    const token = req.query["hub.verify_token"];
    const challenge = req.query["hub.challenge"];

    const AdminData = getAdminDataModel(req.subdomain);
    const adminData = await AdminData.findOne({}).lean();
    const expectedToken = adminData?.FB_WEBHOOK_VERIFY_TOKEN || process.env.FB_WEBHOOK_VERIFY_TOKEN || "multi_tenant_secret_token";

    if (mode === "subscribe" && token === expectedToken) {
      console.log("[META_WEBHOOK_VERIFIED] Subdomain:", req.subdomain);
      return res.status(200).send(challenge);
    }
    return res.status(403).send("Verification token mismatch");
  } catch (err) {
    console.error("[verifyWebhook_ERROR]", err);
    return res.status(500).send("Webhook verify error");
  }
}

/**
 * Meta Webhook incoming payload handler (POST /api/facebook/webhook)
 */
async function handleWebhookPayload(req, res) {
  try {
    const body = req.body;
    if (body.object === "page") {
      for (const entry of body.entry || []) {
        // Handle Messenger Messages
        if (Array.isArray(entry.messaging)) {
          for (const msgEvent of entry.messaging) {
            if (msgEvent.message && !msgEvent.message.is_echo) {
              await facebookSocialService.processSocialInteraction(req.subdomain, {
                interactionType: "message",
                facebookId: msgEvent.message.mid || `msg_${Date.now()}`,
                content: msgEvent.message.text || "",
                sender: {
                  id: msgEvent.sender?.id || "unknown_sender",
                  name: "مستخدم ماسنجر"
                },
                rawMetadata: msgEvent
              }).catch((e) => console.error("[MSG_PROCESS_WARN]", e.message));
            }
          }
        }

        // Handle Feed Changes (Comments, Posts, Status, and Meta Test Button)
        if (Array.isArray(entry.changes)) {
          for (const change of entry.changes) {
            // 1. Feed Events
            if (change.field === "feed") {
              const val = change.value || {};
              const content = val.message || val.description || val.comment_text || "";
              const isComment = val.item === "comment";

              await facebookSocialService.processSocialInteraction(req.subdomain, {
                interactionType: isComment ? "comment" : "comment",
                facebookId: val.comment_id || val.post_id || `feed_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
                facebookPostId: val.post_id || "",
                content: content || "تفاعل تجريبي من لوحة فيسبوك",
                sender: {
                  id: val.from?.id || "facebook_user",
                  name: val.from?.name || (val.item ? `متابع (${val.item})` : "متابع فيسبوك")
                },
                rawMetadata: val
              }).catch((e) => console.error("[FEED_PROCESS_WARN]", e.message));
            }

            // 2. Messages via Changes format (Modern Meta API v26 & Test Button)
            if (change.field === "messages") {
              const val = change.value || {};
              const msgObj = val.message || val;
              const content = msgObj.text || val.text || val.message || "";

              await facebookSocialService.processSocialInteraction(req.subdomain, {
                interactionType: "message",
                facebookId: msgObj.mid || `msg_${Date.now()}`,
                content: content || "رسالة تجريبية من فيسبوك",
                sender: {
                  id: val.sender?.id || val.from?.id || "facebook_sender",
                  name: val.sender?.name || val.from?.name || "مستخدم ماسنجر"
                },
                rawMetadata: val
              }).catch((e) => console.error("[MSG_CHANGE_WARN]", e.message));
            }
          }
        }
      }

      return res.status(200).send("EVENT_RECEIVED");
    }
    return res.status(404).send("Not a page event");
  } catch (err) {
    console.error("[handleWebhookPayload_ERROR]", err);
    return res.status(200).send("EVENT_PROCESSED_WITH_WARN");
  }
}

/**
 * 1-Click Subscribe Page to Meta App Webhook (feed, messages)
 * POST /admin/facebook/social/subscribe-webhooks
 */
async function subscribePageWebhooks(req, res) {
  try {
    const AdminData = getAdminDataModel(req.subdomain);
    const adminData = await AdminData.findOne({}).lean();
    const pageId = req.body.pageId || adminData?.FB_PAGE_ID;
    let pageAccessToken = req.body.accessToken || adminData?.FB_PAGE_ACCESS_TOKEN;

    if (!pageId || !pageAccessToken) {
      return res.status(400).json({
        success: false,
        message: "يرجى إدخال وتخزين معرف الصفحة (Page ID) وتوكن الوصول أولاً."
      });
    }

    // Ensure we have a valid Page Access Token
    pageAccessToken = await resolvePageAccessToken(pageId, pageAccessToken, req.subdomain);

    // Call Meta Graph API to subscribe the page to the app's webhooks
    const graphRes = await axios.post(
      `https://graph.facebook.com/v19.0/${encodeURIComponent(pageId)}/subscribed_apps`,
      null,
      {
        params: {
          subscribed_fields: "feed,messages,messaging_postbacks",
          access_token: pageAccessToken
        },
        timeout: 15000
      }
    );

    if (graphRes.data?.success) {
      return res.json({
        success: true,
        message: "تم تفعيل اشتراك الصفحة في أحداث فيسبوك (feed, messages) بنجاح! ستصلك التعليقات والرسائل فوراً.",
        data: graphRes.data
      });
    }

    return res.status(400).json({
      success: false,
      message: "استجابة غير متوقعة من خوادم Meta",
      data: graphRes.data
    });
  } catch (err) {
    console.error("[subscribePageWebhooks_ERROR]", err.response?.data || err.message);
    const fbError = err.response?.data?.error?.message || err.message;
    return res.status(400).json({
      success: false,
      message: `فشل اشتراك الصفحة في الـ Webhook: ${fbError}`
    });
  }
}

module.exports = {
  listSocialInteractions,
  sendSocialReply,
  getCustomerSocialHistory,
  getSocialAnalytics,
  simulateInteraction,
  verifyWebhook,
  handleWebhookPayload,
  subscribePageWebhooks
};
