const routes = require("./routes");
const getProductWaitlistModel = require("./waitlistModel");
const getDesiredProductModel = require("./desiredProductModel");
const getStoreNotificationModel = require("./notificationModel");
const {
  checkWhatsAppAvailability,
  buildWhatsAppDirectLink,
  sendWhatsAppNotification,
  createInAppNotification
} = require("./notificationService");
const {
  planAndEmbedDesiredProduct,
  matchProductWithDesiredRequests,
  localExtractDesiredProduct
} = require("./desiredProductPlanner");

module.exports = {
  routes,
  getProductWaitlistModel,
  getDesiredProductModel,
  getStoreNotificationModel,
  checkWhatsAppAvailability,
  buildWhatsAppDirectLink,
  sendWhatsAppNotification,
  createInAppNotification,
  planAndEmbedDesiredProduct,
  matchProductWithDesiredRequests,
  localExtractDesiredProduct
};
