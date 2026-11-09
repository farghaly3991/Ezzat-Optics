/**
 * Creates a lightweight patch.zip (~5MB) containing only the updated:
 * 1. client/dist (bundled React app)
 * 2. server/core and server/modules (business logic & routes)
 *
 * This patch is uploaded to GitHub Releases for instant silent auto-updating!
 */

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const rootDir = path.join(__dirname, '..', '..');
const desktopDir = path.join(__dirname, '..');
const outPatch = path.join(desktopDir, 'release', 'patch.zip');
const tempPatchDir = path.join(desktopDir, 'release', 'temp-patch');

async function buildPatch() {
  console.log('[PATCH_BUILDER] Starting lightweight patch generation...');

  fs.mkdirSync(path.join(desktopDir, 'release'), { recursive: true });
  fs.rmSync(tempPatchDir, { recursive: true, force: true });
  fs.mkdirSync(tempPatchDir, { recursive: true });

  // 1. Copy client/dist -> temp-patch/dist
  const clientDist = path.join(rootDir, 'client', 'dist');
  if (fs.existsSync(clientDist)) {
    console.log('[PATCH_BUILDER] Bundling client/dist...');
    fs.cpSync(clientDist, path.join(tempPatchDir, 'dist'), { recursive: true });
  }

  // 2. Copy server/core and server/modules -> temp-patch
  console.log('[PATCH_BUILDER] Bundling server core & modules...');
  fs.cpSync(path.join(rootDir, 'server', 'core'), path.join(tempPatchDir, 'core'), { recursive: true });
  fs.cpSync(path.join(rootDir, 'server', 'modules'), path.join(tempPatchDir, 'modules'), { recursive: true });
  fs.copyFileSync(path.join(rootDir, 'server', 'server.js'), path.join(tempPatchDir, 'server.js'));

  // 3. Compress to patch.zip using PowerShell
  console.log('[PATCH_BUILDER] Compressing to patch.zip...');
  if (fs.existsSync(outPatch)) fs.unlinkSync(outPatch);

  const ps = `
    Add-Type -AssemblyName System.IO.Compression.FileSystem;
    [System.IO.Compression.ZipFile]::CreateFromDirectory('${tempPatchDir.replace(/'/g, "''")}', '${outPatch.replace(/'/g, "''")}', [System.IO.Compression.CompressionLevel]::Optimal, $false);
  `;

  execFileSync('powershell', ['-NoProfile', '-Command', ps]);
  fs.rmSync(tempPatchDir, { recursive: true, force: true });

  const stats = fs.statSync(outPatch);
  console.log(`[PATCH_BUILDER] ✅ Done! patch.zip created successfully: ${(stats.size / 1048576).toFixed(2)} MB`);
  console.log(`[PATCH_BUILDER] Location: ${outPatch}`);
}

buildPatch().catch(e => {
  console.error('[PATCH_BUILDER_ERROR]', e.message);
  process.exit(1);
});
