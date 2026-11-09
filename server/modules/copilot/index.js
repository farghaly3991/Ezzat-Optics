const routes = require("./routes");
const copilotEngine = require("./copilotEngine");
const copilotTools = require("./copilotTools");

module.exports = {
  routes,
  ...copilotEngine,
  ...copilotTools
};
