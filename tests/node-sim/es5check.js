var acorn = require('acorn'), fs = require('fs'), path = require('path');
var dir = process.argv[2], bad = 0;
fs.readdirSync(dir).filter(function (f) { return /\.gs$/.test(f); }).sort().forEach(function (f) {
  var src = fs.readFileSync(path.join(dir, f), 'utf8');
  try { acorn.parse(src, { ecmaVersion: 5 }); console.log('ES5 OK   ' + f); }
  catch (e) { bad++; console.log('ES5 FAIL ' + f + ': ' + e.message); }
  // ابحث عن let/const/=>/backticks خارج النصوص بالتوكنز
  try {
    var toks = []; acorn.tokenizer(src, { ecmaVersion: 2020 });
    for (var t of acorn.tokenizer(src, { ecmaVersion: 2020 })) {
      if (t.type.label === '=>' || t.type.label === '`' || t.type.label === 'template' || (t.type.label === 'name' && (t.value === 'let')) || t.type.keyword === 'const' || t.type.keyword === 'class') toks.push(t.type.label + '@' + t.start);
    }
    if (toks.length) { bad++; console.log('  ES6 tokens: ' + toks.join(',')); }
  } catch (e) { console.log('  tokenizer: ' + e.message); }
});
process.exit(bad ? 1 : 0);
