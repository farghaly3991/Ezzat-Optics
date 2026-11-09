/**
 * Tenant-aware request middleware (runs on every request, in this order):
 *   1. resolveTenant        – subdomain / x-tenant-id resolution + CORS headers
 *   2. noCache              – API responses are never cached
 *   3. injectTenantEnv      – per-tenant settings from env.json copied onto `req`
 *   4. connectTenantDatabase– opens the tenant's MongoDB connection
 *   5. injectAdminData      – loads the store settings document into `req.adminData`
 */

const { ensureTenantConnection } = require("../database");
const getAdminDataModel = require("../../modules/settings/adminDataModel");

let envJsonData = {};
try {
  envJsonData = require("../../env.json");
} catch (e) {
  console.warn("Could not load env.json, using process.env fallbacks.");
}

// 1. CORS & Subdomain Resolution
function resolveTenant(req, res, next) {
  // Tenant resolution: header x-tenant-id > subdomain > localhost
  let domain = req.headers["x-tenant-id"];
  if (!domain) {
    const hostHeader = req.headers.host || "localhost";
    const sub = hostHeader.split(".")[0];
    domain = sub.includes(":") ? sub.split(":")[0] : sub;
  }
  if (!domain || domain === "127" || domain === "127.0.0.1") {
    domain = "localhost";
  }

  req.subdomain = domain;

  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Origin, X-Requested-With, Content-Type, Accept, Authorization, x-auth-token, x-tenant-id, x-visitor-id, x-session-id, x-cart-id"
  );
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PATCH, PUT, DELETE, OPTIONS");

  if (req.method === "OPTIONS") {
    return res.sendStatus(204);
  }
  next();
}

// 2. Disable caching for API calls
function noCache(req, res, next) {
  res.set({
    "Cache-Control": "no-cache, no-store, must-revalidate",
    Pragma: "no-cache",
    Expires: "0"
  });
  next();
}

// 3. Tenant Environment & Database URL Injection
function injectTenantEnv(req, res, next) {
  const domain = req.subdomain;
  const tenantEnv = (process.env.DESKTOP_MODE === "1") ? {} : (envJsonData[domain] || envJsonData.localhost || {});

  for (const key in process.env) {
    if (!(key in req)) req[key] = process.env[key];
  }
  for (const key in tenantEnv) {
    req[key] = tenantEnv[key];
  }

  if (process.env.DESKTOP_MODE === "1") {
    req.database = process.env.DEFAULT_DB;
  } else if (!req.database) {
    req.database = tenantEnv.database || process.env.DEFAULT_DB || "mongodb://127.0.0.1:27017/multu_tenant_store";
  }
  next();
}

// 4. Dynamic Database Connection Middleware
async function connectTenantDatabase(req, res, next) {
  try {
    await ensureTenantConnection(req.subdomain, req.database);
    next();
  } catch (err) {
    res.status(500).json({ error: "فشل الاتصال بقاعدة بيانات المتجر", details: err.message });
  }
}

// 5. Inject AdminData & Tenant Settings into `req.adminData` (and auto-seed fallback AI credentials in DB if missing)
async function injectAdminData(req, res, next) {
  try {
    const AdminData = getAdminDataModel(req.subdomain);
    let adminDoc = await AdminData.findOne().lean();
    if (!adminDoc) {
      adminDoc = await new AdminData().save();
      adminDoc = adminDoc.toObject();
    }

    // Ensure fallback & primary AI credentials from env are persisted in the DB document if missing
    const seedUpdates = {};
    if (!adminDoc.AI_API_KEY && !adminDoc.aiApiKey && process.env.AI_API_KEY) {
      seedUpdates.AI_API_KEY = process.env.AI_API_KEY.trim();
      seedUpdates.aiApiKey = process.env.AI_API_KEY.trim();
    }
    if (!adminDoc.AI_BASE_URL && process.env.AI_BASE_URL) {
      seedUpdates.AI_BASE_URL = process.env.AI_BASE_URL.trim();
    }
    if (!adminDoc.AI_MODEL && process.env.AI_MODEL) {
      seedUpdates.AI_MODEL = process.env.AI_MODEL.trim();
    }
    if (!adminDoc.GEMINI_API_KEY && process.env.GEMINI_API_KEY) {
      seedUpdates.GEMINI_API_KEY = process.env.GEMINI_API_KEY.trim();
    }
    if (!adminDoc.GEMINI_FALLBACK_MODEL || adminDoc.GEMINI_FALLBACK_MODEL === "gemini-2.5-flash") {
      seedUpdates.GEMINI_FALLBACK_MODEL = (process.env.GEMINI_FALLBACK_MODEL || "gemini-3.5-flash").trim();
    }

    if (Object.keys(seedUpdates).length > 0) {
      await AdminData.updateOne({ _id: adminDoc._id }, { $set: seedUpdates }).catch(() => {});
      adminDoc = { ...adminDoc, ...seedUpdates };
    }

    req.adminData = adminDoc;
    next();
  } catch (err) {
    console.warn(`[ADMIN_DATA_INJECT_WARN] ${err.message}`);
    req.adminData = {};
    next();
  }
}

module.exports = {
  resolveTenant,
  noCache,
  injectTenantEnv,
  connectTenantDatabase,
  injectAdminData
};
