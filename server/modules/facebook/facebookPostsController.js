const axios = require("axios");
const getFacebookPostModel = require("./facebookPostModel");
const getAdminDataModel = require("../settings/adminDataModel");
const { checkFacebookAvailable } = require("../../core/middleware/aiDispatcher");
const {
  loadImageSourceAsBuffer,
  resolveSelectedProductsContext
} = require("./facebookPostAi");

const FB_GRAPH_BASE = "https://graph.facebook.com/v19.0";

/**
 * رفع صورة واحدة إلى صفحة فيسبوك (سواء كملف Binary محلي أو رابط عام)
 */
async function uploadPhotoToFacebookPage(pageId, accessToken, imageUrl, { caption = "", published = true } = {}) {
  const rawImg = await loadImageSourceAsBuffer(imageUrl);

  if (rawImg && rawImg.buffer) {
    const formData = new FormData();
    const blob = new Blob([rawImg.buffer], { type: rawImg.mimeType || "image/png" });
    formData.append("source", blob, rawImg.filename || "post-image.png");
    formData.append("access_token", accessToken);
    formData.append("published", published ? "true" : "false");
    if (published && caption) {
      formData.append("caption", caption);
    }

    const res = await fetch(`${FB_GRAPH_BASE}/${encodeURIComponent(pageId)}/photos`, {
      method: "POST",
      body: formData
    });

    const data = await res.json();
    if (!res.ok || data.error) {
      throw new Error(data.error?.message || `فشل رفع الصورة إلى فيسبوك (${res.status})`);
    }
    return data;
  }

  // Fallback إذا كانت الصورة رابطاً خارجياً عاماً
  const payload = {
    url: imageUrl,
    published: Boolean(published),
    access_token: accessToken
  };
  if (published && caption) {
    payload.caption = caption;
  }

  const res = await axios.post(`${FB_GRAPH_BASE}/${encodeURIComponent(pageId)}/photos`, payload, {
    timeout: 30000
  });
  return res.data;
}

/**
 * Ensures that the access token used is a true PAGE Access Token.
 * If the user supplied a User Access Token with manage/publish permissions,
 * we query /{page-id}?fields=access_token to automatically retrieve and use the Page Access Token.
 */
async function resolvePageAccessToken(pageId, rawToken, subdomain = null) {
  if (!rawToken || !pageId) return rawToken;

  let activeToken = rawToken;

  // If subdomain is provided, try retrieving App ID & Secret to auto-extend short-lived token to long-lived
  if (subdomain) {
    try {
      const AdminData = getAdminDataModel(subdomain);
      const adminData = await AdminData.findOne({}).lean();
      if (adminData?.FB_APP_ID && adminData?.FB_APP_SECRET) {
        try {
          const exRes = await axios.get(`${FB_GRAPH_BASE}/oauth/access_token`, {
            params: {
              grant_type: "fb_exchange_token",
              client_id: adminData.FB_APP_ID,
              client_secret: adminData.FB_APP_SECRET,
              fb_exchange_token: rawToken
            },
            timeout: 10000
          });
          if (exRes.data?.access_token) {
            activeToken = exRes.data.access_token;
            console.log("[FB_AUTO_EXTEND] Extended short-lived token into 60-day long-lived token via Meta OAuth API.");
          }
        } catch (exErr) {
          // Token may already be a page access token, ignore
        }
      }
    } catch {
      // Ignore settings fetch error
    }
  }

  try {
    const res = await axios.get(`${FB_GRAPH_BASE}/${encodeURIComponent(pageId)}`, {
      params: {
        fields: "access_token,name,id",
        access_token: activeToken
      },
      timeout: 12000
    });
    if (res.data?.access_token) {
      const pageToken = res.data.access_token;
      if (pageToken !== rawToken && subdomain) {
        try {
          const AdminData = getAdminDataModel(subdomain);
          await AdminData.updateOne({}, { $set: { FB_PAGE_ACCESS_TOKEN: pageToken } });
          console.log(`[FB_AUTO_UPGRADE_TOKEN] Upgraded to permanent Page Access Token for page: "${res.data.name || pageId}"`);
        } catch (dbErr) {
          console.warn("[FB_AUTO_UPGRADE_WARN]", dbErr.message);
        }
      }
      return pageToken;
    }
  } catch (err) {
    try {
      const accRes = await axios.get(`${FB_GRAPH_BASE}/me/accounts`, {
        params: { access_token: activeToken },
        timeout: 12000
      });
      const pages = accRes.data?.data || [];
      const match = pages.find((p) => String(p.id) === String(pageId));
      if (match?.access_token) {
        const pageToken = match.access_token;
        if (subdomain) {
          try {
            const AdminData = getAdminDataModel(subdomain);
            await AdminData.updateOne({}, { $set: { FB_PAGE_ACCESS_TOKEN: pageToken } });
            console.log(`[FB_AUTO_UPGRADE_TOKEN] Upgraded to Page Access Token via /me/accounts for "${match.name || pageId}"`);
          } catch (dbErr) {
            console.warn("[FB_AUTO_UPGRADE_WARN]", dbErr.message);
          }
        }
        return pageToken;
      }
    } catch (accErr) {
      // Ignore fallback error
    }
  }
  return activeToken;
}

exports.resolvePageAccessToken = resolvePageAccessToken;
exports.publishPostToFacebookGraph = publishPostToFacebookGraph;
async function publishPostToFacebookGraph(subdomain, postDoc, adminData = {}) {
  if (!checkFacebookAvailable({ adminData })) {
    const err = new Error(
      "بيانات ربط صفحة الفيسبوك (Meta Page ID & Access Token) غير مفعلة أو غير مكتملة في الإعدادات."
    );
    err.status = 403;
    throw err;
  }

  const pageId = (adminData.FB_PAGE_ID || process.env.FB_PAGE_ID || "").trim();
  const rawToken = (adminData.FB_PAGE_ACCESS_TOKEN || process.env.FB_PAGE_ACCESS_TOKEN || "").trim();

  // Auto-resolve Page Access Token if a User Access Token was provided
  const accessToken = await resolvePageAccessToken(pageId, rawToken, subdomain);

  const images = (postDoc.images || []).filter(Boolean);
  const message = postDoc.postText || "";

  let fbPostId = "";

  try {
    if (images.length === 1) {
      // نشر صورة واحدة مع النص الكامل للبوست
      const data = await uploadPhotoToFacebookPage(pageId, accessToken, images[0], {
        caption: message,
        published: true
      });
      fbPostId = data.post_id || data.id || "";
    } else if (images.length > 1) {
      // رفع عدة صور كـ Unpublished ثم إرفاقها في منشور واحد متعدد الصور
      const attachedMedia = [];
      for (const imgUrl of images.slice(0, 6)) {
        const uploaded = await uploadPhotoToFacebookPage(pageId, accessToken, imgUrl, {
          published: false
        });
        if (uploaded?.id) {
          attachedMedia.push({ media_fbid: uploaded.id });
        }
      }

      const feedRes = await axios.post(
        `${FB_GRAPH_BASE}/${encodeURIComponent(pageId)}/feed`,
        {
          message,
          attached_media: attachedMedia,
          access_token: accessToken
        },
        { timeout: 30000 }
      );
      fbPostId = feedRes.data?.id || "";
    } else {
      // منشور نصي فقط بدون صور
      const feedRes = await axios.post(
        `${FB_GRAPH_BASE}/${encodeURIComponent(pageId)}/feed`,
        {
          message,
          access_token: accessToken
        },
        { timeout: 25000 }
      );
      fbPostId = feedRes.data?.id || "";
    }
  } catch (err) {
    const origMsg = err.response?.data?.error?.message || err.message || "";
    if (origMsg.includes("Unpublished posts must be posted to a page as the page itself") || err.response?.data?.error?.code === 200) {
      throw new Error(
        "خطأ من فيسبوك (#200): التوكن الحالي هو توكن مستخدم شخصي (User Token) وليس توكن الصفحة (Page Access Token). عند توليد التوكن من Meta Graph API Explorer، اختر اسم صفحتك من خانة 'User or Page' ليتم النشر باسم الصفحة نفسها."
      );
    }
    throw err;
  }

  const fbPostUrl = fbPostId ? `https://www.facebook.com/${fbPostId}` : `https://www.facebook.com/${pageId}`;

  return {
    fbPostId,
    fbPostUrl,
    publishedAt: new Date()
  };
}

/**
 * 1. عرض قائمة البوستات المحفوظة والمجدولة والمنشورة (Server Pagination)
 */
exports.listPosts = async (req, res, next) => {
  try {
    const FacebookPost = getFacebookPostModel(req.subdomain);
    const { status, page = 1, limit = 12 } = req.query;

    const query = {};
    if (status && status !== "all") {
      query.status = status;
    }

    const p = Math.max(1, parseInt(page) || 1);
    const l = Math.max(1, Math.min(parseInt(limit) || 12, 50));

    const [total, posts] = await Promise.all([
      FacebookPost.countDocuments(query),
      FacebookPost.find(query)
        .sort({ createdAt: -1 })
        .skip((p - 1) * l)
        .limit(l)
        .lean()
    ]);

    res.json({
      done: true,
      posts,
      total,
      page: p,
      pages: Math.max(1, Math.ceil(total / l)),
      isFacebookAvailable: checkFacebookAvailable(req)
    });
  } catch (err) {
    next(err);
  }
};

/**
 * 2. إنشاء وحفظ بوست جديد (مع إمكانية النشر الفوري أو الجدولة إذا كانت بيانات فيسبوك متوفرة)
 */
exports.createPost = async (req, res, next) => {
  try {
    const FacebookPost = getFacebookPostModel(req.subdomain);
    const body = req.body || {};

    if (!body.postText || !String(body.postText).trim()) {
      return res.status(400).json({ error: "نص البوست مطلوب للحفظ" });
    }

    let productsSnapshot = Array.isArray(body.productsSnapshot) ? body.productsSnapshot : [];
    if (productsSnapshot.length === 0 && Array.isArray(body.productIds) && body.productIds.length > 0) {
      productsSnapshot = await resolveSelectedProductsContext(req.subdomain, body.productIds);
    }

    const isFbConfigured = checkFacebookAvailable(req);
    let initialStatus = "draft";
    let scheduledAtDate = null;

    if (body.scheduledAt) {
      if (!isFbConfigured) {
        return res.status(403).json({
          error: "لا يمكن جدولة النشر قبل إدخال بيانات ربط صفحة الفيسبوك (Meta Credentials) في الإعدادات."
        });
      }
      scheduledAtDate = new Date(body.scheduledAt);
      if (isNaN(scheduledAtDate.getTime())) {
        return res.status(400).json({ error: "تاريخ ووقت الجدولة غير صالح" });
      }
      initialStatus = "scheduled";
    }

    const postDoc = await new FacebookPost({
      productIds: Array.isArray(body.productIds) ? body.productIds : [],
      productsSnapshot,
      preset: body.preset || "urgent_fomo",
      discountText: body.discountText || "",
      customPrompt: body.customPrompt || "",
      postText: String(body.postText).trim(),
      headline: body.headline || "",
      subheadline: body.subheadline || "",
      badgeText: body.badgeText || "",
      ctaText: body.ctaText || "",
      imageOverlayText: body.imageOverlayText || "",
      imageDesignPrompt: body.imageDesignPrompt || "",
      postImageCountMode: body.postImageCountMode || "single",
      visualMode: body.visualMode || "svg_template",
      svgTemplateId: body.svgTemplateId || "modern_spotlight",
      coverImage: body.coverImage || "",
      additionalImages: Array.isArray(body.additionalImages)
        ? body.additionalImages.filter(Boolean)
        : [],
      perProductPrompts: body.perProductPrompts || {},
      images: Array.isArray(body.images) ? body.images.filter(Boolean) : [],
      status: initialStatus,
      scheduledAt: scheduledAtDate
    }).save();

    // إذا طلب المستخدم النشر الفوري الآن
    if (body.publishNow) {
      if (!isFbConfigured) {
        return res.status(403).json({
          error: "تم حفظ البوست كمسودة، لكن النشر المباشر يتطلب إدخال بيانات ربط صفحة الفيسبوك في الإعدادات.",
          post: postDoc
        });
      }

      try {
        postDoc.status = "publishing";
        await postDoc.save();

        const pubRes = await publishPostToFacebookGraph(req.subdomain, postDoc, req.adminData);
        postDoc.status = "published";
        postDoc.fbPostId = pubRes.fbPostId;
        postDoc.fbPostUrl = pubRes.fbPostUrl;
        postDoc.publishedAt = pubRes.publishedAt;
        postDoc.lastError = "";
        await postDoc.save();

        return res.status(201).json({
          done: true,
          post: postDoc,
          message: "تم حفظ البوست ونشره فوراً على صفحة الفيسبوك بنجاح! 🎉"
        });
      } catch (pubErr) {
        postDoc.status = "failed";
        postDoc.lastError = pubErr.response?.data?.error?.message || pubErr.message;
        await postDoc.save();

        return res.status(502).json({
          done: false,
          post: postDoc,
          error: `تم حفظ البوست ولكن تعذر النشر على فيسبوك: ${postDoc.lastError}`
        });
      }
    }

    res.status(201).json({
      done: true,
      post: postDoc,
      message:
        initialStatus === "scheduled"
          ? "تم حفظ وجدولة البوست للنشر التلقائي على فيسبوك بنجاح! ⏰"
          : "تم حفظ البوست في قائمة المنشورات بنجاح!"
    });
  } catch (err) {
    next(err);
  }
};

/**
 * 3. تعديل بوست محفوظ أو مجدول
 */
exports.updatePost = async (req, res, next) => {
  try {
    const FacebookPost = getFacebookPostModel(req.subdomain);
    const body = req.body || {};

    const post = await FacebookPost.findById(req.params.id);
    if (!post) return res.status(404).json({ error: "المنشور غير موجود" });

    if (Array.isArray(body.productIds)) {
      post.productIds = body.productIds;
      post.productsSnapshot = await resolveSelectedProductsContext(req.subdomain, body.productIds);
    }
    if (body.preset !== undefined) post.preset = body.preset;
    if (body.customPrompt !== undefined) post.customPrompt = body.customPrompt;
    if (body.postText !== undefined) post.postText = String(body.postText).trim();
    if (body.headline !== undefined) post.headline = body.headline;
    if (body.subheadline !== undefined) post.subheadline = body.subheadline;
    if (body.badgeText !== undefined) post.badgeText = body.badgeText;
    if (body.ctaText !== undefined) post.ctaText = body.ctaText;
    if (body.discountText !== undefined) post.discountText = body.discountText;
    if (body.imageOverlayText !== undefined) post.imageOverlayText = body.imageOverlayText;
    if (body.imageDesignPrompt !== undefined) post.imageDesignPrompt = body.imageDesignPrompt;
    if (body.postImageCountMode) post.postImageCountMode = body.postImageCountMode;
    if (body.visualMode) post.visualMode = body.visualMode;
    if (body.svgTemplateId) post.svgTemplateId = body.svgTemplateId;
    if (body.coverImage !== undefined) post.coverImage = body.coverImage;
    if (Array.isArray(body.additionalImages)) {
      post.additionalImages = body.additionalImages.filter(Boolean);
    }
    if (body.perProductPrompts !== undefined) post.perProductPrompts = body.perProductPrompts;
    if (Array.isArray(body.images)) post.images = body.images.filter(Boolean);

    if (body.scheduledAt !== undefined) {
      if (body.scheduledAt) {
        if (!checkFacebookAvailable(req)) {
          return res.status(403).json({
            error: "لا يمكن جدولة المنشور قبل تفعيل بيانات ربط فيسبوك في الإعدادات."
          });
        }
        post.scheduledAt = new Date(body.scheduledAt);
        post.status = "scheduled";
      } else {
        post.scheduledAt = null;
        if (post.status === "scheduled") post.status = "draft";
      }
    }

    await post.save();
    res.json({ done: true, post, message: "تم تحديث وحفظ تعديلات البوست بنجاح!" });
  } catch (err) {
    next(err);
  }
};

/**
 * 4. حذف بوست
 */
exports.deletePost = async (req, res, next) => {
  try {
    const FacebookPost = getFacebookPostModel(req.subdomain);
    const deleted = await FacebookPost.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ error: "المنشور غير موجود" });
    res.json({ done: true, message: "تم حذف المنشور بنجاح" });
  } catch (err) {
    next(err);
  }
};

/**
 * 5. نشر فوري لبوست محفوظ على صفحة الفيسبوك
 */
exports.publishPostNow = async (req, res, next) => {
  try {
    if (!checkFacebookAvailable(req)) {
      return res.status(403).json({
        done: false,
        error: "ربط صفحة الفيسبوك غير مفعل. يرجى إضافة Page ID و Page Access Token في الإعدادات أولاً."
      });
    }

    const FacebookPost = getFacebookPostModel(req.subdomain);
    const postDoc = await FacebookPost.findById(req.params.id);
    if (!postDoc) return res.status(404).json({ error: "المنشور غير موجود" });

    try {
      postDoc.status = "publishing";
      await postDoc.save();

      const pubRes = await publishPostToFacebookGraph(req.subdomain, postDoc, req.adminData);
      postDoc.status = "published";
      postDoc.fbPostId = pubRes.fbPostId;
      postDoc.fbPostUrl = pubRes.fbPostUrl;
      postDoc.publishedAt = pubRes.publishedAt;
      postDoc.lastError = "";
      await postDoc.save();

      res.json({
        done: true,
        post: postDoc,
        message: "تم نشر البوست على صفحة الفيسبوك بنجاح! 🎉"
      });
    } catch (pubErr) {
      postDoc.status = "failed";
      postDoc.lastError = pubErr.response?.data?.error?.message || pubErr.message;
      await postDoc.save();

      res.status(502).json({
        done: false,
        post: postDoc,
        error: `فشل النشر على فيسبوك: ${postDoc.lastError}`
      });
    }
  } catch (err) {
    next(err);
  }
};

/**
 * 6. جدولة نشر بوست محفوظ لوقت محدد
 */
exports.schedulePost = async (req, res, next) => {
  try {
    if (!checkFacebookAvailable(req)) {
      return res.status(403).json({
        done: false,
        error: "جدولة النشر تتطلب تفعيل بيانات ربط صفحة الفيسبوك (Meta Credentials) في الإعدادات."
      });
    }

    const { scheduledAt } = req.body || {};
    if (!scheduledAt) {
      return res.status(400).json({ error: "يرجى تحديد تاريخ ووقت الجدولة" });
    }

    const targetDate = new Date(scheduledAt);
    if (isNaN(targetDate.getTime())) {
      return res.status(400).json({ error: "صيغة التاريخ والوقت غير صحيحة" });
    }

    const FacebookPost = getFacebookPostModel(req.subdomain);
    const postDoc = await FacebookPost.findById(req.params.id);
    if (!postDoc) return res.status(404).json({ error: "المنشور غير موجود" });

    postDoc.scheduledAt = targetDate;
    postDoc.status = "scheduled";
    postDoc.lastError = "";
    await postDoc.save();

    res.json({
      done: true,
      post: postDoc,
      message: `تمت جدولة نشر البوست بنجاح ليوم ${targetDate.toLocaleString("ar-EG")} ⏰`
    });
  } catch (err) {
    next(err);
  }
};

/**
 * 7. اختبار والتحقق من اتصال صفحة الفيسبوك (Verify Meta Credentials)
 */
exports.verifyFacebookConnection = async (req, res) => {
  try {
    const body = req.body || {};
    const adminData = req.adminData || {};

    const pageId = (body.FB_PAGE_ID || adminData.FB_PAGE_ID || process.env.FB_PAGE_ID || "").trim();
    const accessToken = (
      body.FB_PAGE_ACCESS_TOKEN ||
      adminData.FB_PAGE_ACCESS_TOKEN ||
      process.env.FB_PAGE_ACCESS_TOKEN ||
      ""
    ).trim();

    if (!pageId || !accessToken) {
      return res.status(400).json({
        done: false,
        error: "يرجى إدخال معرف الصفحة (Page ID) وتوكن الوصول (Page Access Token) أولاً"
      });
    }

    const response = await axios.get(`${FB_GRAPH_BASE}/${encodeURIComponent(pageId)}`, {
      params: {
        fields: "id,name,fan_count,link,access_token",
        access_token: accessToken
      },
      timeout: 15000
    });

    let resolvedPageToken = response.data?.access_token || accessToken;
    let isUserToken = Boolean(response.data?.access_token && response.data.access_token !== accessToken);

    // If access_token was not in direct fields, try /me/accounts
    if (!response.data?.access_token) {
      try {
        const accRes = await axios.get(`${FB_GRAPH_BASE}/me/accounts`, {
          params: { access_token: accessToken },
          timeout: 8000
        });
        const match = (accRes.data?.data || []).find((p) => String(p.id) === String(pageId));
        if (match?.access_token) {
          resolvedPageToken = match.access_token;
          isUserToken = true;
        }
      } catch (e) {}
    }

    // Auto-update AdminData with the true Page Access Token if it was a User Token
    if (resolvedPageToken && resolvedPageToken !== accessToken && req.subdomain) {
      try {
        const AdminData = getAdminDataModel(req.subdomain);
        await AdminData.updateOne({}, { $set: { FB_PAGE_ACCESS_TOKEN: resolvedPageToken } });
        console.log(`[FB_VERIFY_UPGRADE] Auto-upgraded to Page Access Token in DB for page "${response.data?.name || pageId}"`);
      } catch (dbErr) {
        console.warn("[FB_VERIFY_UPGRADE_WARN]", dbErr.message);
      }
    }

    res.json({
      done: true,
      page: response.data,
      resolvedPageToken,
      isUserToken,
      message: isUserToken
        ? `تم الاتصال بنجاح! تم استخراج توكن الصفحة المباشر (Page Access Token) لصفحة: "${response.data?.name || pageId}".`
        : `تم الاتصال بنجاح بصفحة فيسبوك: "${response.data?.name || pageId}"!`
    });
  } catch (err) {
    const fbErr =
      err.response?.data?.error?.message ||
      err.message ||
      "تعذر التحقق من بيانات صفحة الفيسبوك، تأكد من صحة Page ID وصلاحية التوكن.";
    res.status(400).json({
      done: false,
      error: fbErr
    });
  }
};

/**
 * 8. المجدول الخلفي التلقائي لنشر البوستات المجدولة عند حلول موعدها (Background Cron Worker)
 */
let schedulerInterval = null;

exports.initFacebookPostScheduler = (getActiveSubdomainsFn) => {
  if (schedulerInterval) return;

  schedulerInterval = setInterval(async () => {
    try {
      const subdomains =
        typeof getActiveSubdomainsFn === "function" ? getActiveSubdomainsFn() : ["localhost"];

      const now = new Date();

      for (const subdomain of subdomains) {
        try {
          const AdminData = getAdminDataModel(subdomain);
          const adminData = await AdminData.findOne().lean();
          if (!adminData || !checkFacebookAvailable({ adminData })) continue;

          const FacebookPost = getFacebookPostModel(subdomain);
          const duePosts = await FacebookPost.find({
            status: "scheduled",
            scheduledAt: { $ne: null, $lte: now }
          }).limit(5);

          for (const postDoc of duePosts) {
            try {
              postDoc.status = "publishing";
              await postDoc.save();

              const pubRes = await publishPostToFacebookGraph(subdomain, postDoc, adminData);
              postDoc.status = "published";
              postDoc.fbPostId = pubRes.fbPostId;
              postDoc.fbPostUrl = pubRes.fbPostUrl;
              postDoc.publishedAt = pubRes.publishedAt;
              postDoc.lastError = "";
              await postDoc.save();
              console.log(
                `[FB_SCHEDULER] Successfully published scheduled post ${postDoc._id} for tenant "${subdomain}"`
              );
            } catch (pubErr) {
              postDoc.status = "failed";
              postDoc.lastError = pubErr.response?.data?.error?.message || pubErr.message;
              await postDoc.save();
              console.error(
                `[FB_SCHEDULER_ERR] Failed scheduled post ${postDoc._id} for tenant "${subdomain}":`,
                postDoc.lastError
              );
            }
          }
        } catch {
          // تخطي المستأجر في حال عدم جاهزية اتصاله بعد
        }
      }
    } catch (err) {
      console.error("[FB_SCHEDULER_LOOP_ERR]", err.message);
    }
  }, 30 * 1000);

  if (schedulerInterval && typeof schedulerInterval.unref === "function") {
    schedulerInterval.unref();
  }
};

