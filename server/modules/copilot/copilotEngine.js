/**
 * AI Executive Copilot Engine
 * Autonomous ReAct Agent Loop for Multi-Tenant Optics & Retail Store
 * 
 * Features:
 * - Native Tool Calling via DeepSeek (with OpenAI compatibility) & Gemini
 * - Deterministic Intent Fallback (allows local testing without cloud API keys)
 * - Multi-turn tool execution tracing
 * - Transactional safety and audit logging
 */

const axios = require("axios");
const { TOOL_DEFINITIONS, executeCopilotTool } = require("./copilotTools");
const getAdminDataModel = require("../settings/adminDataModel");
const { callUnifiedWithTools, ensureDbAiCredentials } = require("../../core/ai/unifiedLlm");

const COPILOT_SYSTEM_PROMPT = `أنت "المساعد التنفيذي الذكي" (Executive AI Copilot / COO) المتخصص في إدارة وتشغيل مركز البصريات والمتاجر متعددة الفروع.
أنت لست مجرد بوت محادثة، بل تمتلك صلاحيات تشغيلية وأدوات ذكية (Tools) تمكنك من الاستعلام الدقيق عن البيانات وتنفيذ العمليات المصرح بها.

# القواعد الفولاذية في التعامل:
1. **التحري والاستعلام أولاً**: إذا سأل المستخدم عن عميل، منتج، فاتورة، أو معمل، استخدم أداة \`lookupEntity\` للبحث عن الاسم أو الهاتف أو الكود أولاً، ولا تخترع أو تفترض أي معرّف (ID) أو أرقام من خيالك.
2. **البحث الدلالي الذكي للأصناف والبصريات (Semantic Vector Search)**:
   - محرك البحث عن الأصناف يعمل بالمتجهات الدلالية وتشابه جيب التمام (Cosine Similarity)، وبالتالي فإن الكلمات المترادفة في لهجة وتجارة البصريات (مثل: "تشمبر"، "شمبر"، "شنبر"، "إطار"، "فريم"، "شاسيه"، "نظارة") تدل جميعها على قسم وإطارات النظارات (Frames) وستطابق المنتجات تلقائياً حتى لو اختلفت صياغة الاسم في قاعدة البيانات.
   - لا تفترض أبداً عدم وجود أصناف بمجرد اختلاف اللفظ؛ استدعِ \`lookupEntity(product)\` أو \`searchCatalogAndInventory\` بالبحث الدلالي وستحصل على الأصناف المرتبطة بدقة.
3. **الاستعلام متعدد القفزات (Multi-Hop)**:
   - إذا سأل المدير: "عايز أشوف سجل فحص النظر والطلبات للعميل فلان"، ابحث عنه بـ \`lookupEntity\` أولاً ثم استدعِ \`getEntityRelations\` لجلب كشوفات النظر وطلباته.
   - إذا سأل المدير: "إيه معدل الإرجاع وهل الصنف ده عليه مشاكل؟"، استدعِ \`lookupEntity\` لمعرفة الصنف، ثم \`getAggregatedMetrics\` أو \`getEntityRelations(scrapRecords)\` لمعرفة أسباب التالف.
4. **الدقة المالية وحصص الشركاء (Partners & Drawings)**:
   - للشركاء وأصحاب المحل، استخدم \`listPartnersLedger\` لمعرفة نسب الحصص والمسحوبات، واستخدم \`recordPartnerWithdrawal\` لتسجيل أي مسحوبات شخصية.
5. **طلبات التوريد، النواقص، درج العدسات (Lens Matrix Drawer)، روابط المتابعة، والواتساب للموردين**:
   - تمتلك صلاحية كاملة وأدوات مدمجة (\`getLowStockAndSuppliers\` و \`createSupplyOrderAndWhatsApp\`) لفحص الأصناف الناقصة ونواقص درج/مصفوفة مقاسات العدسات (\`SPH x CYL\`) وإنشاء طلبات التوريد الفعلية (Purchase Orders & Waterfall Supply Requests) وتوليد رابط متابعة وتأكيد التوريد المباشر (\`trackingPortalUrl\`) وإرسال رسالة الواتساب المباشرة للمورد (\`whatsappDirectUrl\`).
   - **قاعدة مهمة جداً بخصوص درج العدسات (Lens Matrix Drawer)**:
     - العدسات الطبية واللاصقة تُدار بنظام المصفوفة (\`opticsSpecs.matrixStock\`) حيث يكون الرصيد الإجمالي للصنف هو مجموع كل العيون/الأدراج (مثلاً 215 عدسة)، لكن داخل الدرج توجد مقاسات \`SPH / CYL\` نافدة (رصيدها 0) أو حرجة (رصيدها 1 أو 2 <= الحد الحرج 3).
     - لذلك إذا سأل المستخدم عن **"العدسات الناقصة في الدرج"** أو **"طلب توريد للعدسات الناقصة"**، مرر دائماً \`productType: "lens"\` و \`onlyMatrixDepleted: true\` إلى أداة \`getLowStockAndSuppliers\` أو استدعِ مباشرةً \`createSupplyOrderAndWhatsApp({ productType: "lens", onlyMatrixDepleted: true })\`، ولا تخلط الشنابر/الإطارات مع العدسات!
   - إذا طلب المستخدم إصدار أو إرسال طلب توريد (سواء للنواقص العامة أو لنواقص درج العدسات)، نفّذ فوراً أداة \`createSupplyOrderAndWhatsApp\` واعرض في ردك:
     1. كود أمر التوريد (\`reorderCode\`) وكود تتبع التوريد (\`waterfallRequestCode\`) وبيانات المورد المختص.
     2. جدول الأصناف/العدسات المطلوبة، وعدد المقاسات الناقصة في الدرج وأمثلة عليها (\`SPH / CYL\`)، والكميات المطلوبة والتكلفة التقديرية.
     3. رابط متابعة وتأكيد التوريد بصيغة رابط قابل للنقر: \`[🔗 فتح رابط متابعة وتأكيد التوريد المباشر](trackingPortalUrl)\`.
     4. رابط إرسال رسالة الواتساب الجاهزة للمورد بصيغة رابط قابل للنقر: \`[📱 إرسال طلب التوريد عبر واتساب للمورد](whatsappDirectUrl)\`.
6. **التأكيد والاستعلام الإنساني (Human-in-the-Loop Confirmation)**:
   - أي عملية بيع مباشرة، أو تسجيل مصروف كبير (أكثر من 1000 جنيه)، أو مسحوبات شركاء، تتطلب إذن وتأكيد المستخدم (\`confirmed: true\`). إذا لم يؤكد المستخدم صراحة، اعرض التفاصيل واطلب منه التأكيد أولاً.
7. **أسلوب الرد**:
   - تحدث بلغة عربية مهنية واضحة ومنظمة تدل على الفطنة الإدارية.
   - استخدم التنسيق النقطي والإيموجي المناسب لتبسيط القراءة التنفيذية (📊، 👓، 💰، ✅، ⚠️).
   - بعد تنفيذ أي إجراء كتابي (تسجيل مصروف، أمر شغل، بيع، طلب توريد)، اعرض رقم التأكيد والروابط المباشرة بوضوح.`;

/**
 * Resolves available AI keys and config for tenant
 */
async function resolveAiConfig(subdomain) {
  const adminData = await ensureDbAiCredentials(subdomain);

  const deepseekKey = (
    adminData.AI_API_KEY ||
    adminData.aiApiKey ||
    process.env.AI_API_KEY ||
    process.env.DEEPSEEK_API_KEY ||
    ""
  ).trim();

  const deepseekBaseUrl = (
    adminData.AI_BASE_URL ||
    process.env.AI_BASE_URL ||
    "https://api.deepseek.com"
  ).trim().replace(/\/+$/, "");

  const deepseekModel = (
    adminData.AI_MODEL ||
    process.env.AI_MODEL ||
    "deepseek-chat"
  ).trim();

  const geminiKey = (
    adminData.GEMINI_API_KEY ||
    process.env.GEMINI_API_KEY ||
    adminData.geminiApiKey ||
    ""
  ).trim();

  return {
    deepseekKey,
    deepseekBaseUrl,
    deepseekModel,
    geminiKey
  };
}

/**
 * Deterministic Fallback Responder when no API Key is configured or connectivity is offline.
 * Implements regex-based tool triggering to ensure 100% demo & dev uptime!
 */
async function runDeterministicFallback(userMessage, context) {
  const query = userMessage.trim();
  const traces = [];

  // 1. Treasury / Finance request
  if (/خزينة|مالية|فلوس|ايراد|إيراد|أرباح|ارباح|كاش|دخل|مصروفات/i.test(query)) {
    traces.push({
      step: 1,
      tool: "getTreasurySummary",
      args: { periodDays: 7 },
      status: "success"
    });
    const summary = await executeCopilotTool("getTreasurySummary", { periodDays: 7 }, context);
    return {
      reply: `📊 **تقرير الموقف المالي والخزينة المباشر (آخر 7 أيام):**\n\n` +
        `• 💰 **إجمالي الإيرادات المسجلة:** ${summary.totalRevenueEGP?.toLocaleString()} ج.م\n` +
        `• 💵 **المبيعات النقدية (Cash):** ${summary.cashSalesEGP?.toLocaleString()} ج.م\n` +
        `• 💳 **المبيعات الإلكترونية (Card/Wallet):** ${summary.cardSalesEGP?.toLocaleString()} ج.م\n` +
        `• 🔄 **الأقساط المحصلة:** ${summary.collectedInstallmentsEGP?.toLocaleString()} ج.م\n` +
        `• 📉 **المصروفات التشغيلية:** ${summary.totalExpensesEGP?.toLocaleString()} ج.م\n` +
        `• 🟢 **صافي النقدية والسيولة التشغيلية:** ${summary.netOperatingCashEGP?.toLocaleString()} ج.م\n` +
        `• ⏳ **مستحقات آجلة قيد التحصيل:** ${summary.pendingReceivablesEGP?.toLocaleString()} ج.م\n\n` +
        `💡 *ملاحظة:* المساعد التنفيذي يعمل بالوضع الذري الداخلي لعدم تعيين مفتاح DeepSeek API في إعدادات المطور.`,
      traces
    };
  }

  // 2. Metrics & Return rate
  if (/معدل|نسبة|مرتجع|تالف|هالك|أداء|مبيعات|أقساط/i.test(query)) {
    traces.push({
      step: 1,
      tool: "getAggregatedMetrics",
      args: { periodDays: 30, targetType: "global" },
      status: "success"
    });
    const metrics = await executeCopilotTool("getAggregatedMetrics", { periodDays: 30, targetType: "global" }, context);
    return {
      reply: `📈 **المؤشرات التشغيلية ومعدلات الجودة (آخر 30 يوماً):**\n\n` +
        `• 📦 **إجمالي الطلبات:** ${metrics.totalOrders} طلب (${metrics.totalSoldUnits} قطعة مباعة)\n` +
        `• 💵 **إجمالي المبيعات:** ${metrics.totalRevenueEGP?.toLocaleString()} ج.م\n` +
        `• 📊 **هامش الربح الإجمالي:** ${metrics.profitMargin} (صافي ربح ${metrics.grossProfitEGP?.toLocaleString()} ج.م)\n` +
        `• 🔄 **معدل الإرجاع العام (Return Rate):** ${metrics.returnRate}\n` +
        `• ⚠️ **الوحدات التالفة والهالكة:** ${metrics.totalScrappedUnits} قطعة (خسارة ${metrics.totalScrapLossEGP?.toLocaleString()} ج.م)\n` +
        `• ⏱️ **معدل سداد الأقساط بمواعيدها:** ${metrics.onTimeInstallmentRate}\n\n` +
        `جاهز لإجراء أي فحص تفصيلي لعميل أو صنف محدد!`,
      traces
    };
  }

  // 3. Partners & Drawings query (مسحوبات الشركاء وأصحاب المحل)
  if (/شريك|شركاء|مسحوبات الشريك|مسحوبات الشركاء|أصحاب المحل|حصص الشركاء/i.test(query)) {
    traces.push({
      step: 1,
      tool: "listPartnersLedger",
      args: {},
      status: "success"
    });
    const partnersData = await executeCopilotTool("listPartnersLedger", {}, context);
    const partnersList = partnersData.partners || [];

    if (partnersList.length === 0) {
      return {
        reply: `👥 **سجل الشركاء وأصحاب المحل:**\n\nلم يتم تسجيل أي شركاء في النظام بعد.\n💡 يمكنك إضافة الشركاء وتحديد حصصهم ورأس المال المكتتب من تبويب (الخزينة والمالية > المصروفات والتشغيل > مسحوبات الشركاء).`,
        traces
      };
    }

    const partnerRows = partnersList.map((p) =>
      `• 👤 **${p.name}** (حصة: ${p.sharePercentage}%) — رأس المال: ${Number(p.initialCapital || 0).toLocaleString()} ج.م | إجمالي المسحوبات: **${Number(p.liveWithdrawals || 0).toLocaleString()} ج.م** (${p.statusNote})`
    ).join("\n");

    return {
      reply: `👥 **سجل حصص ومسحوبات الشركاء المباشر:**\n\n` +
        `• 💼 **إجمالي رأس المال المكتتب:** ${Number(partnersData.summary?.totalCapital || 0).toLocaleString()} ج.م\n` +
        `• 💸 **إجمالي المسحوبات المسحوبة للشركاء:** ${Number(partnersData.summary?.totalWithdrawnAll || 0).toLocaleString()} ج.م\n\n` +
        `📋 **موقف كل شريك وتطابق المسحوبات مع الحصص:**\n${partnerRows}\n\n` +
        `💡 يمكنك أن تطلب مني: *"سجل مسحوبات للشريك فلان بمبلغ كذا"* وسأقوم بإعداد القيد وطلب التأكيد.`,
      traces
    };
  }

  // 3.5 Procurement, Low Stock, Lens Drawer, Supply Order, Tracking Link & WhatsApp to Supplier
  if (/توريد|نواقص|الناقصه|الناقصة|مورد|موردين|واتس|واتساب|درج العدسات|درج/i.test(query)) {
    const wantsOrder = /اعمل|انشئ|أنشئ|اطلب|ابعت|إرسال|ارسال|لينك|رابط|واتس|عايز ابعت/i.test(query);
    const isLensQuery = /عدس|درج|مصفوف/i.test(query);
    const toolArgs = isLensQuery
      ? { productType: "lens", onlyMatrixDepleted: true, defaultQuantity: 15 }
      : { defaultQuantity: 15 };

    if (wantsOrder) {
      traces.push({
        step: 1,
        tool: "createSupplyOrderAndWhatsApp",
        args: toolArgs,
        status: "success"
      });
      const supOrder = await executeCopilotTool("createSupplyOrderAndWhatsApp", toolArgs, context);
      if (supOrder && supOrder.success) {
        const itemsRows = (supOrder.orderedItems || [])
          .map(
            (it, idx) =>
              `| ${idx + 1} | ${it.name} | ${it.depletedPowersSummary || `${it.depletedCellsCount || 0} مقاس`} | ${it.currentStock} | ${it.quantity} وحدة | ${Number(it.lineTotal || 0).toLocaleString()} ج.م |`
          )
          .join("\n");

        return {
          reply:
            `✅ **تم إنشاء وإصدار طلب التوريد ${isLensQuery ? "لجميع العدسات الناقصة في الدرج" : "للنواقص"} بنجاح!**\n\n` +
            `• 🔖 **كود أمر التوريد:** \`${supOrder.reorderCode}\` (كود التتبع التسلسلي: \`${supOrder.waterfallRequestCode}\`)\n` +
            `• 🏢 **المورد الموجه إليه الطلب:** **${supOrder.supplier?.name}** (${supOrder.supplier?.specialty || "مورد بصريات معتمد"})\n` +
            `• 📞 **هاتف / واتساب المورد:** \`${supOrder.supplier?.phone}\`\n` +
            `• 📦 **إجمالي الكميات المطلوبة:** **${supOrder.totalUnits} وحدة** (${supOrder.itemsCount} أصناف) — بتكلفة تقديرية **${Number(supOrder.totalEstimatedCostEGP || 0).toLocaleString()} ج.م**\n\n` +
            `📋 **جدول الأصناف ومقاسات الدرج الناقصة المدرجة في طلب التوريد:**\n` +
            `| # | الصنف | مقاسات الدرج المطلوبة (SPH/CYL) | الرصيد الإجمالي | الكمية المطلوبة | التكلفة التقديرية |\n` +
            `|---|---|---|---|---|---|\n` +
            `${itemsRows}\n\n` +
            `🔗 **روابط المتابعة والإرسال الفوري:**\n` +
            `• [🔗 فتح رابط متابعة وتأكيد التوريد المباشر (${supOrder.waterfallRequestCode})](${supOrder.trackingPortalUrl})\n` +
            `• [📱 إرسال طلب التوريد عبر واتساب للمورد (${supOrder.supplier?.name})](${supOrder.whatsappDirectUrl})\n` +
            `• [📦 فتح لوحة إدارة التوريدات والموردين](${supOrder.adminProcurementUrl})`,
          traces
        };
      }
    } else {
      const getArgs = isLensQuery
        ? { threshold: 8, productType: "lens", onlyMatrixDepleted: true }
        : { threshold: 8 };
      traces.push({
        step: 1,
        tool: "getLowStockAndSuppliers",
        args: getArgs,
        status: "success"
      });
      const lowRes = await executeCopilotTool("getLowStockAndSuppliers", getArgs, context);
      const rows = (lowRes.lowStockItems || [])
        .map(
          (it, idx) =>
            `• **${idx + 1}. ${it.name}** — الرصيد الإجمالي: **${it.currentStock}** | مقاسات ناقصة/حرجة بالدرج: **${it.totalDepletedMatrixCellsCount || 0} مقاس** (${it.outOfStockMatrixCellsCount || 0} نافد [0] + ${it.criticalMatrixCellsCount || 0} حرج [1-2]) | الكمية المقترحة للتوريد: **${it.suggestedOrderQty}** (المورد: ${it.supplierName})`
        )
        .join("\n");
      return {
        reply:
          `📦 **تقرير الأصناف ومقاسات درج العدسات الناقصة والموردين المعتمدين:**\n\n` +
          `${rows}\n\n` +
          `🏢 **المورد الأول المعتمد:** **${lowRes.firstSupplier?.name || "—"}** (\`${lowRes.firstSupplier?.phone || ""}\`)\n\n` +
          `💡 يمكنك القول: *"عايز ابعت طلب توريد لكل العدسات اللي ناقصة في الدرج لأي نوع عدسات"* لتنفيذ الطلب وتوليد الروابط فوراً.`,
        traces
      };
    }
  }

  // 4. Products, Frames, Lenses & Inventory Semantic Query (تشمبر / إطار / فريم / نظارات / عدسات / مخزون)
  if (/تشمبر|شمبر|شنبر|إطار|اطار|فريم|فريمات|نظارة|نظارات|عدسة|عدسات|شمسية|شمسيات|صنف|منتج|بضاعة|مخزون|سعر|اسعار/i.test(query)) {
    let cleanProdQuery = query
      .replace(/ابحث عن|عايز|في|كام|مبيعات|أداء|اسعار|أسعار|سعر|منتج|صنف|مخزون|عندنا|متاح|هل يوجد|عاوز اشوف|وريني/gi, "")
      .trim();
    if (!cleanProdQuery) cleanProdQuery = query.trim();

    traces.push({
      step: 1,
      tool: "lookupEntity",
      args: { entityType: "product", query: cleanProdQuery, limit: 5 },
      status: "success"
    });

    const searchRes = await executeCopilotTool("lookupEntity", { entityType: "product", query: cleanProdQuery, limit: 5 }, context);
    const productsList = searchRes.results || [];

    if (productsList.length > 0) {
      const isSalesQuery = /اتباع|مبيعات|ارباح|أرباح|كام بيع|معدل بيع|بيعت/i.test(query);
      let salesSection = "";

      if (isSalesQuery) {
        const top = productsList[0];
        traces.push({
          step: 2,
          tool: "getAggregatedMetrics",
          args: { targetType: "product", targetId: top.id, periodDays: 30 },
          status: "success"
        });
        const perf = await executeCopilotTool("getAggregatedMetrics", { targetType: "product", targetId: top.id, periodDays: 30 }, context);
        salesSection = `\n📊 **تحليل مبيعات الصنف الأكثر تطابقاً (${top.name}):**\n` +
          `• 🛍️ **الكمية المباعة (آخر 30 يوماً):** ${perf.unitsSold || 0} قطعة\n` +
          `• 💵 **إجمالي إيراد المبيعات:** ${Number(perf.salesRevenueEGP || 0).toLocaleString()} ج.م\n` +
          `• 🔄 **معدل الإرجاع:** ${perf.returnRate || "0%"}\n` +
          `• ⚠️ **الوحدات التالفة/الهدر:** ${perf.scrapUnits || 0} قطعة (${perf.defectRate || "0%"})\n`;
      }

      const prodCards = productsList.map((p, idx) => {
        const matchNote = p.similarityScore
          ? ` [تطابق دلالي: ${Math.round(p.similarityScore * 100)}%]`
          : "";
        return `${idx + 1}. 👓 **${p.name}**${matchNote}\n` +
          `   • 🏷️ الماركة والنوع: ${p.brand || "—"} (${p.type || "إطار"})\n` +
          `   • 💰 سعر البيع: **${Number(p.sellingPrice || 0).toLocaleString()} ج.م** (التكلفة: ${Number(p.costPrice || 0).toLocaleString()} ج.م)\n` +
          `   • 📦 الرصيد المتاح: **${p.currentStock || 0} قطعة** ${p.currentStock <= 2 ? "⚠️ (مخزون منخفض)" : "✅"}`;
      }).join("\n\n");

      return {
        reply: `🔍 **نتائج البحث الدلالي الذكي (Semantic Vector Search):**\n\n` +
          `${prodCards}\n` +
          `${salesSection}\n` +
          `💡 يمكنك طلب فحص تفصيلي أو تنفيذ عملية بيع سريعة (POS) لأي صنف بكتابة: *"اعمل بيع سريع للصنف [اسم المنتج]"*.`,
        traces
      };
    }
  }

  // 5. Customer query (phone or name)
  const phoneMatch = query.match(/01[0-9]{9}/);
  if (phoneMatch || /^(عميل|زبون|كشف نظر|فحص نظر)/i.test(query) || (/(عميل|زبون)/i.test(query) && !/(تشمبر|شمبر|شنبر|فريم|إطار|اطار|نظارة|عدسة)/i.test(query))) {
    const qStr = phoneMatch ? phoneMatch[0] : query.replace(/عميل|ابحث عن|فين|بيانات/gi, "").trim();
    traces.push({
      step: 1,
      tool: "lookupEntity",
      args: { entityType: "customer", query: qStr || "010" },
      status: "success"
    });
    const searchRes = await executeCopilotTool("lookupEntity", { entityType: "customer", query: qStr || "010" }, context);
    if (searchRes.results && searchRes.results.length > 0) {
      const top = searchRes.results[0];
      traces.push({
        step: 2,
        tool: "getEntityRelations",
        args: { entityType: "customer", entityId: top.id, relation: "orders" },
        status: "success"
      });
      const relations = await executeCopilotTool("getEntityRelations", { entityType: "customer", entityId: top.id, relation: "orders" }, context);
      return {
        reply: `👤 **ملف العميل: ${top.name}**\n\n` +
          `• 📱 **الهاتف:** \`${top.phone}\`\n` +
          `• 📍 **المدينة:** ${top.city}\n` +
          `• 🩺 **كشوفات النظر المسجلة:** ${top.prescriptionsCount} فحص\n` +
          `• 🛍️ **عدد الطلبات:** ${relations.ordersCount || 0} طلب\n\n` +
          (relations.orders && relations.orders.length > 0
            ? `📋 **آخر طلب للعميل:** رقم \`${relations.orders[0].orderId}\` بقيمة ${relations.orders[0].total} ج.م (الحالة: ${relations.orders[0].status})`
            : `لم يتم تسجيل طلبات سابقة لهذا العميل بعد.`),
        traces
      };
    }
  }

  // Generic guidance
  return {
    reply: `مرحباً بك! أنا **المساعد التنفيذي الذكي (AI Copilot)** لإدارة المركز والمتجر. 🤖\n\n` +
      `يمكنني مساعدتك في كافة العمليات والتحليلات:\n` +
      `1. 📊 **استعراض المؤشرات المالية والخزينة ومعدلات الإرجاع والتالف**\n` +
      `2. 🔍 **البحث الفوري عن بيانات العملاء وتاريخ كشوفات النظر وأوامر المعمل**\n` +
      `3. 💸 **تسجيل مصروف تشغيلي مباشرة في الخزينة والرقابة**\n` +
      `4. 🛒 **تنفيذ عمليات بيع مباشرة (POS) وإصدار أوامر شغل للورش والمعامل**\n\n` +
      `💡 *لتفعيل كامل قدرات الذكاء التوليدي التفاعلي، يمكنك إدخال مفتاح DeepSeek API أو Gemini في تبويب (إعدادات المتجر / بوابة المطور).*`,
    traces
  };
}

/**
 * Main Copilot Chat Entrypoint
 * Executes the autonomous ReAct tool loop
 */
async function chatWithCopilot({ subdomain, user, message, history = [], confirmedAction = null }) {
  const context = { subdomain, user };
  const traces = [];

  // 1. Direct Execution if action has been explicitly confirmed by user
  if (confirmedAction && confirmedAction.action) {
    const finalRes = await executeCopilotTool(
      confirmedAction.action,
      { ...confirmedAction.payload, confirmed: true },
      context
    );

    if (finalRes.error) {
      return {
        reply: `⚠️ **فشل تنفيذ العملية المعتمدة:** ${finalRes.error}`,
        traces: [{
          step: 1,
          tool: confirmedAction.action,
          args: confirmedAction.payload,
          status: "error",
          resultSummary: finalRes.error
        }]
      };
    }

    return {
      reply: `✅ **تم تأكيد وتنفيذ العملية واعتمادها بنجاح!**\n\n${finalRes.message || "تم تسجيل القيد وإدراجه في الرقابة والخزينة بنجاح."}`,
      confirmed: true,
      traces: [
        {
          step: 1,
          tool: confirmedAction.action,
          args: confirmedAction.payload,
          status: "success",
          resultSummary: finalRes.message || "تم الاعتماد والتنفيذ"
        }
      ]
    };
  }

  if (!message || typeof message !== "string") {
    throw new Error("رسالة المستخدم مطلوبة");
  }

  const aiConfig = await resolveAiConfig(subdomain);

  // If no LLM keys configured, execute our deterministic fallback
  if (!aiConfig.deepseekKey && !aiConfig.geminiKey) {
    return await runDeterministicFallback(message, context);
  }

  // Use Unified Tool-Calling Engine (Primary Configured Model e.g. DeepSeek -> Default Fallback Gemini)
  if (aiConfig.deepseekKey || aiConfig.geminiKey) {
    try {
      const messages = [
        { role: "system", content: COPILOT_SYSTEM_PROMPT }
      ];

      // Format previous history safely (max 6 messages to stay lightweight)
      const recentHistory = Array.isArray(history) ? history.slice(-6) : [];
      recentHistory.forEach((h) => {
        if (h.role && h.content) {
          messages.push({
            role: h.role === "assistant" ? "assistant" : "user",
            content: String(h.content)
          });
        }
      });

      // Append current user message
      messages.push({ role: "user", content: message.trim() });

      let currentTurn = 0;
      const MAX_TURNS = 5;

      while (currentTurn < MAX_TURNS) {
        currentTurn++;

        const llmRes = await callUnifiedWithTools({
          subdomain,
          messages,
          tools: TOOL_DEFINITIONS,
          temperature: 0.2,
          timeout: 40000
        });

        const resMessage = llmRes?.message;

        if (!resMessage) {
          throw new Error("استجابة نموذج الذكاء الاصطناعي فارغة");
        }

        // Check if model called tools
        if (resMessage.tool_calls && resMessage.tool_calls.length > 0) {
          // Append assistant message containing tool calls
          messages.push(resMessage);

          for (const tc of resMessage.tool_calls) {
            const toolName = tc.function.name;
            let toolArgs = {};
            try {
              toolArgs = JSON.parse(tc.function.arguments || "{}");
            } catch (pErr) {
              toolArgs = {};
            }

            // Execute the tool
            const toolResult = await executeCopilotTool(toolName, toolArgs, context);

            // Record trace for frontend badge display
            traces.push({
              step: currentTurn,
              tool: toolName,
              args: toolArgs,
              status: toolResult?.error ? "error" : "success",
              resultSummary: toolResult?.message || toolResult?.count !== undefined ? `${toolResult?.count} نتائج` : "تم التنفيذ"
            });

            // Human-in-the-Loop Confirmation Check:
            if (toolResult?.requiresConfirmation) {
              return {
                reply: `⚠️ **مطلوب اعتماد وتأكيد العملية قبل التنفيذ:**\n\n${toolResult.pendingAction?.details || "يرجى مراجعة تفاصيل العملية وتأكيدها."}`,
                requiresConfirmation: true,
                pendingAction: toolResult.pendingAction,
                clarification: toolResult.clarification,
                traces,
                turns: currentTurn
              };
            }

            // Append tool response
            messages.push({
              role: "tool",
              tool_call_id: tc.id,
              name: toolName,
              content: JSON.stringify(toolResult)
            });
          }

          // Continue loop to let the model inspect tool results
          continue;
        }

        // Direct final reply reached
        return {
          reply: resMessage.content || "تمت معالجة طلبك بنجاح.",
          traces,
          turns: currentTurn
        };
      }

      // Max turns reached, return last message content if available
      return {
        reply: "تم تنفيذ الخطوات المطلوبة والتحقق من البيانات.",
        traces,
        turns: currentTurn
      };
    } catch (llmErr) {
      console.warn("[COPILOT_UNIFIED_LLM_FALLBACK]:", llmErr.response?.data || llmErr.message);
      // Fallback to deterministic handler so user experience is never broken
      const fb = await runDeterministicFallback(message, context);
      fb.traces = [...traces, ...fb.traces];
      return fb;
    }
  }

  return await runDeterministicFallback(message, context);
}

module.exports = {
  chatWithCopilot,
  resolveAiConfig,
  COPILOT_SYSTEM_PROMPT
};
