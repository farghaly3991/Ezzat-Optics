/**
 * Optics Store — Electron main process (offline desktop edition).
 *
 * Boot sequence:
 *   1. Show splash window.
 *   2. Start the embedded MongoDB (mongod.exe) on a private local port,
 *      storing data under %APPDATA%/Optics Store/db.
 *   3. Fork the existing Express server (../server/server.js) with env vars
 *      pointing it at the local database (no server code fork needed).
 *   4. Wait for /api/health, then open the main window on http://127.0.0.1:<port>.
 *   5. On quit: stop the server, then shut MongoDB down gracefully.
 */

const { app, BrowserWindow, dialog, shell, Menu } = require("electron");
const { checkForUpdates } = require("./updater");
const { spawn, fork } = require("child_process");
const path = require("path");
const fs = require("fs");
const net = require("net");
const http = require("http");
const crypto = require("crypto");

const APP_PORT = 47800; // fixed so the UI origin (and localStorage sessions) stays stable
const MONGO_PORT = 27027; // private port, never the default 27017
const DB_NAME = "ezzat_optics_desktop";

const isDev = !app.isPackaged;
const resourcesDir = isDev ? __dirname : process.resourcesPath;
const serverDir = isDev ? path.join(__dirname, "..", "server") : path.join(resourcesDir, "server");
const mongodPath = isDev
  ? path.join(__dirname, "vendor", "mongodb", "mongod.exe")
  : path.join(resourcesDir, "mongodb", "mongod.exe");
const iconPath = path.join(__dirname, "assets", "icon.png");

// Cloud URI default for syncing when online
const CLOUD_DB = "mongodb+srv://farweb2data:farweb2data_3991@farweb2data.3kjihsz.mongodb.net/optics_store_system?appName=farweb";

const userData = app.getPath("userData");
const dbDir = path.join(userData, "db");
const logsDir = path.join(userData, "logs");
const uploadsDir = path.join(userData, "uploads");
const configPath = path.join(userData, "config.json");

let splashWindow = null;
let mainWindow = null;
let mongoProc = null;
let serverProc = null;
let isQuitting = false;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function ensureDirs() {
  for (const dir of [dbDir, logsDir, uploadsDir]) fs.mkdirSync(dir, { recursive: true });
}

/** Per-install config (JWT secrets are generated once, never shipped in the installer). */
function loadConfig() {
  let cfg = {};
  try {
    cfg = JSON.parse(fs.readFileSync(configPath, "utf8"));
  } catch (_) {
    /* first run */
  }
  let changed = false;
  if (!cfg.jwtSecret) {
    cfg.jwtSecret = crypto.randomBytes(48).toString("hex");
    changed = true;
  }
  if (!cfg.jwtSecretAdmin) {
    cfg.jwtSecretAdmin = crypto.randomBytes(48).toString("hex");
    changed = true;
  }
  if (changed) fs.writeFileSync(configPath, JSON.stringify(cfg, null, 2));
  return cfg;
}

function waitForPort(port, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  return new Promise((resolve, reject) => {
    const attempt = () => {
      const socket = net.connect(port, "127.0.0.1");
      socket.once("connect", () => {
        socket.destroy();
        resolve();
      });
      socket.once("error", () => {
        socket.destroy();
        if (Date.now() > deadline) reject(new Error(`Timeout waiting for port ${port}`));
        else setTimeout(attempt, 300);
      });
    };
    attempt();
  });
}

function isPortFree(port) {
  return new Promise((resolve) => {
    const tester = net
      .createServer()
      .once("error", () => resolve(false))
      .once("listening", () => tester.close(() => resolve(true)))
      .listen(port, "127.0.0.1");
  });
}

function waitForHealth(timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  return new Promise((resolve, reject) => {
    const attempt = () => {
      const req = http.get({ host: "127.0.0.1", port: APP_PORT, path: "/api/health", timeout: 3000 }, (res) => {
        let body = "";
        res.on("data", (c) => (body += c));
        res.on("end", () => {
          try {
            if (JSON.parse(body).dbReady) return resolve();
          } catch (_) {
            /* not ready */
          }
          retry();
        });
      });
      req.on("error", retry);
      req.on("timeout", () => req.destroy());
    };
    const retry = () => {
      if (Date.now() > deadline) reject(new Error("Server did not become healthy in time"));
      else setTimeout(attempt, 500);
    };
    attempt();
  });
}

function setSplashStatus(text) {
  if (splashWindow && !splashWindow.isDestroyed()) {
    splashWindow.webContents
      .executeJavaScript(`window.setStatus && window.setStatus(${JSON.stringify(text)})`)
      .catch(() => {});
  }
}

// ---------------------------------------------------------------------------
// MongoDB
// ---------------------------------------------------------------------------

async function startMongo() {
  if (!fs.existsSync(mongodPath)) {
    throw new Error(`mongod.exe not found at:\n${mongodPath}\n\nRun "npm run fetch-mongo" inside the desktop folder.`);
  }
  if (!(await isPortFree(MONGO_PORT))) {
    // A previous instance may still be shutting down; reuse it if it answers.
    return;
  }

  mongoProc = spawn(
    mongodPath,
    [
      "--dbpath", dbDir,
      "--port", String(MONGO_PORT),
      "--bind_ip", "127.0.0.1",
      "--logpath", path.join(logsDir, "mongod.log"),
      "--logappend"
    ],
    { windowsHide: true, stdio: "ignore" }
  );
  mongoProc.on("exit", (code) => {
    mongoProc = null;
    if (!isQuitting) {
      dialog.showErrorBox("Ezzat Optics", `قاعدة البيانات توقفت بشكل غير متوقع (code ${code}).\nراجع: ${path.join(logsDir, "mongod.log")}`);
    }
  });

  await waitForPort(MONGO_PORT, 30000);
}

async function stopMongo() {
  if (!mongoProc) return;
  const proc = mongoProc;
  const exited = new Promise((resolve) => proc.once("exit", resolve));

  try {
    // Graceful shutdown through the driver that already ships with the server.
    const { MongoClient } = require(path.join(serverDir, "node_modules", "mongodb"));
    const client = new MongoClient(`mongodb://127.0.0.1:${MONGO_PORT}`, { serverSelectionTimeoutMS: 2000 });
    await client.connect();
    await client.db("admin").command({ shutdown: 1 }).catch(() => {}); // connection drops = success
    await client.close().catch(() => {});
  } catch (err) {
    console.error("[mongo] graceful shutdown failed:", err.message);
  }

  const timeout = new Promise((resolve) => setTimeout(resolve, 10000, "timeout"));
  if ((await Promise.race([exited, timeout])) === "timeout") proc.kill();
}

// ---------------------------------------------------------------------------
// Express server
// ---------------------------------------------------------------------------

async function startServer(cfg) {
  if (!(await isPortFree(APP_PORT))) {
    throw new Error(`المنفذ ${APP_PORT} مستخدم بالفعل. أغلق أي نسخة أخرى من البرنامج ثم أعد المحاولة.`);
  }

  const serverLog = fs.createWriteStream(path.join(logsDir, "server.log"), { flags: "a" });

  serverProc = fork(path.join(serverDir, "server.js"), [], {
    cwd: serverDir,
    stdio: ["ignore", "pipe", "pipe", "ipc"],
    env: {
      ...process.env,
      NODE_ENV: "production",
      PORT: String(APP_PORT),
      DESKTOP_MODE: "1",
      DEFAULT_DB: `mongodb://127.0.0.1:${MONGO_PORT}/${DB_NAME}`,
      CLOUD_DB_URI: CLOUD_DB,
      UPLOADS_DIR: uploadsDir,
      JWT_SECRET: cfg.jwtSecret,
      JWT_SECRET_ADMIN: cfg.jwtSecretAdmin,
      // Optional online features (filled later from the in-app Settings screen)
      ...(cfg.aiApiKey ? { AI_API_KEY: cfg.aiApiKey } : {}),
      ...(cfg.aiBaseUrl ? { AI_BASE_URL: cfg.aiBaseUrl } : {}),
      ...(cfg.aiModel ? { AI_MODEL: cfg.aiModel } : {}),
      ...(cfg.geminiApiKey ? { GEMINI_API_KEY: cfg.geminiApiKey } : {})
    }
  });
  serverProc.stdout.pipe(serverLog);
  serverProc.stderr.pipe(serverLog);
  serverProc.on("exit", (code) => {
    serverProc = null;
    if (!isQuitting) {
      dialog.showErrorBox("Ezzat Optics", `السيرفر الداخلي توقف (code ${code}).\nراجع: ${path.join(logsDir, "server.log")}`);
    }
  });

  await waitForHealth(60000);
}

function stopServer() {
  if (!serverProc) return Promise.resolve();
  const proc = serverProc;
  return new Promise((resolve) => {
    const t = setTimeout(() => {
      proc.kill("SIGKILL");
      resolve();
    }, 5000);
    proc.once("exit", () => {
      clearTimeout(t);
      resolve();
    });
    proc.kill();
  });
}

// ---------------------------------------------------------------------------
// Windows
// ---------------------------------------------------------------------------

function createSplash() {
  splashWindow = new BrowserWindow({
    width: 420,
    height: 320,
    frame: false,
    resizable: false,
    transparent: false,
    alwaysOnTop: true,
    show: false,
    icon: iconPath,
    backgroundColor: "#1e1b4b",
    webPreferences: { contextIsolation: true }
  });
  splashWindow.loadFile(path.join(__dirname, "splash.html"));
  splashWindow.once("ready-to-show", () => splashWindow.show());
}

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1366,
    height: 860,
    minWidth: 1024,
    minHeight: 640,
    show: false,
    title: "Ezzat Optics",
    icon: iconPath,
    backgroundColor: "#ffffff",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  // External links open in the default browser, not inside the app.
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (!url.startsWith(`http://127.0.0.1:${APP_PORT}`)) {
      shell.openExternal(url);
      return { action: "deny" };
    }
    return { action: "allow" };
  });

  mainWindow.loadURL(`http://127.0.0.1:${APP_PORT}/admin/overview`);
  mainWindow.once("ready-to-show", () => {
    if (splashWindow && !splashWindow.isDestroyed()) splashWindow.close();
    mainWindow.maximize();
    mainWindow.show();

    // Check for online updates silently after 6 seconds
    setTimeout(() => {
      checkForUpdates(app.getVersion(), mainWindow, false);
    }, 6000);
  });
}

// ---------------------------------------------------------------------------
// Lifecycle
// ---------------------------------------------------------------------------

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  app.whenReady().then(async () => {
    if (!isDev) Menu.setApplicationMenu(null);
    createSplash();
    try {
      ensureDirs();
      const cfg = loadConfig();
      setSplashStatus("تشغيل قاعدة البيانات...");
      await startMongo();
      setSplashStatus("تشغيل النظام...");
      await startServer(cfg);
      setSplashStatus("فتح الواجهة...");
      createMainWindow();
    } catch (err) {
      dialog.showErrorBox("Ezzat Optics — خطأ في التشغيل", err.message);
      await shutdown();
      app.exit(1);
    }
  });

  app.on("window-all-closed", () => app.quit());

  app.on("before-quit", async (event) => {
    if (isQuitting) return;
    event.preventDefault();
    await shutdown();
    app.exit(0);
  });
}

async function shutdown() {
  isQuitting = true;
  await stopServer();
  await stopMongo();
}
