/**
 * Multi-Tenant Store — server entry point.
 *
 * This file only wires the app together:
 *   core/middleware/*  -> tenant resolution, DB connection, settings injection, error handling
 *   core/routes.js     -> mounts every feature module under /api
 *   modules/<feature>  -> all business logic (routes, controllers, services, models)
 */

const express = require("express");
const http = require("http");
const path = require("path");
const bodyParser = require("body-parser");
const cors = require("cors");
require("dotenv").config();

const {
  getMongooseConnection,
  setMongooseConnection,
  getConnectedTenantNames,
  isTenantConnected
} = require("./core/database");
const {
  resolveTenant,
  noCache,
  injectTenantEnv,
  connectTenantDatabase,
  injectAdminData
} = require("./core/middleware/tenant");
const { errorHandler } = require("./core/middleware/errorHandler");
const apiRoutes = require("./core/routes");
const { initFacebookPostScheduler } = require("./modules/facebook/facebookPostsController");
const { initCriticalStockScheduler } = require("./modules/finance/procurement/criticalStockScheduler");

const app = express();
const server = http.createServer(app);
app.set("trust proxy", 1);

// 1. Tenant / CORS / DB / settings pipeline (order matters)
app.use(resolveTenant);
app.use(cors());
app.use(noCache);
app.use(injectTenantEnv);
app.use(connectTenantDatabase);
app.use(injectAdminData);

// 2. Static files & body parsers
// UPLOADS_DIR is set by the desktop (Electron) edition to a writable per-user folder.
app.use("/uploads", express.static(process.env.UPLOADS_DIR || path.join(__dirname, "uploads")));
app.use(bodyParser.urlencoded({ limit: "20mb", extended: true }));
app.use(bodyParser.json({ limit: "20mb", extended: true }));

// 3. Health check
app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    tenant: req.subdomain,
    dbReady: isTenantConnected(req.subdomain),
    time: new Date()
  });
});

// 4. API routes (all feature modules)
app.use("/api", apiRoutes);

// 5. Global error handler
app.use(errorHandler);

// 6. Built client (SPA) fallback
app.use(express.static(path.join(__dirname, "dist")));
app.get("*", (req, res) => {
  if (!req.path.startsWith("/api")) {
    res.sendFile(path.join(__dirname, "dist", "index.html"));
  }
});

// 7. Background jobs
initFacebookPostScheduler(() => getConnectedTenantNames());
initCriticalStockScheduler(() => getConnectedTenantNames());
try {
  const { startPeriodicSyncWorker } = require("./modules/sync/syncRoutes");
  startPeriodicSyncWorker(() => getMongooseConnection("localhost"));
} catch (_) {}

if (require.main === module) {
  const PORT = process.env.PORT || 4700;
  server.listen(PORT, "0.0.0.0", () => {
    console.log(`Multi-Tenant Store Server listening on port ${PORT}`);
  });
}

// Kept for tests, seed scripts and any code that still imports from "server.js"
exports.app = app;
exports.getMongooseConnection = getMongooseConnection;
exports.setMongooseConnection = setMongooseConnection;
