export function exportInsightsPdf(targetReport, config, currentMetrics, showToast) {
  if (!targetReport || !Array.isArray(targetReport.insights)) {
    if (showToast) showToast('لا يوجد تقرير رؤى جاهز للتصدير حالياً', 'error');
    return;
  }

  const storeTitle = config?.siteName || 'المتجر الإلكتروني';
  const currency = config?.currency || 'ج.م';
  const generatedDate = targetReport.generatedAt
    ? new Date(targetReport.generatedAt).toLocaleString('ar-EG')
    : new Date().toLocaleString('ar-EG');
  const periodStart = targetReport.period?.startDate
    ? new Date(targetReport.period.startDate).toLocaleDateString('ar-EG')
    : '—';
  const periodEnd = targetReport.period?.endDate
    ? new Date(targetReport.period.endDate).toLocaleDateString('ar-EG')
    : '—';
  const daysSpan = targetReport.period?.daysSpan || '—';

  const genMetrics = targetReport.summarySnapshot?.generalMetrics;
  const fin = genMetrics?.financials || currentMetrics?.financial || {};
  const ord = genMetrics?.orders || currentMetrics?.orders || {};
  const act = genMetrics?.activity || currentMetrics?.activity || {};
  const conv = genMetrics?.conversions || currentMetrics?.conversions || {};

  const escapeHtml = (str) =>
    String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

  const insightsHtml = (targetReport.insights || [])
    .map((ins, i) => {
      const confLabel =
        ins.confidence === 'high'
          ? 'درجة الثقة: عالية'
          : ins.confidence === 'medium'
          ? 'درجة الثقة: متوسطة'
          : 'درجة الثقة: منخفضة (عينة محدودة)';
      const confColor =
        ins.confidence === 'high'
          ? '#059669'
          : ins.confidence === 'medium'
          ? '#0284c7'
          : '#d97706';

      return `
        <div class="insight-card">
          <div class="insight-header">
            <h3>${i + 1}. ${escapeHtml(ins.title)}</h3>
            <span class="badge" style="background:${confColor}18; color:${confColor}; border:1px solid ${confColor}40;">${confLabel}</span>
          </div>
          <div class="section-box obs">
            <div class="sec-title">📌 الحقيقة المرصودة (Observation):</div>
            <p>${escapeHtml(ins.observation)}</p>
          </div>
          ${
            ins.supportingMetrics?.length
              ? `<div class="section-box">
                  <div class="sec-title" style="color:#047857;">📊 الأدلة الرقمية الداعمة (Supporting Metrics):</div>
                  <ul>${ins.supportingMetrics.map((m) => `<li>${escapeHtml(m)}</li>`).join('')}</ul>
                </div>`
              : ''
          }
          ${
            ins.possibleExplanations?.length
              ? `<div class="section-box">
                  <div class="sec-title" style="color:#6d28d9;">💡 التفسيرات والفرضيات المحتملة (Hypotheses):</div>
                  <ul>${ins.possibleExplanations.map((ex) => `<li>${escapeHtml(ex)}</li>`).join('')}</ul>
                </div>`
              : ''
          }
          ${
            ins.recommendedActions?.length
              ? `<div class="section-box rec">
                  <div class="sec-title" style="color:#b45309;">✅ الإجراءات والتوصيات العملية (Recommended Actions):</div>
                  <ul>${ins.recommendedActions.map((act) => `<li><strong>${escapeHtml(act)}</strong></li>`).join('')}</ul>
                </div>`
              : ''
          }
          ${
            ins.limitations
              ? `<div class="limitations"><strong>حدود الاستنتاج (Limitations):</strong> ${escapeHtml(ins.limitations)}</div>`
              : ''
          }
        </div>
      `;
    })
    .join('');

  const limitationsHtml = (targetReport.dataLimitations || [])
    .map((l) => `<li>${escapeHtml(l)}</li>`)
    .join('');

  const htmlDoc = `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
<meta charset="UTF-8" />
<title>تقرير الرؤى التحليلية الذكية - ${escapeHtml(storeTitle)}</title>
<link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800;900&display=swap" rel="stylesheet">
<style>
  * { box-sizing: border-box; }
  body {
    font-family: 'Cairo', Tahoma, Arial, sans-serif;
    background: #f8fafc;
    color: #0f172a;
    margin: 0;
    padding: 24px;
    direction: rtl;
  }
  .toolbar {
    max-width: 900px;
    margin: 0 auto 16px auto;
    background: #0f172a;
    color: #fff;
    padding: 12px 20px;
    border-radius: 14px;
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
  .toolbar button {
    background: #0284c7;
    color: #fff;
    border: none;
    padding: 8px 18px;
    border-radius: 8px;
    font-family: 'Cairo', sans-serif;
    font-weight: 800;
    font-size: 13px;
    cursor: pointer;
  }
  .report-container {
    max-width: 900px;
    margin: 0 auto;
    background: #ffffff;
    padding: 32px;
    border-radius: 18px;
    border: 1px solid #e2e8f0;
    box-shadow: 0 4px 20px rgba(15, 23, 42, 0.05);
  }
  .header {
    border-bottom: 2px solid #0284c7;
    padding-bottom: 16px;
    margin-bottom: 20px;
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 16px;
  }
  .header h1 { margin: 0 0 6px 0; font-size: 22px; font-weight: 900; color: #0f172a; }
  .header p { margin: 2px 0; font-size: 12px; color: #475569; font-weight: 600; }
  .kpi-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 10px;
    margin-bottom: 20px;
  }
  .kpi-box {
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: 12px;
    padding: 10px 14px;
  }
  .kpi-box .label { font-size: 11px; color: #64748b; font-weight: 700; }
  .kpi-box .val { font-size: 16px; font-weight: 900; color: #0f172a; margin-top: 2px; }
  .sample-banner {
    background: #f1f5f9;
    border: 1px solid #cbd5e1;
    border-radius: 12px;
    padding: 12px 16px;
    margin-bottom: 22px;
    font-size: 11.5px;
  }
  .sample-banner ul { margin: 6px 0 0 0; padding-right: 18px; color: #334155; }
  .insight-card {
    border: 1px solid #cbd5e1;
    border-radius: 14px;
    padding: 18px;
    margin-bottom: 16px;
    background: #ffffff;
    page-break-inside: avoid;
  }
  .insight-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-bottom: 1px solid #f1f5f9;
    padding-bottom: 10px;
    margin-bottom: 12px;
  }
  .insight-header h3 { margin: 0; font-size: 15px; font-weight: 800; color: #0f172a; }
  .badge { font-size: 10.5px; font-weight: 800; padding: 3px 10px; border-radius: 20px; }
  .section-box {
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: 10px;
    padding: 10px 14px;
    margin-bottom: 8px;
    font-size: 12px;
    line-height: 1.6;
  }
  .section-box.obs { background: #f0f9ff; border-color: #bae6fd; }
  .section-box.rec { background: #fefce8; border-color: #fef08a; }
  .sec-title { font-weight: 800; margin-bottom: 4px; font-size: 11px; }
  .section-box p { margin: 0; }
  .section-box ul { margin: 4px 0 0 0; padding-right: 18px; }
  .limitations { font-size: 11px; color: #64748b; border-top: 1px dashed #e2e8f0; padding-top: 8px; margin-top: 8px; }
  @media print {
    body { background: #fff; padding: 0; }
    .toolbar { display: none !important; }
    .report-container { border: none; box-shadow: none; padding: 0; max-width: 100%; }
    @page { size: A4; margin: 12mm; }
  }
</style>
</head>
<body>
<div class="toolbar">
  <span>📄 معاينة تقرير الرؤى التحليلية الذكية — اختر «Save as PDF / حفظ بتنسيق PDF» من نافذة الطباعة</span>
  <button onclick="window.print()">حفظ كملف PDF / طباعة الآن</button>
</div>
<div class="report-container">
  <div class="header">
    <div>
      <h1>تقرير الرؤى والتوصيات التحليلية الذكية (AI Store Insights)</h1>
      <p>المتجر: <strong>${escapeHtml(storeTitle)}</strong> | المحرك التحليلي: <strong>${targetReport.aiUsed ? escapeHtml(targetReport.model || 'LLM Advisor') : 'تحليل إحصائي مهيكل مدعوم بالأدلة'}</strong></p>
      <p>الفترة التحليلية: من <strong>${periodStart}</strong> إلى <strong>${periodEnd}</strong> (${daysSpan} يوماً)</p>
    </div>
    <div style="text-align:left;">
      <p>تاريخ توليد التقرير:</p>
      <p><strong>${generatedDate}</strong></p>
    </div>
  </div>

  <div class="kpi-grid">
    <div class="kpi-box">
      <div class="label">إجمالي المشاهدات / الزوار</div>
      <div class="val">${act.productViews ?? 0} مشاهدة (${act.uniqueVisitors ?? 0} زائر)</div>
    </div>
    <div class="kpi-box">
      <div class="label">إضافات السلة ومعدل التحويل</div>
      <div class="val">${act.cartAdditions ?? 0} (${conv.viewToCartRate ?? 0}%)</div>
    </div>
    <div class="kpi-box">
      <div class="label">الطلبات المنشأة / المكتملة</div>
      <div class="val">${ord.ordersCreated ?? 0} طلب (${ord.completedOrders ?? 0} مكتمل)</div>
    </div>
    <div class="kpi-box">
      <div class="label">الإيرادات وصافي الربح</div>
      <div class="val">${Number(fin.grossRevenue || 0).toLocaleString()} ${escapeHtml(currency)} (ربح: ${Number(fin.netProfit || 0).toLocaleString()})</div>
    </div>
  </div>

  <div class="sample-banner">
    <strong>حجم العينة والضوابط الإحصائية للتقرير:</strong>
    إجمالي أحداث النشاط: <strong>${targetReport.sampleSizes?.totalActivityEvents || 0}</strong> •
    الزوار الفريدون: <strong>${targetReport.sampleSizes?.uniqueVisitors || 0}</strong> •
    إجمالي الطلبات بالفترة: <strong>${targetReport.sampleSizes?.totalOrdersInPeriod || 0}</strong>
    ${limitationsHtml ? `<ul>${limitationsHtml}</ul>` : ''}
  </div>

  ${insightsHtml}
</div>
<script>
  window.onload = function() {
    setTimeout(function() { window.print(); }, 350);
  };
</script>
</body>
</html>`;

  const printWin = window.open('', '_blank');
  if (!printWin) {
    if (showToast) showToast('يرجى السماح بالنوافذ المنبثقة (Popups) لتصدير ملف الـ PDF', 'error');
    return;
  }
  printWin.document.open();
  printWin.document.write(htmlDoc);
  printWin.document.close();
}
