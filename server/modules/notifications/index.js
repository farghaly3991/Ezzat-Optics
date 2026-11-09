const routes = require("./routes");
const getStoreNotificationModel = require("./notificationModel");
const getPushSubscriptionModel = require("./pushSubscriptionModel");
const { dispatchNotification } = require("./notificationDispatcher");
const { checkPushAvailability, sendWebPushToSubscription } = require("./pushService");

module.exports = {
  routes,
  getStoreNotificationModel,
  getPushSubscriptionModel,
  dispatchNotification,
  checkPushAvailability,
  sendWebPushToSubscription
};
