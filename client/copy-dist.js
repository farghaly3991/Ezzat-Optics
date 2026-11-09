import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const srcDir = path.join(__dirname, 'dist');
const targetDir = path.join(__dirname, '..', 'server', 'dist');

try {
  if (fs.existsSync(srcDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
    fs.cpSync(srcDir, targetDir, { recursive: true });
    console.log('[BUILD_SYNC] Successfully copied client/dist -> server/dist!');
  }
} catch (err) {
  console.error('[BUILD_SYNC_ERROR]', err.message);
}
