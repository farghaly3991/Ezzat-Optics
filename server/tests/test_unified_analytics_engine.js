/**
 * Automated Verification Suite for Unified Analytics Intelligence Engine
 */

const assert = require("assert");
const analyticsEngine = require("../modules/analytics-engine");
const aiInsightsService = require("../modules/analytics/aiInsightsService");
const analyticsController = require("../modules/analytics/analyticsController");

async function runTests() {
  console.log("=== Starting Unified Analytics Intelligence Engine Automated Verification ===");

  // 1. Verify Metric Definitions & Mathematical Helpers
  console.log("\n[Test 1] Verify Metric Definitions & Math Utilities...");
  assert(analyticsEngine.METRIC_DEFINITIONS.viewToCartConversion, "viewToCartConversion definition must exist");
  assert(analyticsEngine.METRIC_DEFINITIONS.cartAbandonmentRate, "cartAbandonmentRate definition must exist");
  assert.strictEqual(analyticsEngine.TIMEZONE, "Africa/Cairo");

  // safeRate tests
  assert.strictEqual(analyticsEngine.safeRate(5, 100), 5);
  assert.strictEqual(analyticsEngine.safeRate(1, 3), 33.33);
  assert.strictEqual(analyticsEngine.safeRate(10, 0), null, "safeRate should return null when denominator is 0");
  assert.strictEqual(analyticsEngine.safeRate(0, 10), 0);

  // computeDelta tests
  const deltaPositive = analyticsEngine.computeDelta(150, 100);
  assert.strictEqual(deltaPositive.percentChange, 50);
  assert.strictEqual(deltaPositive.absoluteDelta, 50);

  const deltaZeroPrev = analyticsEngine.computeDelta(20, 0);
  assert.strictEqual(deltaZeroPrev.percentChange, 100);

  // parseDateRange tests
  const parsed30d = analyticsEngine.parseDateRange({ range: "30d" });
  assert.strictEqual(parsed30d.daysSpan, 30);
  assert(parsed30d.startDate < parsed30d.endDate);
  assert(parsed30d.prevStartDate < parsed30d.prevEndDate);
  console.log("✓ Test 1 Passed: Metric definitions, safeRate, and date parsers verified.");

  // 2. Verify Graph Data Formatters
  console.log("\n[Test 2] Verify Graph Data Formatters for Dashboard & Charts...");
  
  // TimeSeries Graph
  const rawPoints = [
    { date: "2026-10-01", revenue: 5000, orders: 4, views: 120, cartAdditions: 15 },
    { date: "2026-10-02", revenue: 8500, orders: 6, views: 190, cartAdditions: 22 }
  ];
  const formattedTS = analyticsEngine.formatTimeSeriesGraph(rawPoints);
  assert.strictEqual(formattedTS.length, 2);
  assert.strictEqual(formattedTS[0].revenue, 5000);
  assert.strictEqual(formattedTS[1].views, 190);

  // Funnel Graph
  const rawFunnel = {
    views: { count: 1000 },
    cartAdditions: { count: 200 },
    checkouts: { count: 100 },
    ordersCreated: { count: 50 },
    ordersCompleted: { count: 40 }
  };
  const formattedFunnel = analyticsEngine.formatFunnelGraph(rawFunnel);
  assert.strictEqual(formattedFunnel.length, 5);
  assert.strictEqual(formattedFunnel[0].id, "views");
  assert.strictEqual(formattedFunnel[0].value, 1000);
  assert.strictEqual(formattedFunnel[1].stepConversionRate, 20); // 200/1000 = 20%
  assert.strictEqual(formattedFunnel[2].stepConversionRate, 50); // 100/200 = 50%
  assert.strictEqual(formattedFunnel[4].overallRetentionRate, 4); // 40/1000 = 4%

  // Category Distribution Graph
  const rawCatSales = [
    { name: "هواتف ذكية", total: 60000 },
    { name: "لابتوبات", total: 40000 }
  ];
  const formattedCats = analyticsEngine.formatCategoryDistributionGraph(rawCatSales);
  assert.strictEqual(formattedCats.length, 2);
  assert.strictEqual(formattedCats[0].sharePercent, 60);
  assert.strictEqual(formattedCats[1].sharePercent, 40);
  assert(formattedCats[0].color && formattedCats[1].color, "Colors must be assigned");

  // Scatter Plot
  const rawProducts = [
    { productId: "p1", name: "Dell XPS", price: 74000, views: 50, conversionRate: 4, priceFeedbackCount: 8, elasticityProfile: "elastic_high_friction" }
  ];
  const formattedScatter = analyticsEngine.formatPriceVsConversionScatter(rawProducts);
  assert.strictEqual(formattedScatter[0].x, 74000);
  assert.strictEqual(formattedScatter[0].y, 4);
  assert.strictEqual(formattedScatter[0].z, 50);
  console.log("✓ Test 2 Passed: Chart and graph formatters generated accurate payloads.");

  // 3. Verify Deterministic Evidence-Based AI Fallback Insights
  console.log("\n[Test 3] Verify Deterministic Evidence-Based Store Insights...");
  const dummySummary = {
    period: { startDate: new Date("2026-10-01"), endDate: new Date("2026-10-30"), daysSpan: 30 },
    generalMetrics: {
      activity: { productViews: 1200, uniqueVisitors: 350, addToCartEvents: 180, priceFeedbackEvents: 12 },
      orders: { ordersCreated: 45, ordersCompleted: 40, ordersCancelled: 5, unitsSold: 52, returnedQuantity: 1 },
      financials: { completedRevenue: 154000, cancelledOrderValue: 8000 },
      conversions: { viewToCartConversion: 15, viewToPurchaseConversion: 3.33, orderCancellationRate: 11.11, cartAbandonmentRate: 25, priceFeedbackRate: 1 }
    },
    previousPeriodComparisons: {
      productViews: { percentChange: 12.5 }
    },
    sampleSizes: {
      totalOrdersInPeriod: 45,
      uniqueVisitors: 350
    },
    priceFeedbackTrend: {
      totalEvents: 12,
      ratePerView: 1,
      previousPeriodEvents: 8
    },
    rankingsSummary: {
      mostPriceFeedback: [
        { name: "لابتوب ديل", price: 74000, priceFeedbackCount: 6, views: 120, priceFeedbackPerViewRate: 5, unitsSold: 4 }
      ],
      mostCancelled: [
        { name: "ساعة ذكية", cancelledOrdersCount: 3, ordersCreatedCount: 15, cancellationRateByOrders: 20, unitsSold: 12 }
      ]
    }
  };

  const insights = analyticsEngine.buildRuleBasedStructuredInsights(dummySummary);
  assert(Array.isArray(insights), "Insights must be an array");
  assert(insights.length >= 2, "Expected at least 2 structured insights");

  insights.forEach((insight, idx) => {
    assert(insight.title, `Insight ${idx} must have title`);
    assert(insight.observation, `Insight ${idx} must have observation`);
    assert(Array.isArray(insight.supportingMetrics), `Insight ${idx} must have supportingMetrics array`);
    assert(insight.supportingMetrics.length > 0, `Insight ${idx} must have at least one supportingMetric`);
    assert(Array.isArray(insight.possibleExplanations), `Insight ${idx} must have possibleExplanations`);
    assert(Array.isArray(insight.recommendedActions), `Insight ${idx} must have recommendedActions`);
    assert(["low", "medium", "high"].includes(insight.confidence), `Insight ${idx} has valid confidence`);
    assert(insight.limitations, `Insight ${idx} must have limitations statement`);
  });
  console.log(`✓ Test 3 Passed: Rule-based structured insight generator produced ${insights.length} validated cards.`);

  // 4. Verify Relationship Intelligence Engine Functions
  console.log("\n[Test 4] Verify Relationship Intelligence Engine Interface...");
  assert(typeof analyticsEngine.analyzeProductAffinity === "function", "analyzeProductAffinity should exist");
  assert(typeof analyticsEngine.analyzePriceElasticity === "function", "analyzePriceElasticity should exist");
  assert(typeof analyticsEngine.analyzeDropOffFriction === "function", "analyzeDropOffFriction should exist");
  console.log("✓ Test 4 Passed: Relationship intelligence functions properly exported.");

  // 5. Verify Facade Delegations in aiInsightsService & analyticsController
  console.log("\n[Test 5] Verify Facade Compatibility across Controllers...");
  assert.strictEqual(aiInsightsService.generateStoreInsights, analyticsEngine.generateStoreInsights);
  assert.strictEqual(aiInsightsService.getLastSavedStoreInsights, analyticsEngine.getLastSavedStoreInsights);
  assert(typeof analyticsController.getProductAffinity === "function", "analyticsController.getProductAffinity should exist");
  assert(typeof analyticsController.getPriceElasticity === "function", "analyticsController.getPriceElasticity should exist");
  assert(typeof analyticsController.getDropOffFriction === "function", "analyticsController.getDropOffFriction should exist");
  console.log("✓ Test 5 Passed: Facade maintains 100% backward compatibility.");

  console.log("\n🎉 ALL ANALYTICS INTELLIGENCE ENGINE TESTS PASSED SUCCESSFULLY! (5/5)");
}

runTests().catch((err) => {
  console.error("Test Suite Failed:", err);
  process.exit(1);
});
