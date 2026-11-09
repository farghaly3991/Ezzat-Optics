const fs = require('fs');
const path = require('path');

const targetDir = path.resolve(__dirname, '../../client/src');
const newImg = 'https://images.unsplash.com/photo-1591076482161-42ce6da69f68?w=800';

function replaceInDir(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      replaceInDir(fullPath);
    } else if (entry.isFile() && (entry.name.endsWith('.jsx') || entry.name.endsWith('.js'))) {
      let content = fs.readFileSync(fullPath, 'utf8');
      let modified = false;
      if (content.includes('1505740420928-5e560c06d30e')) {
        content = content.replace(/https:\/\/images\.unsplash\.com\/photo-1505740420928-5e560c06d30e[^\'\"]*/g, newImg);
        modified = true;
      }
      if (content.includes('1511707171634-5f897ff02aa9')) {
        content = content.replace(/https:\/\/images\.unsplash\.com\/photo-1511707171634-5f897ff02aa9[^\'\"]*/g, newImg);
        modified = true;
      }
      if (modified) {
        fs.writeFileSync(fullPath, content, 'utf8');
        console.log('Replaced in:', entry.name);
      }
    }
  }
}

replaceInDir(targetDir);
console.log('Finished updating optical fallback images in client/src!');
