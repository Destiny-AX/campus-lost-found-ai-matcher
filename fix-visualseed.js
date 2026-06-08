const fs = require('fs');
const path = 'd:\\Trae_Solo_Project\\拾寻\\api\\records.js';
let content = fs.readFileSync(path, 'utf-8');

// 修复所有 visualSeed 行：确保前面有换行和正确缩进
content = content.replace(/\},\r\n    visualSeed:/g, '\},\n    visualSeed:');

fs.writeFileSync(path, content);
console.log('Fixed visualSeed newlines');
