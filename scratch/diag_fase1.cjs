const fs = require('fs');
const path = require('path');
const files = [];
(function walk(d) { for (const f of fs.readdirSync(d)) { const p = path.join(d, f); fs.statSync(p).isDirectory() ? walk(p) : /\.(jsx?|tsx?)$/.test(f) && files.push(p); } })('src');

console.log('=== refetchInterval <= 25000 ===');
for (const p of files) {
  const lines = fs.readFileSync(p, 'utf8').split('\n');
  lines.forEach((l, i) => {
    const m = l.match(/refetchInterval\s*:\s*(\d+)/);
    if (m && +m[1] <= 25000) {
      let key = '';
      for (let k = i; k >= Math.max(0, i - 12); k--) { const km = lines[k].match(/queryKey\s*:\s*(\[[^\]]*\])/); if (km) { key = km[1]; break; } }
      console.log(`${p.replace(/\\/g, '/')}:${i + 1} | ${m[1]} | ${key}`);
    }
  });
}
console.log('\n=== Unread hooks usage ===');
for (const p of files) { const c = fs.readFileSync(p, 'utf8'); if (/useAllUnreadCount|useUnreadCount\(/.test(c) && !p.includes('useUnreadMessages')) console.log(p, (c.match(/use(All)?UnreadCount\([^)]*\)/g) || []).join(' ; ')); }
console.log('\n=== useInvestigacaoBarracoes / investigarBarracoesParaPedidos usage ===');
for (const p of files) { const c = fs.readFileSync(p, 'utf8'); if (/useInvestigacaoBarracoes\(|investigarBarracoesParaPedidos\(/.test(c)) console.log(p, (c.match(/(useInvestigacaoBarracoes|investigarBarracoesParaPedidos)\([^)]*\)/g) || []).join(' ; ')); }
console.log('\n=== Huge limits >= 2000 ===');
for (const p of files) {
  fs.readFileSync(p, 'utf8').split('\n').forEach((l, i) => { const m = l.match(/,\s*(\d{4,5})\s*\)/); if (m && +m[1] >= 2000 && /filter|list/.test(l)) console.log(`${p.replace(/\\/g, '/')}:${i + 1} | ${l.trim().slice(0, 170)}`); });
}
