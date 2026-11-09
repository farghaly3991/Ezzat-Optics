/**
 * Ezzat Optics - Dual-Engine GitHub Updater
 * 1. Smart Hot-Patch: Downloads and applies code-only updates (patch.zip ~5MB) instantly in the background.
 * 2. Major Auto-Update: Notifies for full-binary installer upgrades.
 */

const { app, dialog } = require('electron');
const https = require('https');
const fs = require('fs');
const path = require('path');
const { execFile } = require('child_process');

const REPO_OWNER = 'farghaly3991';
const REPO_NAME = 'Ezzat-Optics';
const GITHUB_API_URL = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/releases/latest`;

let isChecking = false;

function compareVersions(v1, v2) {
  const p1 = v1.replace(/^v/, '').split('.').map(Number);
  const p2 = v2.replace(/^v/, '').split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    const a = p1[i] || 0;
    const b = p2[i] || 0;
    if (a > b) return 1;
    if (a < b) return -1;
  }
  return 0;
}

/**
 * Check GitHub for latest release
 */
async function checkForUpdates(currentVersion, mainWindow, isManual = false) {
  if (isChecking) return;
  isChecking = true;

  try {
    const release = await fetchLatestRelease();
    if (!release || !release.tag_name) {
      if (isManual) dialog.showMessageBox(mainWindow, { type: 'info', title: 'Ezzat Optics', message: 'نظامك محدث بالكامل بأحدث إصدار.' });
      return;
    }

    const latestVersion = release.tag_name.replace(/^v/, '');
    const isNewer = compareVersions(latestVersion, currentVersion) > 0;

    if (!isNewer) {
      if (isManual) dialog.showMessageBox(mainWindow, { type: 'info', title: 'Ezzat Optics', message: `أنت تستخدم بالفعل أحدث إصدار (v${currentVersion}).` });
      return;
    }

    console.log(`[UPDATER] New version available: v${latestVersion} (Current: v${currentVersion})`);

    // Check if there is a lightweight patch.zip asset
    const patchAsset = (release.assets || []).find(a => a.name.toLowerCase() === 'patch.zip');

    if (patchAsset) {
      // Hot-Patch Update
      await applyHotPatch(patchAsset.browser_download_url, latestVersion, mainWindow);
    } else {
      // Major Installer Update
      const installerAsset = (release.assets || []).find(a => a.name.endsWith('.exe'));
      if (installerAsset && mainWindow) {
        mainWindow.webContents.send('update-available', {
          version: latestVersion,
          notes: release.body,
          downloadUrl: installerAsset.browser_download_url,
          isMajor: true
        });
      }
    }
  } catch (err) {
    console.log('[UPDATER_INFO] Check for updates skipped (offline or unreachable):', err.message);
  } finally {
    isChecking = false;
  }
}

function fetchLatestRelease() {
  return new Promise((resolve, reject) => {
    const req = https.get(GITHUB_API_URL, {
      headers: { 'User-Agent': 'Ezzat-Optics-Desktop-App' }
    }, (res) => {
      if (res.statusCode === 404) return resolve(null);
      if (res.statusCode !== 200) return reject(new Error(`GitHub HTTP ${res.statusCode}`));
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); } catch (e) { resolve(null); }
      });
    });
    req.on('error', reject);
    req.setTimeout(8000, () => req.destroy());
  });
}

/**
 * Downloads patch.zip and extracts it over resources/server and resources/client
 */
async function applyHotPatch(downloadUrl, version, mainWindow) {
  const isDev = !app.isPackaged;
  const targetServerDir = isDev 
    ? path.join(__dirname, '..', 'server') 
    : path.join(process.resourcesPath, 'server');

  const tempZip = path.join(app.getPath('temp'), `ezzat-patch-${version}.zip`);

  console.log(`[HOT_PATCH] Downloading lightweight patch from ${downloadUrl}...`);
  if (mainWindow) mainWindow.webContents.send('patch-downloading', { version });

  await downloadFile(downloadUrl, tempZip);

  console.log('[HOT_PATCH] Download complete. Extracting patch files...');

  const ps = `
    Add-Type -AssemblyName System.IO.Compression.FileSystem;
    [System.IO.Compression.ZipFile]::ExtractToDirectory('${tempZip.replace(/'/g, "''")}', '${targetServerDir.replace(/'/g, "''")}', $true);
  `;

  execFile('powershell', ['-NoProfile', '-Command', ps], (err) => {
    fs.unlink(tempZip, () => {});
    if (err) {
      console.error('[HOT_PATCH_ERROR] Extraction failed:', err.message);
    } else {
      console.log(`[HOT_PATCH] 🎉 Hot patch v${version} applied successfully!`);
      if (mainWindow) {
        mainWindow.webContents.send('patch-applied', {
          version,
          message: `تم تطبيق التحديث التلقائي (v${version}) بنجاح.`
        });
      }
    }
  });
}

function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return downloadFile(res.headers.location, dest).then(resolve, reject);
      }
      if (res.statusCode !== 200) return reject(new Error(`Download failed with HTTP ${res.statusCode}`));
      const file = fs.createWriteStream(dest);
      res.pipe(file);
      file.on('finish', () => file.close(resolve));
      file.on('error', reject);
    }).on('error', reject);
  });
}

module.exports = { checkForUpdates };
