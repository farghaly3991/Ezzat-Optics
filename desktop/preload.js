/**
 * Preload — exposes a minimal, safe flag so the React UI can detect the desktop edition
 * (e.g. to show the "Sync & AI" settings screen later).
 */
const { contextBridge } = require("electron");

contextBridge.exposeInMainWorld("desktop", {
  isDesktop: true,
  platform: process.platform
});
