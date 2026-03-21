const fs = require('fs');

const code = fs.readFileSync('src/app/workspace/[workspaceId]/chat/[chatId]/page.jsx', 'utf8');

const openCount = (code.match(/<div(\s|>)/g) || []).length;
const closeCount = (code.match(/<\/div>/g) || []).length;
const selfCloseCount = (code.match(/<div[^>]*\/>/g) || []).length;

console.log(`Total <div: ${openCount}`);
console.log(`Total </div: ${closeCount}`);
console.log(`Total <div />: ${selfCloseCount}`);
console.log(`Difference: ${openCount - closeCount - selfCloseCount}`);

let currentLevel = 0;
const lines = code.split('\n');
for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  
  const o = (line.match(/<div(\s|>)/g) || []).length;
  const c = (line.match(/<\/div>/g) || []).length;
  const sc = (line.match(/<div[^>]*\/>/g) || []).length;
  currentLevel += o - c - sc;
  if(currentLevel < 0 && o===0 && c>0) {
    console.log(`Below zero at line ${i+1}`);
  }
}
