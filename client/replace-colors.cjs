const fs = require('fs');
const path = require('path');

const replacements = {
  // Primary
  'bg-blue-600': 'bg-primary',
  'bg-blue-700': 'bg-primary/90',
  'bg-blue-500': 'bg-primary',
  'bg-blue-50': 'bg-primary/5',
  'bg-blue-100': 'bg-primary/10',
  'text-blue-600': 'text-primary',
  'text-blue-700': 'text-primary',
  'text-blue-500': 'text-primary',
  'text-blue-900': 'text-secondary',
  'text-blue-800': 'text-secondary',
  'text-blue-50': 'text-primary',
  'border-blue-600': 'border-primary',
  'border-blue-500': 'border-primary',
  'border-blue-200': 'border-primary/20',
  'border-blue-100': 'border-primary/10',
  'hover:bg-blue-700': 'hover:bg-primary/90',
  'hover:bg-blue-600': 'hover:bg-primary',
  'hover:bg-blue-50': 'hover:bg-primary/5',
  'hover:text-blue-600': 'hover:text-primary',
  'hover:text-blue-700': 'hover:text-primary',
  'hover:border-blue-500': 'hover:border-primary',
  'ring-blue-500': 'ring-primary',
  'ring-blue-600': 'ring-primary',
  'focus:ring-blue-500': 'focus:ring-primary',
  'focus:ring-blue-200': 'focus:ring-primary/30',
  'focus:border-blue-500': 'focus:border-primary',
  'from-blue-600': 'from-primary',
  'from-blue-900': 'from-secondary',
  'from-blue-50': 'from-primary/5',
  'to-blue-700': 'to-primary/90',
  'via-blue-600': 'via-primary',
  'via-indigo-900': 'via-secondary',
  'to-slate-900': 'to-secondary',
  'bg-slate-900': 'bg-secondary',
  'text-slate-900': 'text-secondary',
  'bg-indigo-50': 'bg-primary/5',
  'from-indigo-50': 'from-primary/5',
  'via-indigo-50': 'via-primary/5',
  
  // Accent
  'bg-green-600': 'bg-accent',
  'bg-green-500': 'bg-accent',
  'text-green-600': 'text-accent',
  'text-green-500': 'text-accent',
  'bg-green-50': 'bg-accent/10',
  'border-green-200': 'border-accent/20',

  // Highlight
  'bg-yellow-400': 'bg-highlight',
  'bg-yellow-500': 'bg-highlight',
  'text-yellow-500': 'text-highlight',
  'text-yellow-400': 'text-highlight',

  // Border Radius
  'rounded-2xl': 'rounded-card',
  'rounded-xl': 'rounded-btn'
};

const regexes = Object.keys(replacements).map(key => {
  return {
    regex: new RegExp(`\\b${key}\\b`, 'g'),
    replacement: replacements[key]
  };
});

function processDirectory(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      processDirectory(fullPath);
    } else if (fullPath.endsWith('.jsx')) {
      let content = fs.readFileSync(fullPath, 'utf8');
      let originalContent = content;
      
      for (const { regex, replacement } of regexes) {
        content = content.replace(regex, replacement);
      }
      
      if (content !== originalContent) {
        fs.writeFileSync(fullPath, content, 'utf8');
        console.log(`Updated: ${fullPath}`);
      }
    }
  }
}

processDirectory('d:/dev/multu-tenant-store/client/src/components');
processDirectory('d:/dev/multu-tenant-store/client/src/pages');
console.log('Done!');
