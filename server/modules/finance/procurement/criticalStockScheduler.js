/**
 * 6-Hour Background Worker for Critical Stock & Proactive Supplier Alerts
 */

const { runPeriodicCriticalStockCheck } = require("./procurementReorderService");

function initCriticalStockScheduler(getTenantNamesFn) {
  const SIX_HOURS_MS = 6 * 60 * 60 * 1000;

  async function checkAllTenants() {
    try {
      const tenants = typeof getTenantNamesFn === "function" ? getTenantNamesFn() : [];
      if (!Array.isArray(tenants) || tenants.length === 0) return;

      for (const tenant of tenants) {
        if (!tenant || tenant === "undefined") continue;
        await runPeriodicCriticalStockCheck(tenant);
      }
    } catch (err) {
      console.error("[CRITICAL_STOCK_SCHEDULER_LOOP_ERROR]:", err.message);
    }
  }

  // Initial trigger after 30 seconds
  const initialTimer = setTimeout(() => {
    checkAllTenants();
  }, 30000);

  // Standing 6-hour interval
  const intervalTimer = setInterval(() => {
    checkAllTenants();
  }, SIX_HOURS_MS);

  if (typeof initialTimer?.unref === "function") initialTimer.unref();
  if (typeof intervalTimer?.unref === "function") intervalTimer.unref();

  return { checkAllTenants, intervalTimer };
}

module.exports = { initCriticalStockScheduler };
