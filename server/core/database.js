/**
 * Bulletproof Multi-Tenant Database Connection Pool for Ezzat Optics.
 * Guaranteed continuous uptime, KeepAlive ping, and automated auto-reconnect.
 */

const mongoose = require("mongoose");
const { ensureDefaultOfflineAccounts } = require("./offlineBootstrap");
const { ensureInitialCloudClone } = require("./cloudCloner");

const dbConnections = {};
const connectionPromises = {};
let keepAliveStarted = false;

function getMongooseConnection(subdomain = "localhost") {
  const domain = subdomain || "localhost";
  const conn = dbConnections[domain] || dbConnections["localhost"];
  if (!conn || conn.readyState !== 1) {
    // If connection was dropped, attempt immediate resurrection
    if (conn && conn.databaseUrl) {
      console.warn(`[DB_RESURRECT] Re-establishing dropped connection for tenant: "${domain}"`);
      ensureTenantConnection(domain, conn.databaseUrl).catch(() => {});
    }
  }
  return conn || mongoose.connection;
}

function setMongooseConnection(subdomain, conn) {
  dbConnections[subdomain || "localhost"] = conn;
}

function getConnectedTenantNames() {
  return Object.keys(dbConnections);
}

function isTenantConnected(domain) {
  return dbConnections[domain]?.readyState === 1;
}

/**
 * Open (or reuse) the connection of a tenant. Bulletproof options and listeners.
 */
async function ensureTenantConnection(domain, databaseUrl) {
  if (isTenantConnected(domain)) return dbConnections[domain];

  if (!connectionPromises[domain]) {
    console.log(`[DB_CONNECTING] Establishing connection for tenant "${domain}" -> ${databaseUrl}`);

    const options = {
      serverSelectionTimeoutMS: 30000,
      socketTimeoutMS: 0, // Never timeout socket locally
      connectTimeoutMS: 30000,
      maxPoolSize: 50,
      minPoolSize: 5,
      heartbeatFrequencyMS: 10000 // 10s ping
    };

    connectionPromises[domain] = mongoose
      .createConnection(databaseUrl, options)
      .asPromise()
      .then((conn) => {
        conn.databaseUrl = databaseUrl;
        dbConnections[domain] = conn;
        delete connectionPromises[domain];
        console.log(`[DB_CONNECTED] Successfully connected for tenant: "${domain}"`);

        // Handle disconnections gracefully with auto-reconnect
        conn.on("disconnected", () => {
          console.warn(`[DB_LOST] Connection lost for tenant "${domain}". ReadyState: ${conn.readyState}. Scheduling reconnect...`);
          delete dbConnections[domain];
          setTimeout(() => {
            ensureTenantConnection(domain, databaseUrl).catch((err) => {
              console.error(`[DB_RECONNECT_ERROR] ${err.message}`);
            });
          }, 3000);
        });

        conn.on("error", (err) => {
          console.error(`[DB_SOCKET_ERROR] Tenant "${domain}":`, err.message);
        });

        // Start background keepalive ping once
        startKeepAlive();

        ensureInitialCloudClone(conn)
          .then(() => ensureDefaultOfflineAccounts(conn))
          .catch(() => {});

        return conn;
      })
      .catch((err) => {
        console.error(`[DB_ERROR] Failed connection for tenant: "${domain}"`, err.message);
        delete connectionPromises[domain];
        throw err;
      });
  }

  return connectionPromises[domain];
}

/**
 * KeepAlive Heartbeat: Pings all active connections every 25 seconds
 * Prevents OS socket sleep, idle disconnects, and ensures readyState stays 1.
 */
function startKeepAlive() {
  if (keepAliveStarted) return;
  keepAliveStarted = true;

  setInterval(async () => {
    for (const domain of Object.keys(dbConnections)) {
      const conn = dbConnections[domain];
      if (conn && conn.readyState === 1 && conn.db) {
        try {
          await conn.db.command({ ping: 1 });
        } catch (err) {
          console.warn(`[DB_PING_FAIL] Tenant "${domain}":`, err.message);
        }
      }
    }
  }, 25000);
}

module.exports = {
  getMongooseConnection,
  setMongooseConnection,
  getConnectedTenantNames,
  isTenantConnected,
  ensureTenantConnection
};
