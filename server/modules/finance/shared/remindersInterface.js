/**
 * Finance Module — Reusable Reminders & Due-Date Alerts Interface
 *
 * Evaluates due dates, overdue obligations, and upcoming payment schedules
 * without requiring an external notification provider in Phase B.
 * Exposes a provider registration boundary for future SMS/Email/WhatsApp/Push dispatchers.
 */

const registeredAdapters = new Map();

/**
 * Register a notification adapter (e.g. email, whatsapp, push) in future phases.
 */
function registerReminderAdapter(adapterName, handlerFn) {
  if (!adapterName || typeof handlerFn !== "function") {
    throw new Error("Reminder adapter requires a valid name and handler function");
  }
  registeredAdapters.set(adapterName, handlerFn);
}

/**
 * Evaluate due status for an obligation/shipment.
 */
function evaluateDueStatus({ dueDate, outstandingBalance, status, now = new Date(), upcomingThresholdDays = 7 }) {
  const balance = Number(outstandingBalance || 0);
  if (!dueDate || balance <= 0 || status === "cancelled" || status === "closed") {
    return {
      hasDueDate: Boolean(dueDate),
      isOverdue: false,
      isUpcomingDue: false,
      daysOverdue: 0,
      daysUntilDue: null,
      severity: "none"
    };
  }

  const dueTime = new Date(dueDate).getTime();
  const nowTime = (now instanceof Date ? now : new Date(now)).getTime();
  if (Number.isNaN(dueTime)) {
    return {
      hasDueDate: false,
      isOverdue: false,
      isUpcomingDue: false,
      daysOverdue: 0,
      daysUntilDue: null,
      severity: "none"
    };
  }

  const diffMs = dueTime - nowTime;
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  if (diffMs < 0) {
    const daysOverdue = Math.max(1, Math.floor(Math.abs(diffMs) / (1000 * 60 * 60 * 24)));
    return {
      hasDueDate: true,
      isOverdue: true,
      isUpcomingDue: false,
      daysOverdue,
      daysUntilDue: -daysOverdue,
      severity: daysOverdue > 14 ? "critical" : "overdue"
    };
  }

  const isUpcomingDue = diffDays <= upcomingThresholdDays;
  return {
    hasDueDate: true,
    isOverdue: false,
    isUpcomingDue,
    daysOverdue: 0,
    daysUntilDue: diffDays,
    severity: isUpcomingDue ? "warning" : "normal"
  };
}

/**
 * Dispatch reminder payload to any registered adapters (no-op if none registered).
 */
async function dispatchReminderNotification(subdomain, reminderPayload) {
  const results = [];
  for (const [name, handler] of registeredAdapters.entries()) {
    try {
      const res = await handler(subdomain, reminderPayload);
      results.push({ adapter: name, ok: true, result: res });
    } catch (err) {
      results.push({ adapter: name, ok: false, error: err.message });
    }
  }
  return {
    dispatchedCount: results.length,
    results
  };
}

module.exports = {
  registerReminderAdapter,
  evaluateDueStatus,
  dispatchReminderNotification
};
