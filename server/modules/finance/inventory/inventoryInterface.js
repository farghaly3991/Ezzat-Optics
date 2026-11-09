/**
 * Phase C — Inventory Movements, Receiving & Valuation Interface
 */

const inventoryService = require("./inventoryService");

const COSTING_METHODS = {
  WEIGHTED_AVERAGE: "weighted_average",
  FIFO: "fifo"
};

const STOCK_MOVEMENT_TYPES = {
  SUPPLIER_RECEIPT: "supplier_receipt",
  CUSTOMER_SALE: "customer_sale",
  CUSTOMER_RETURN: "customer_return",
  ORDER_CANCELLATION_RESTORE: "order_cancellation_restore",
  SUPPLIER_RETURN: "supplier_return",
  DAMAGED_OR_LOST: "damaged_or_lost",
  MANUAL_ADJUSTMENT: "manual_adjustment",
  RESERVATION_HOLD: "reservation_hold",
  RESERVATION_RELEASE: "reservation_release"
};

let registeredInventoryProvider = inventoryService;

function registerInventoryProvider(provider) {
  registeredInventoryProvider = provider;
}

function isInventoryPhaseActive() {
  return Boolean(registeredInventoryProvider && registeredInventoryProvider.implemented === true);
}

async function onSupplierShipmentReceivingHook(subdomain, shipment, receivingPayload = {}, actor = null) {
  if (isInventoryPhaseActive() && typeof registeredInventoryProvider.receiveSupplierShipment === "function") {
    return registeredInventoryProvider.receiveSupplierShipment(
      subdomain,
      shipment._id || shipment,
      receivingPayload,
      actor
    );
  }
  return {
    handled: false,
    phase: "C",
    implemented: false
  };
}

module.exports = {
  COSTING_METHODS,
  STOCK_MOVEMENT_TYPES,
  registerInventoryProvider,
  isInventoryPhaseActive,
  onSupplierShipmentReceivingHook,
  inventoryService
};
