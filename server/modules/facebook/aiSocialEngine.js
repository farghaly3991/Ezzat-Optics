const getProductsModel = require("../products/productModel");
const getBranchModel = require("../branches/branchModel");
const getAdminDataModel = require("../settings/adminDataModel");

/**
 * Extract phone number from Arabic or English text
 */
function extractPhoneNumber(text = "") {
  if (!text) return "";
  // Match Egyptian mobile numbers (010, 011, 012, 015) or international (+201..., 00201...) or general 8-14 digits
  const phoneRegex = /(?:\+?20|0020)?0?1[0125]\d{8}\b|(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g;
  const matches = text.match(phoneRegex);
  if (matches && matches.length > 0) {
    // Return cleanest candidate
    return matches[0].replace(/[\s-]/g, "");
  }
  return "";
}

/**
 * Classify user intent and sentiment
 */
function classifyIntentAndSentiment(content = "", extractedPhone = "") {
  const clean = content.toLowerCase();

  let intent = "general_inquiry";
  let sentiment = "neutral";
  let isHighIntentLead = Boolean(extractedPhone);

  // 1. Complaint / Negative
  if (
    clean.includes("نصاب") ||
    clean.includes("شكوى") ||
    clean.includes("محدش بيرد") ||
    clean.includes("سيء") ||
    clean.includes("وحش") ||
    clean.includes("متأخر") ||
    clean.includes("بايظ") ||
    clean.includes("مستهتر") ||
    clean.includes("فين الاوردر") ||
    clean.includes("ضحكتوا")
  ) {
    intent = "complaint";
    sentiment = "negative";
  }
  // 2. High Intent Purchase Lead
  else if (
    extractedPhone ||
    clean.includes("عايز اشتري") ||
    clean.includes("احجزلي") ||
    clean.includes("عايز اطلب") ||
    clean.includes("هطلب") ||
    clean.includes("رقمي اهو") ||
    clean.includes("تواصل معايا") ||
    clean.includes("ابعتلي مندوب") ||
    clean.includes("ابعتولي") ||
    clean.includes("هاتلي")
  ) {
    intent = "purchase_lead";
    sentiment = "positive";
    isHighIntentLead = true;
  }
  // 3. Installment inquiry
  else if (
    clean.includes("تقسيط") ||
    clean.includes("قسط") ||
    clean.includes("شهريا") ||
    clean.includes("مقدم") ||
    clean.includes("كام القسط") ||
    clean.includes("بالفيزا ولا بالمحل") ||
    clean.includes("شروط التقسيط") ||
    clean.includes("بدون فوائد")
  ) {
    intent = "installment_inquiry";
    sentiment = "positive";
    isHighIntentLead = true; // Installment seekers are high-intent buyers
  }
  // 4. Product inquiry (Price, Specs, Stock)
  else if (
    clean.includes("بكام") ||
    clean.includes("السعر") ||
    clean.includes("سعر") ||
    clean.includes("المواصفات") ||
    clean.includes("متاح") ||
    clean.includes("متوفر") ||
    clean.includes("الضمان") ||
    clean.includes("اللون") ||
    clean.includes("الاصلي")
  ) {
    intent = "product_inquiry";
    sentiment = "positive";
  }
  // 5. General greeting
  else if (
    clean.includes("سلام عليكم") ||
    clean.includes("السلام عليكم") ||
    clean.includes("صباح الخير") ||
    clean.includes("مساء الخير") ||
    clean.includes("ازيك") ||
    clean.includes("شكرا") ||
    clean.includes("منورين")
  ) {
    intent = "greeting_or_chat";
    sentiment = "positive";
  }

  return { intent, sentiment, isHighIntentLead };
}

/**
 * Retrieve Knowledge Chunks (RAG)
 */
function queryKnowledgeBase(query = "", adminData = {}, branch = {}) {
  const q = query.toLowerCase();

  const storeName = adminData.siteName || branch.name || "المتجر العصري";
  const address = branch.address || adminData.address || "شارع 9، المعادي، القاهرة";
  const phone = branch.phone || adminData.phone || "01000000000";
  const whatsapp = adminData.whatsapp || phone;
  const shippingCost = adminData.shippingCost || 50;
  const freeOver = adminData.freeShippingOver || 1000;

  if (q.includes("عنوان") || q.includes("مكان") || q.includes("فرع") || q.includes("فين") || q.includes("موقعكم")) {
    return {
      used: true,
      topic: "store_location",
      text: `عنواننا في: ${address}. ومواعيد العمل يومياً من 10 صباحاً حتى 11 مساءً.`
    };
  }

  if (q.includes("تليفون") || q.includes("هاتف") || q.includes("واتس") || q.includes("ارقام") || q.includes("اتواصل")) {
    return {
      used: true,
      topic: "contact_info",
      text: `يمكنك التواصل معنا هاتفياً أو واتساب على الرقم: ${phone} / ${whatsapp}. فريقنا متاح لخدمتك دائماً.`
    };
  }

  if (q.includes("شحن") || q.includes("توصيل") || q.includes("مصاريف") || q.includes("محافظات")) {
    return {
      used: true,
      topic: "shipping_policy",
      text: `نوفر شحن سريع لكافة محافظات مصر خلال 24-48 ساعة. مصاريف الشحن تبدأ من ${shippingCost} ج.م فقط، والشحن مجاني للطلبات فوق ${freeOver} ج.م!`
    };
  }

  if (q.includes("ضمان") || q.includes("استرجاع") || q.includes("استبدال") || q.includes("صيانة")) {
    return {
      used: true,
      topic: "warranty_returns",
      text: `جميع منتجاتنا أصلية 100% مع ضمان رسمي من الوكيل المعتمد، ومهلة 14 يوماً للاستبدال والاسترجاع التام وفق قانون حماية المستهلك.`
    };
  }

  if (q.includes("تقسيط") || q.includes("شروط التقسيط")) {
    return {
      used: true,
      topic: "installment_terms",
      text: `التقسيط مباشر وفوري مع المحل بدون بنوك أو فاليو! الأوراق المطلوبة فقط: صورة بطاقة الرقم القومي لك وللضامن وإيصال مرافق، والاستلام فوري.`
    };
  }

  return { used: false, topic: "general", text: "" };
}

/**
 * Formulate Smart Human-like Grounded Reply
 */
function formulateSmartReply({
  senderName = "يا فندم",
  intent = "general_inquiry",
  content = "",
  extractedPhone = "",
  matchedProduct = null,
  ragData = {},
  adminData = {},
  branch = {}
}) {
  const currency = adminData.currency || "ج.م";
  const firstName = senderName.split(" ")[0] || "يا فندم";

  // Case 1: Customer left phone / High-intent purchase lead
  if (extractedPhone || intent === "purchase_lead") {
    const greetings = [
      `أهلاً بحضرتك يا أستاذ ${firstName}! سعداء جداً باهتمامك. 🌟`,
      `أهلاً وسهلاً بك أستاذ ${firstName}! تشرفنا بطلبك وذوقك الراقي. 💐`,
      `يا هلا بيك أستاذ ${firstName}! طلبك في عين الاعتبار فوراً.`
    ];
    const greeting = greetings[Math.floor(Math.random() * greetings.length)];

    let body = "";
    if (extractedPhone) {
      body = `تم تسجيل رقم هاتفك بنجاح (${extractedPhone}). سيتواصل معك أحد مسؤولي خدمة العملاء والمبيعات هاتفياً في أقرب وقت لتأكيد حجز طلبك والإجابة على أي استفسار. 📞`;
    } else {
      body = `يسعدنا جداً خدمتك! يرجى ترك رقم هاتفك هنا أو في رسائل الخاص وسنتواصل معك فوراً لتأكيد طلبك وتجهيز الشحن لحضرتك. 📩`;
    }

    if (matchedProduct && matchedProduct.price > 0) {
      body += `\n(بخصوص المنتج: ${matchedProduct.name} - السعر الحالي: ${matchedProduct.price.toLocaleString()} ${currency}).`;
    }

    return `${greeting}\n${body}`;
  }

  // Case 2: Installment Inquiry
  if (intent === "installment_inquiry") {
    let installmentText = "";
    if (matchedProduct && matchedProduct.price > 0) {
      const price = matchedProduct.price;
      const dp = Math.round(price * 0.2); // 20% down payment
      const financed = price - dp;
      const m6 = Math.round((financed / 6) * 100) / 100;
      const m12 = Math.round((financed / 12) * 100) / 100;

      installmentText = `نعم متاح تقسيط مباشر وسريع مع المتجر بدون بنك أو فاليو! 💳\nتفاصيل تقسيط «${matchedProduct.name}»:\n• السعر الإجمالي: ${price.toLocaleString()} ${currency}\n• المقدم يبدأ من: ${dp.toLocaleString()} ${currency}\n• القسط الشهري: حوالي ${m6.toLocaleString()} ${currency} (على 6 شهور) أو ${m12.toLocaleString()} ${currency} (على 12 شهراً).\nالأوراق المطلوبة: صورة البطاقة فقط لك وللضامن!`;
    } else {
      installmentText = `نعم يا فندم متاح لدينا نظام تقسيط مباشر مع المحل بدون فوائد بنكية وبأسهل الإجراءات (صورة البطاقة فقط وضامن)، وبمقدمات تبدأ من 15% إلى 20% وفترات سداد حتى 24 شهراً.`;
    }

    return `أهلاً بك يا أستاذ ${firstName}! 🤝\n${installmentText}\nيسعدنا تواصلك معنا في الخاص أو كتابة رقم هاتفك وسيقوم مسؤول التقسيط بالاتصال بك فوراً للتسهيل عليك. 📩`;
  }

  // Case 3: Product Inquiry (Price, Specs, Stock)
  if (intent === "product_inquiry") {
    if (matchedProduct && matchedProduct.price > 0) {
      const inStock = (matchedProduct.stockCount || 0) > 0;
      return `أهلاً بحضرتك يا أستاذ ${firstName}! ✨\nسعر «${matchedProduct.name}» حالياً هو ${matchedProduct.price.toLocaleString()} ${currency}.\nالحالة: ${
        inStock ? "متوفر حالياً بالمخزن وجاهز للشحن الفوري 📦" : "متاح بالطلب المسبق وسيتوفر قريباً"
      }.\nالمنتج أصلي 100% مع ضمان معتمد. يمكنك إرسال رقمك أو مراسلتنا في الخاص للحجز الفوري! 💬`;
    } else {
      return `أهلاً بك يا فندم! نعم المنتج متوفر بأفضل سعر في السوق مع ضمان رسمي. يسعدنا إرسال التفاصيل الدقيقة والأسعار لحضرتك فوراً في رسائل الخاص 📩`;
    }
  }

  // Case 4: Complaint / Negative
  if (intent === "complaint") {
    return `نعتذر لحضرتك جداً يا أستاذ ${firstName} عن أي إزعاج أو تأخير حدث، رضاكم هو أولويتنا القصوى دائماً. 💐\nيرجى التكرم بإرسال رقم هاتفك أو رقم الطلب في رسالة خاصة، وسيتابع معك مدير خدمة العملاء شخصياً لحل المشكلة فوراً وإرضاء حضرتك تماماً.`;
  }

  // Case 5: General store / RAG inquiry
  if (ragData.used) {
    return `أهلاً بحضرتك يا أستاذ ${firstName}! يسعدنا الرد على استفسارك:\n${ragData.text}\nلأي استفسارات إضافية يسعدنا تواصلك دائماً! 🌟`;
  }

  // Case 6: Polite Greeting / General
  return `أهلاً وسهلاً بك يا أستاذ ${firstName}! تشرفنا بمرورك العطر في صفحتنا. نتمنى لك يوماً سعيداً ومستعدين لأي استفسار أو مساعدة في أي وقت! 🌟`;
}

module.exports = {
  extractPhoneNumber,
  classifyIntentAndSentiment,
  queryKnowledgeBase,
  formulateSmartReply
};
