const fs = require('fs');
let content = fs.readFileSync('app/page.tsx', 'utf8');

content = content.replace(/sky-/g, 'blue-');
content = content.replace(/emerald-/g, 'green-');
content = content.replace(/rose-/g, 'red-');
content = content.replace(/yellow-/g, 'yellow-'); // just in case
content = content.replace(/bg-gradient-to-br from-green-50 via-yellow-50 to-blue-50/g, 'bg-slate-50');
content = content.replace(/bg-gradient-to-tr from-blue-400 to-green-400/g, 'bg-blue-600');
content = content.replace(/bg-gradient-to-r from-blue-400 to-green-400/g, 'bg-blue-600');
content = content.replace(/hover:from-blue-500 hover:to-green-500/g, 'hover:bg-blue-700');
content = content.replace(/bg-gradient-to-r from-red-400 to-orange-400/g, 'bg-red-600');
content = content.replace(/hover:from-red-500 hover:to-orange-500/g, 'hover:bg-red-700');
content = content.replace(/text-transparent bg-clip-text bg-gradient-to-r from-blue-500 to-green-500/g, 'text-blue-600');

fs.writeFileSync('app/page.tsx', content);
