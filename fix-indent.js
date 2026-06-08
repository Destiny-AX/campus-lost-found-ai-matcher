const fs = require('fs');
const path = 'd:\\Trae_Solo_Project\\拾寻\\api\\records.js';
let content = fs.readFileSync(path, 'utf-8');

// 修复所有缩进错误的 visualSeed 行
content = content.replace(/^(\s+)visualSeed:/gm, (match, indent) => {
  // 如果缩进超过4个空格，修复为4个空格
  if (indent.length > 4) {
    return '    visualSeed:';
  }
  return match;
});

fs.writeFileSync(path, content);
console.log('Fixed visualSeed indentation');
