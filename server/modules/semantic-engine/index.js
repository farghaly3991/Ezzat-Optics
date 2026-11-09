const embeddingProvider = require("./embeddingProvider");
const productRepresentation = require("./productRepresentation");
const userProfileEngine = require("./userProfileEngine");
const recommendationEngine = require("./recommendationEngine");
const searchEngine = require("./searchEngine");
const desiredProductMatcher = require("./desiredProductMatcher");

module.exports = {
  ...embeddingProvider,
  ...productRepresentation,
  ...userProfileEngine,
  ...recommendationEngine,
  ...searchEngine,
  ...desiredProductMatcher
};
