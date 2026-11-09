const mongoose = require("mongoose");
const getSocialInteractionModel = require("./socialInteractionModel");
const getFacebookPostModel = require("./facebookPostModel");
const getProductsModel = require("../products/productModel");
const getOrdersModel = require("../orders/orderModel");
const getUsersModel = require("../auth/userModel");
const getAdminDataModel = require("../settings/adminDataModel");
const getBranchModel = require("../branches/branchModel");
const aiSocialEngine = require("./aiSocialEngine");
const axios = require("axios");

/**
 * Process an incoming or simulated social interaction (Comment or Message)
 */
async function processSocialInteraction(subdomain, payload = {}) {
  const SocialInteraction = getSocialInteractionModel(subdomain);
  const FacebookPost = getFacebookPostModel(subdomain);
  const Products = getProductsModel(subdomain);
  const Users = getUsersModel(subdomain);
  const AdminData = getAdminDataModel(subdomain);
  const Branch = getBranchModel(subdomain);

  const [adminData, mainBranch] = await Promise.all([
    AdminData.findOne({}).lean(),
    Branch.findOne({ isMain: true }).lean() || Branch.findOne({}).lean()
  ]);

  const interactionType = payload.interactionType === "message" ? "message" : "comment";
  const facebookId = payload.facebookId || `sim_fb_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const facebookPostId = payload.facebookPostId || "";
  const content = String(payload.content || "").trim();
  const senderId = payload.sender?.id || `user_${Date.now()}`;
  const senderName = payload.sender?.name || "متابع الصفحة";
  const senderAvatar = payload.sender?.avatar || "";

  // 1. Check sender's previous history & existing store account
  const [priorCount, storeUser] = await Promise.all([
    SocialInteraction.countDocuments({ "sender.id": senderId }),
    Users.findOne({
      $or: [
        { name: new RegExp(`^${senderName}$`, "i") },
        ...(payload.sender?.phone ? [{ phone: payload.sender.phone }] : [])
      ]
    }).lean()
  ]);

  // 2. Extract Phone Number
  const extractedPhone = aiSocialEngine.extractPhoneNumber(content) || payload.sender?.phone || "";

  // 3. Classify Intent & Sentiment
  const { intent, sentiment, isHighIntentLead } = aiSocialEngine.classifyIntentAndSentiment(
    content,
    extractedPhone
  );

  // 4. Grounding: Find Matched Product
  let matchedProduct = null;
  let postText = payload.facebookPostText || "";

  // Try matching via attached facebookPostId
  if (facebookPostId) {
    const postDoc = await FacebookPost.findOne({
      $or: [{ fbPostId: facebookPostId }, ...(mongoose.isValidObjectId(facebookPostId) ? [{ _id: facebookPostId }] : [])]
    }).lean();

    if (postDoc) {
      postText = postDoc.postText || "";
      if (Array.isArray(postDoc.productIds) && postDoc.productIds.length > 0) {
        const prod = await Products.findById(postDoc.productIds[0]).lean();
        if (prod) {
          matchedProduct = {
            productId: prod._id,
            name: prod.name,
            price: Number(prod.price || 0),
            stockCount: Number(prod.stockCount ?? prod.stock ?? 0),
            sku: prod.sku || "",
            installmentEligible: true,
            installmentSample: {
              downPayment: Math.round(Number(prod.price || 0) * 0.2),
              monthlyAmount: Math.round(((Number(prod.price || 0) * 0.8) / 6) * 100) / 100,
              months: 6
            },
            productUrl: `/product/${prod._id}`
          };
        }
      }
    }
  }

  // If still no product matched, try keyword search on content
  if (!matchedProduct && content.length >= 3) {
    const words = content.replace(/[؟?.,!]/g, "").split(/\s+/).filter((w) => w.length >= 3);
    if (words.length > 0) {
      const regexWords = words.slice(0, 3).map((w) => new RegExp(w, "i"));
      const foundProd = await Products.findOne({
        status: { $ne: "archived" },
        $or: [{ name: { $in: regexWords } }, { tags: { $in: words } }]
      }).lean();

      if (foundProd) {
        matchedProduct = {
          productId: foundProd._id,
          name: foundProd.name,
          price: Number(foundProd.price || 0),
          stockCount: Number(foundProd.stockCount ?? foundProd.stock ?? 0),
          sku: foundProd.sku || "",
          installmentEligible: true,
          installmentSample: {
            downPayment: Math.round(Number(foundProd.price || 0) * 0.2),
            monthlyAmount: Math.round(((Number(foundProd.price || 0) * 0.8) / 6) * 100) / 100,
            months: 6
          },
          productUrl: `/product/${foundProd._id}`
        };
      }
    }
  }

  // 5. Query Knowledge Base (RAG)
  const ragData = aiSocialEngine.queryKnowledgeBase(content, adminData || {}, mainBranch || {});

  // 6. Formulate Grounded Smart Reply
  const generatedReply = aiSocialEngine.formulateSmartReply({
    senderName,
    intent,
    content,
    extractedPhone,
    matchedProduct,
    ragData,
    adminData: adminData || {},
    branch: mainBranch || {}
  });

  // 7. Save Interaction
  const interaction = await SocialInteraction.create({
    interactionType,
    facebookId,
    facebookPostId,
    facebookPostText: postText,
    sender: {
      id: senderId,
      name: senderName,
      avatar: senderAvatar,
      extractedPhone,
      previousInteractionsCount: priorCount,
      hasStoreAccount: Boolean(storeUser),
      storeUserId: storeUser?._id || null
    },
    content,
    matchedProduct: matchedProduct || undefined,
    classification: {
      intent,
      confidence: 0.95,
      sentiment,
      extractedPhone,
      isHighIntentLead
    },
    ragKnowledge: {
      usedKnowledge: ragData.used,
      topic: ragData.topic,
      excerpt: ragData.text
    },
    reply: {
      generatedReply,
      sentReply: "",
      status: "pending",
      sentAt: null,
      sentVia: interactionType === "message" ? "private_messenger" : "comment_reply",
      sentByName: "الرد الذكي التلقائي"
    },
    rawMetadata: payload
  });

  // If Full Auto-Reply is enabled in store settings, dispatch live reply immediately from the server!
  const isAutoReplyOn = adminData?.FB_AUTO_REPLY_ENABLED !== false && Boolean(adminData?.FB_PAGE_ACCESS_TOKEN);
  if (isAutoReplyOn && !facebookId.startsWith("sim_") && generatedReply) {
    try {
      // Auto-reply asynchronously without blocking webhook return
      setImmediate(async () => {
        try {
          await sendReply(
            subdomain,
            interaction._id,
            generatedReply,
            interactionType === "message" ? "private_messenger" : "comment_reply",
            { fullname: "المساعد الذكي التلقائي (AI Agent)" }
          );
          console.log(`[FB_AUTO_REPLY_DISPATCHED] Successfully auto-replied to ${interactionType} for ${senderName}`);
        } catch (autoErr) {
          console.warn("[FB_AUTO_REPLY_WARN]", autoErr.message);
        }
      });
    } catch (dispatchErr) {
      console.warn("[FB_AUTO_DISPATCH_WARN]", dispatchErr.message);
    }
  }

  return interaction;
}

/**
 * List social interactions with filters and pagination
 */
async function listInteractions(subdomain, query = {}) {
  const SocialInteraction = getSocialInteractionModel(subdomain);
  const filter = {};

  if (query.type && query.type !== "all") {
    filter.interactionType = query.type;
  }
  if (query.intent && query.intent !== "all") {
    filter["classification.intent"] = query.intent;
  }
  if (query.sentiment && query.sentiment !== "all") {
    filter["classification.sentiment"] = query.sentiment;
  }
  if (query.highIntentOnly === "true" || query.highIntentOnly === true) {
    filter["classification.isHighIntentLead"] = true;
  }
  if (query.hasPhoneOnly === "true" || query.hasPhoneOnly === true) {
    filter["sender.extractedPhone"] = { $ne: "" };
  }
  if (query.status && query.status !== "all") {
    filter["reply.status"] = query.status;
  }
  if (query.search && query.search.trim()) {
    const s = query.search.trim();
    const rgx = new RegExp(s, "i");
    filter.$or = [
      { content: rgx },
      { "sender.name": rgx },
      { "sender.extractedPhone": rgx },
      { "matchedProduct.name": rgx },
      { "reply.generatedReply": rgx }
    ];
  }

  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const limit = Math.max(1, parseInt(query.limit, 10) || 20);
  const skip = (page - 1) * limit;

  const [interactions, total] = await Promise.all([
    SocialInteraction.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    SocialInteraction.countDocuments(filter)
  ]);

  return {
    interactions,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit) || 1
    }
  };
}

/**
 * Send or Approve a Reply to Comment / Messenger
 */
async function sendReply(subdomain, interactionId, replyText, channel = "comment_reply", operatorUser = null) {
  const SocialInteraction = getSocialInteractionModel(subdomain);
  const AdminData = getAdminDataModel(subdomain);

  const interaction = await SocialInteraction.findById(interactionId);
  if (!interaction) {
    throw new Error("المحادثة أو التعليق غير موجود");
  }

  const textToSend = String(replyText || interaction.reply.generatedReply || "").trim();
  if (!textToSend) {
    throw new Error("نص الرد لا يمكن أن يكون فارغاً");
  }

  const adminData = await AdminData.findOne({}).lean();
  const pageAccessToken = adminData?.FB_PAGE_ACCESS_TOKEN;
  let isLiveSent = false;
  let liveError = "";

  // If live Facebook Page Access Token exists and not a simulated ID, dispatch via Graph API
  if (pageAccessToken && !interaction.facebookId.startsWith("sim_")) {
    try {
      if (channel === "private_messenger" && interaction.interactionType === "comment") {
        // Private reply to comment
        await axios.post(
          `https://graph.facebook.com/v19.0/me/messages?access_token=${pageAccessToken}`,
          {
            recipient: { comment_id: interaction.facebookId },
            message: { text: textToSend }
          }
        );
        isLiveSent = true;
      } else if (interaction.interactionType === "comment") {
        // Public comment reply
        await axios.post(
          `https://graph.facebook.com/v19.0/${interaction.facebookId}/comments?access_token=${pageAccessToken}`,
          { message: textToSend }
        );
        isLiveSent = true;
      } else {
        // Direct Messenger message
        await axios.post(
          `https://graph.facebook.com/v19.0/me/messages?access_token=${pageAccessToken}`,
          {
            recipient: { id: interaction.sender.id },
            message: { text: textToSend }
          }
        );
        isLiveSent = true;
      }
    } catch (apiErr) {
      console.warn("[META_GRAPH_SEND_WARN]", apiErr.response?.data?.error?.message || apiErr.message);
      liveError = apiErr.response?.data?.error?.message || apiErr.message;
    }
  }

  interaction.reply.sentReply = textToSend;
  interaction.reply.status = "sent";
  interaction.reply.sentAt = new Date();
  interaction.reply.sentVia = channel;
  interaction.reply.sentByName = operatorUser?.fullname || operatorUser?.name || "المشرف المالي/المبيعات";
  if (liveError) interaction.reply.errorReason = liveError;

  await interaction.save();

  return {
    interaction,
    isLiveSent,
    liveError: liveError || null
  };
}

/**
 * Get Customer unified timeline (Prior comments, messages, orders)
 */
async function getCustomerHistory(subdomain, senderId, extractedPhone = "") {
  const SocialInteraction = getSocialInteractionModel(subdomain);
  const Orders = getOrdersModel(subdomain);

  const interactionFilter = {
    $or: [{ "sender.id": senderId }, ...(extractedPhone ? [{ "sender.extractedPhone": extractedPhone }] : [])]
  };

  const orderFilter = extractedPhone ? { "customer.phone": new RegExp(extractedPhone.slice(-8)) } : { _id: null };

  const [interactions, orders] = await Promise.all([
    SocialInteraction.find(interactionFilter).sort({ createdAt: -1 }).limit(30).lean(),
    extractedPhone ? Orders.find(orderFilter).sort({ createdAt: -1 }).limit(10).lean() : []
  ]);

  return {
    senderId,
    extractedPhone,
    interactionsCount: interactions.length,
    ordersCount: orders.length,
    interactions,
    orders
  };
}

/**
 * Aggregated Social Commerce Analytics
 */
async function getSocialAnalytics(subdomain) {
  const SocialInteraction = getSocialInteractionModel(subdomain);

  const [
    totalInteractions,
    totalComments,
    totalMessages,
    highIntentLeads,
    withPhoneCount,
    sentRepliesCount,
    sentimentStats,
    intentStats,
    topProducts
  ] = await Promise.all([
    SocialInteraction.countDocuments({}),
    SocialInteraction.countDocuments({ interactionType: "comment" }),
    SocialInteraction.countDocuments({ interactionType: "message" }),
    SocialInteraction.countDocuments({ "classification.isHighIntentLead": true }),
    SocialInteraction.countDocuments({ "sender.extractedPhone": { $ne: "" } }),
    SocialInteraction.countDocuments({ "reply.status": "sent" }),
    SocialInteraction.aggregate([
      { $group: { _id: "$classification.sentiment", count: { $sum: 1 } } }
    ]),
    SocialInteraction.aggregate([
      { $group: { _id: "$classification.intent", count: { $sum: 1 } } }
    ]),
    SocialInteraction.aggregate([
      { $match: { "matchedProduct.name": { $exists: true, $ne: "" } } },
      { $group: { _id: "$matchedProduct.name", count: { $sum: 1 }, price: { $first: "$matchedProduct.price" } } },
      { $sort: { count: -1 } },
      { $limit: 5 }
    ])
  ]);

  return {
    totalInteractions,
    totalComments,
    totalMessages,
    highIntentLeads,
    withPhoneCount,
    sentRepliesCount,
    autoReplyRate: totalInteractions > 0 ? Math.round((sentRepliesCount / totalInteractions) * 100) : 0,
    sentimentBreakdown: sentimentStats.reduce((acc, s) => ({ ...acc, [s._id || "neutral"]: s.count }), {}),
    intentBreakdown: intentStats.reduce((acc, i) => ({ ...acc, [i._id || "general"]: i.count }), {}),
    topProducts
  };
}

module.exports = {
  processSocialInteraction,
  listInteractions,
  sendReply,
  getCustomerHistory,
  getSocialAnalytics
};
