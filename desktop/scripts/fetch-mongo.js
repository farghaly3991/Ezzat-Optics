/**
 * Downloads the official MongoDB Community zip for Windows and extracts ONLY mongod.exe
 * into desktop/vendor/mongodb/ (that's all the desktop app needs at runtime).
 *
 * Usage:  npm run fetch-mongo            (default version below)
 *         MONGO_VERSION=4.4.29 npm run fetch-mongo   (e.g. for very old CPUs without AVX)
 */
const https = require("https");
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const VERSION = process.env.MONGO_VERSION || "7.0.14";
const URL = `https://downloads.mongodb.org/windows/mongodb-windows-x86_64-${VERSION}.zip`;
const vendorDir = path.join(__dirname, "..", "vendor");
const outDir = path.join(vendorDir, "mongodb");
const zipPath = path.join(vendorDir, `mongodb-${VERSION}.zip`);

function download(url, dest) {
  return new Promise((resolve, reject) => {
    https
      .get(url, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          res.resume();
          return download(res.headers.location, dest).then(resolve, reject);
        }
        if (res.statusCode !== 200) return reject(new Error(`HTTP ${res.statusCode} for ${url}`));
        const total = Number(res.headers["content-length"]) || 0;
        let done = 0;
        let lastPct = -1;
        const file = fs.createWriteStream(dest);
        res.on("data", (chunk) => {
          done += chunk.length;
          const pct = total ? Math.floor((done / total) * 100) : 0;
          if (pct % 10 === 0 && pct !== lastPct) {
            lastPct = pct;
            console.log(`  ${pct}% (${(done / 1048576).toFixed(0)} MB)`);
          }
        });
        res.pipe(file);
        file.on("finish", () => file.close(resolve));
        file.on("error", reject);
      })
      .on("error", reject);
  });
}

(async () => {
  fs.mkdirSync(outDir, { recursive: true });
  const target = path.join(outDir, "mongod.exe");
  if (fs.existsSync(target)) {
    console.log(`mongod.exe already present: ${target}`);
    bundleVcRuntime();
    return;
  }

  if (!fs.existsSync(zipPath)) {
    console.log(`Downloading MongoDB ${VERSION} ...\n  ${URL}`);
    try {
      // curl.exe ships with Windows 10+; retries and resumes on flaky connections.
      execFileSync(
        "curl.exe",
        ["-L", "--fail", "--retry", "20", "--retry-all-errors", "--retry-delay", "3", "-C", "-", "-o", zipPath + ".part", URL],
        { stdio: "inherit" }
      );
    } catch (curlErr) {
      console.warn("curl.exe failed, falling back to Node https:", curlErr.message);
      await download(URL, zipPath + ".part");
    }
    fs.renameSync(zipPath + ".part", zipPath);
  }

  console.log("Extracting mongod.exe ...");
  const ps = `
    Add-Type -AssemblyName System.IO.Compression.FileSystem
    $zip = [System.IO.Compression.ZipFile]::OpenRead('${zipPath.replace(/'/g, "''")}')
    try {
      $entries = $zip.Entries | Where-Object { $_.FullName -match '/bin/[^/]+\\.(exe|dll)$' -and $_.Name -notmatch '^(mongos|install_compass|mongo)\\.' }
      foreach ($e in $entries) {
        [System.IO.Compression.ZipFileExtensions]::ExtractToFile($e, (Join-Path '${outDir.replace(/'/g, "''")}' $e.Name), $true)
        Write-Output ("  " + $e.Name)
      }
    } finally { $zip.Dispose() }`;
  console.log(execFileSync("powershell", ["-NoProfile", "-Command", ps], { encoding: "utf8" }));

  if (!fs.existsSync(target)) throw new Error("mongod.exe was not found inside the archive");
  fs.unlinkSync(zipPath);
  bundleVcRuntime();
  console.log(`Done: ${target}`);
})().catch((err) => {
  console.error("fetch-mongo failed:", err.message);
  process.exit(1);
});

/**
 * mongod.exe links against the VC++ 2015-2022 runtime. Ship those DLLs app-locally
 * (next to mongod.exe) so it starts on clean machines without installing vc_redist.
 */
function bundleVcRuntime() {
  const sys32 = path.join(process.env.SystemRoot || "C:\\Windows", "System32");
  for (const dll of ["msvcp140.dll", "vcruntime140.dll", "vcruntime140_1.dll"]) {
    const src = path.join(sys32, dll);
    if (fs.existsSync(src)) {
      fs.copyFileSync(src, path.join(outDir, dll));
      console.log(`  bundled ${dll}`);
    } else {
      console.warn(`  WARNING: ${dll} not found in System32 (install vc_redist.x64 on the build machine)`);
    }
  }
  const redist = path.join(outDir, "vc_redist.x64.exe");
  if (fs.existsSync(redist)) fs.unlinkSync(redist);
}
