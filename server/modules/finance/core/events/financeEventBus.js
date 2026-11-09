/**
 * Finance Core Event Bus
 *
 * Keeps core order, payment, shipping, and procurement business events
 * loosely coupled from optional reporting, accounting, and inventory modules.
 */

const listenersByEvent = new Map();

const FINANCE_DOMAIN_EVENTS = {
  ORDER_FINANCIAL_SNAPSHOT_CREATED: "finance.order.snapshot_created",
  ORDER_ACTUAL_SHIPPING_COST_RECORDED: "finance.order.actual_shipping_cost_recorded",
  ORDER_PICKUP_COMPLETED: "finance.order.pickup_completed",
  SHIPPING_CLASS_CREATED: "finance.shipping.class_created",
  SHIPPING_CLASS_UPDATED: "finance.shipping.class_updated",
  SHIPPING_CLASS_STATUS_CHANGED: "finance.shipping.class_status_changed",
  SUPPLIER_SHIPMENT_CREATED: "finance.procurement.shipment_created",
  SUPPLIER_SHIPMENT_UPDATED: "finance.procurement.shipment_updated",
  SUPPLIER_SHIPMENT_PRODUCT_ASSOCIATED: "finance.procurement.product_associated",
  SUPPLIER_SHIPMENT_RECEIVED: "finance.procurement.shipment_received",
  FINANCE_PAYMENT_RECORDED: "finance.payments.recorded",
  FINANCE_PAYMENT_CORRECTED: "finance.payments.corrected",
  FINANCE_PAYMENT_REVERSED: "finance.payments.reversed",
  SUPPLIER_SHIPMENT_DUE_DATE_CHANGED: "finance.procurement.due_date_changed",
  FINANCE_SETTINGS_UPDATED: "finance.settings.updated",
  // Phase C: Inventory, Receiving & Valuation Events
  INVENTORY_MOVEMENT_RECORDED: "finance.inventory.movement_recorded",
  INVENTORY_SHIPMENT_RECEIVED: "finance.inventory.shipment_received",
  INVENTORY_MANUAL_ADJUSTMENT: "finance.inventory.manual_adjustment",
  INVENTORY_DAMAGED_RECORDED: "finance.inventory.damaged_recorded",
  // Phase D: Expenses, Recurring Expenses & Manual Sales Events
  EXPENSE_CREATED: "finance.expenses.created",
  EXPENSE_PAID: "finance.expenses.paid",
  RECURRING_EXPENSE_GENERATED: "finance.expenses.recurring_generated",
  MANUAL_SALE_CREATED: "finance.sales.manual_created",
  MANUAL_SALE_PAYMENT_RECORDED: "finance.sales.manual_payment_recorded",
  // Phase E: Accounting Events
  JOURNAL_ENTRY_POSTED: "finance.accounting.journal_posted",
  JOURNAL_ENTRY_REVERSED: "finance.accounting.journal_reversed",
  ACCOUNTING_PERIOD_CLOSED: "finance.accounting.period_closed",
  // Phase F: Currency & Exchange Rate Events
  EXCHANGE_RATE_UPDATED: "finance.currency.rate_updated",
  REPLACEMENT_COSTS_RECALCULATED: "finance.currency.costs_recalculated"
};

function subscribeFinanceEvent(eventName, handler) {
  if (!eventName || typeof handler !== "function") return () => {};
  if (!listenersByEvent.has(eventName)) {
    listenersByEvent.set(eventName, new Set());
  }
  const set = listenersByEvent.get(eventName);
  set.add(handler);
  return () => set.delete(handler);
}

async function emitFinanceEvent(eventName, payload = {}) {
  const set = listenersByEvent.get(eventName);
  if (!set || set.size === 0) return [];
  const results = [];
  for (const handler of set) {
    try {
      const out = await handler(payload);
      results.push({ ok: true, result: out });
    } catch (err) {
      console.warn(`[FINANCE_EVENT_BUS_WARN] Listener failed for ${eventName}:`, err.message);
      results.push({ ok: false, error: err.message });
    }
  }
  return results;
}

module.exports = {
  FINANCE_DOMAIN_EVENTS,
  subscribeFinanceEvent,
  emitFinanceEvent
};
