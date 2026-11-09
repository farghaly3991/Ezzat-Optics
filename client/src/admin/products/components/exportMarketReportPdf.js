/**
 * Professional printable PDF generator for AI Market Competitor Comparison Reports
 */
export function exportMarketReportPdf(analysis, config, showToast) {
  if (!analysis || !analysis.product) {
    if (showToast) showToast("لا توجد بيانات تقرير جاهزة للطباعة", "error");
    return;
  }

  const storeTitle = config?.siteName || "المتجر الإلكتروني";
  const currency = config?.currency || "ج.م";
  const generatedDate = analysis.generatedAt
    ? new Date(analysis.generatedAt).toLocaleString("ar-EG")
    : new Date().toLocaleString("ar-EG");

  const prod = analysis.product || {};
  const overview = analysis.marketOverview || {};
  const strategic = analysis.strategicAnalysis || {};
  const competitors = Array.isArray(analysis.competitors) ? analysis.competitors : [];

  const escapeHtml = (str) =>
    String(str || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");

  const specsStr = Object.entries(prod.specs || {})
    .map(([k, v]) => `<strong>${escapeHtml(k)}:</strong> ${escapeHtml(v)}`)
    .join(" &nbsp;|&nbsp; ");

  const competitorsRows = competitors
    .map((c, i) => {
      const isCheaper = c.price < prod.price;
      const diffLabel =
        c.price === prod.price
          ? "مطابق"
          : isCheaper
          ? `أرخص بـ ${(prod.price - c.price).toLocaleString()} ${currency}`
          : `أغلى بـ ${(c.price - prod.price).toLocaleString()} ${currency}`;
      const diffColor = isCheaper ? "#dc2626" : "#059669";

      const simColor =
        c.similarityScore >= 90
          ? "#059669"
          : c.similarityScore >= 75
          ? "#2563eb"
          : "#d97706";

      return `
        <tr>
          <td style="text-align: center; font-weight: bold;">${i + 1}</td>
          <td>
            <div style="font-weight: 700; color: #1e293b;">${escapeHtml(c.title)}</div>
            ${
              c.matchingSpecs?.length
                ? `<div style="font-size: 10px; color: #64748b; margin-top: 2px;">تطابق: ${escapeHtml(
                    c.matchingSpecs.slice(0, 2).join("، ")
                  )}</div>`
                : ""
            }
          </td>
          <td style="font-weight: 700; color: #4338ca;">${escapeHtml(c.storeName)}</td>
          <td style="font-weight: 800; font-size: 13px;">${c.price.toLocaleString()} ${currency}</td>
          <td style="font-weight: 700; color: ${diffColor}; font-size: 11px;">${diffLabel}</td>
          <td style="text-align: center;">
            <span style="background: ${simColor}18; color: ${simColor}; padding: 3px 8px; border-radius: 6px; font-weight: 800; font-size: 11px; border: 1px solid ${simColor}30;">
              ${c.similarityScore}%
            </span>
          </td>
        </tr>
      `;
    })
    .join("");

  const advantagesHtml = (strategic.keyAdvantages || [])
    .map((adv) => `<li style="margin-bottom: 4px;">${escapeHtml(adv)}</li>`)
    .join("");

  const vulnerabilitiesHtml = (strategic.keyVulnerabilities || [])
    .map((v) => `<li style="margin-bottom: 4px;">${escapeHtml(v)}</li>`)
    .join("");

  const tipsHtml = (strategic.actionableTips || [])
    .map((tip) => `<li style="margin-bottom: 6px; font-weight: 700;">${escapeHtml(tip)}</li>`)
    .join("");

  const htmlDoc = `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
<meta charset="UTF-8" />
<title>تقرير دراسة ومقارنة أسعار السوق - ${escapeHtml(prod.name)}</title>
<link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800;900&display=swap" rel="stylesheet">
<style>
  @page {
    size: A4;
    margin: 15mm;
  }
  * {
    box-sizing: border-box;
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
  }
  body {
    font-family: 'Cairo', sans-serif;
    background: #ffffff;
    color: #0f172a;
    margin: 0;
    padding: 0;
    font-size: 12px;
    line-height: 1.5;
  }
  .header {
    border-bottom: 2px solid #e2e8f0;
    padding-bottom: 14px;
    margin-bottom: 16px;
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
  }
  .brand-title {
    font-size: 20px;
    font-weight: 900;
    color: #1e1b4b;
    margin: 0;
  }
  .report-tagline {
    font-size: 12px;
    color: #4f46e5;
    font-weight: 700;
    margin-top: 2px;
  }
  .meta-box {
    text-align: left;
    font-size: 10px;
    color: #64748b;
  }
  .product-hero {
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: 10px;
    padding: 12px 16px;
    margin-bottom: 16px;
  }
  .hero-title {
    font-size: 15px;
    font-weight: 800;
    color: #0f172a;
    margin: 0 0 6px 0;
  }
  .hero-details {
    display: flex;
    gap: 20px;
    font-size: 11px;
    color: #334155;
    margin-bottom: 4px;
  }
  .overview-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 10px;
    margin-bottom: 18px;
  }
  .stat-card {
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    padding: 10px;
    text-align: center;
    background: #faf5ff;
  }
  .stat-val {
    font-size: 16px;
    font-weight: 900;
    color: #4338ca;
    margin-top: 4px;
  }
  .stat-label {
    font-size: 10px;
    color: #64748b;
    font-weight: 700;
  }
  table {
    width: 100%;
    border-collapse: collapse;
    margin-bottom: 18px;
    font-size: 11px;
  }
  th {
    background: #f1f5f9;
    color: #334155;
    padding: 8px 10px;
    text-align: right;
    font-weight: 800;
    border-bottom: 2px solid #cbd5e1;
  }
  td {
    padding: 8px 10px;
    border-bottom: 1px solid #e2e8f0;
  }
  .recommendation-box {
    background: linear-gradient(135deg, #f0fdf4 0%, #e0f2fe 100%);
    border: 1px solid #bbf7d0;
    border-radius: 10px;
    padding: 14px 18px;
    margin-bottom: 16px;
  }
  .rec-title {
    font-size: 14px;
    font-weight: 900;
    color: #166534;
    margin-bottom: 6px;
  }
  .insights-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
    margin-bottom: 16px;
  }
  .box {
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    padding: 10px 12px;
    background: #ffffff;
  }
  .box-title {
    font-size: 12px;
    font-weight: 800;
    margin-bottom: 6px;
  }
  ul {
    margin: 0;
    padding-right: 18px;
    font-size: 11px;
    color: #334155;
  }
  .footer {
    border-top: 1px solid #e2e8f0;
    padding-top: 8px;
    text-align: center;
    font-size: 10px;
    color: #94a3b8;
    margin-top: 20px;
  }
</style>
</head>
<body>

  <div class="header">
    <div>
      <h1 class="brand-title">${escapeHtml(storeTitle)}</h1>
      <div class="report-tagline">تقرير تحليل ومقارنة أسعار السوق بالذكاء الاصطناعي (Market Intelligence)</div>
    </div>
    <div class="meta-box">
      <div><strong>تاريخ التقرير:</strong> ${generatedDate}</div>
      <div><strong>المحرك:</strong> AI Market Intelligence Engine</div>
      <div><strong>نطاق السوق:</strong> السوق المصري والإقليمي (EGP)</div>
    </div>
  </div>

  <div class="product-hero">
    <div class="hero-title">📦 المنتج المستهدف: ${escapeHtml(prod.name)}</div>
    <div class="hero-details">
      <div><strong>القسم:</strong> ${escapeHtml(prod.category)}</div>
      <div><strong>سعرك الحالي:</strong> <span style="font-weight: 900; color: #1e1b4b;">${Number(prod.price).toLocaleString()} ${currency}</span></div>
      ${prod.costPrice ? `<div><strong>سعر التكلفة:</strong> ${Number(prod.costPrice).toLocaleString()} ${currency}</div>` : ""}
      <div><strong>الموقف التنافسي:</strong> <span style="color: #4f46e5; font-weight: 800;">${escapeHtml(overview.marketPosition || "متوازن")}</span></div>
    </div>
    ${specsStr ? `<div style="font-size: 10px; color: #64748b; margin-top: 4px; border-top: 1px dashed #cbd5e1; padding-top: 4px;">${specsStr}</div>` : ""}
  </div>

  <div class="overview-grid">
    <div class="stat-card">
      <div class="stat-label">متوسط سعر السوق</div>
      <div class="stat-val">${Number(overview.averagePrice || 0).toLocaleString()} ${currency}</div>
    </div>
    <div class="stat-card" style="background: #f0fdf4;">
      <div class="stat-label" style="color: #166534;">أقل سعر منافس</div>
      <div class="stat-val" style="color: #15803d;">${Number(overview.minPrice || 0).toLocaleString()} ${currency}</div>
    </div>
    <div class="stat-card" style="background: #fff7ed;">
      <div class="stat-label" style="color: #9a3412;">أعلى سعر منافس</div>
      <div class="stat-val" style="color: #c2410c;">${Number(overview.maxPrice || 0).toLocaleString()} ${currency}</div>
    </div>
    <div class="stat-card" style="background: #eff6ff;">
      <div class="stat-label" style="color: #1e40af;">السعر المقترح من AI</div>
      <div class="stat-val" style="color: #2563eb;">${Number(strategic.recommendedPrice || prod.price).toLocaleString()} ${currency}</div>
    </div>
  </div>

  <div style="font-weight: 900; font-size: 13px; color: #1e1b4b; margin-bottom: 6px;">
    🔍 المنتجات والخيارات المنافسة في السوق (مرتبة حسب درجة التطابق):
  </div>

  <table>
    <thead>
      <tr>
        <th style="width: 30px; text-align: center;">#</th>
        <th>المنتج المنافس</th>
        <th style="width: 120px;">المتجر</th>
        <th style="width: 100px;">السعر</th>
        <th style="width: 130px;">الفارق عن متجرنا</th>
        <th style="width: 90px; text-align: center;">درجة التطابق</th>
      </tr>
    </thead>
    <tbody>
      ${competitorsRows || "<tr><td colspan='6' style='text-align:center;'>لا توجد بيانات متاحة</td></tr>"}
    </tbody>
  </table>

  <div class="recommendation-box">
    <div class="rec-title">🎯 التوصية الاستراتيجية للتسعير (AI Optimal Pricing):</div>
    <div style="font-size: 12px; font-weight: 800; color: #14532d; margin-bottom: 4px;">
      السعر المقترح: ${Number(strategic.recommendedPrice || prod.price).toLocaleString()} ${currency}
    </div>
    <div style="font-size: 11px; color: #166534; line-height: 1.6;">
      ${escapeHtml(strategic.pricingRationale)}
    </div>
    ${strategic.potentialMarginImpact ? `<div style="font-size: 10px; color: #047857; margin-top: 4px; font-weight: 700;">💡 أثر الهامش: ${escapeHtml(strategic.potentialMarginImpact)}</div>` : ""}
  </div>

  <div class="insights-grid">
    <div class="box" style="border-color: #bbf7d0;">
      <div class="box-title" style="color: #166534;">🌟 نقاط القوة والميزات التنافسية لمتجرنا:</div>
      <ul>${advantagesHtml || "<li>تنوع طرق الدفع وسرعة الشحن</li>"}</ul>
    </div>
    <div class="box" style="border-color: #fed7aa;">
      <div class="box-title" style="color: #9a3412;">⚠️ التحديات التنافسية المحتملة:</div>
      <ul>${vulnerabilitiesHtml || "<li>منافسة الأسعار في مواسم التخفيضات</li>"}</ul>
    </div>
  </div>

  ${
    strategic.actionableTips?.length
      ? `
  <div class="box" style="border-color: #cbd5e1; background: #f8fafc; margin-bottom: 16px;">
    <div class="box-title" style="color: #334155;">🚀 خطوات وإجراءات تنفيذية لزيادة المبيعات:</div>
    <ul>${tipsHtml}</ul>
  </div>
  `
      : ""
  }

  <div class="footer">
    تم إنشاء هذا التقرير آلياً بواسطة نظام الذكاء التنافسي المدمج في متجر ${escapeHtml(storeTitle)} • سري ومخصص للاستخدام الداخلي
  </div>

</body>
</html>`;

  // Print using hidden iframe
  const iframe = document.createElement("iframe");
  iframe.style.position = "fixed";
  iframe.style.right = "0";
  iframe.style.bottom = "0";
  iframe.style.width = "0";
  iframe.style.height = "0";
  iframe.style.border = "none";
  document.body.appendChild(iframe);

  const doc = iframe.contentWindow.document;
  doc.open();
  doc.write(htmlDoc);
  doc.close();

  iframe.contentWindow.focus();
  setTimeout(() => {
    iframe.contentWindow.print();
    setTimeout(() => {
      document.body.removeChild(iframe);
    }, 2000);
  }, 400);

  if (showToast) {
    showToast("جاري فتح نافذة طباعة تقرير PDF...", "success");
  }
}
