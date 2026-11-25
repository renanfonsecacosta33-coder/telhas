const fs = require('fs');
const path = require('path');

const files = [];
function walk(d) {
  for (const f of fs.readdirSync(d)) {
    const p = path.join(d, f);
    if (fs.statSync(p).isDirectory()) walk(p);
    else if (/\.(jsx?|tsx?)$/.test(f)) files.push(p);
  }
}
walk('src');

const rows = [];
let totalPolling = 0;
const intervals = {};
for (const p of files) {
  const c = fs.readFileSync(p, 'utf8');
  const lines = c.split('\n').length;
  const useQ = (c.match(/useQuery\s*\(/g) || []).length;
  const refetch = [...c.matchAll(/refetchInterval\s*:\s*([^,\n}]+)/g)].map(m => m[1].trim());
  const listAll = (c.match(/\.list\(\s*\)/g) || []).length;
  const bigLimits = [...c.matchAll(/,\s*(\d{3,5})\s*\)/g)].map(m => +m[1]).filter(n => n >= 500);
  const subs = (c.match(/\.subscribe\(/g) || []).length;
  const setInt = (c.match(/setInterval\(/g) || []).length;
  const filterNoArgs = (c.match(/\.filter\(\s*\{\s*\}\s*/g) || []).length;
  refetch.forEach(r => { intervals[r] = (intervals[r] || 0) + 1; });
  totalPolling += refetch.length;
  if (useQ || refetch.length || listAll || bigLimits.length || subs || setInt || lines > 1500) {
    rows.push({ file: p.replace(/\\/g, '/'), lines, useQ, polling: refetch.length, refetch: refetch.join('|'), listAll, bigLimits: bigLimits.join(','), subs, setInt, filterAll: filterNoArgs });
  }
}

rows.sort((a, b) => (b.polling * 3 + b.useQ + b.listAll * 2 + b.bigLimits.split(',').filter(Boolean).length) - (a.polling * 3 + a.useQ + a.listAll * 2 + a.bigLimits.split(',').filter(Boolean).length));
console.log('TOTAL refetchInterval:', totalPolling);
console.log('Interval distribution:', JSON.stringify(intervals));
console.log('file | lines | useQuery | polling | intervals | list() | limits>=500 | subscribe | setInterval | filter({})');
rows.slice(0, 60).forEach(r => console.log(`${r.file} | ${r.lines} | ${r.useQ} | ${r.polling} | ${r.refetch} | ${r.listAll} | ${r.bigLimits} | ${r.subs} | ${r.setInt} | ${r.filterAll}`));

// Big files
console.log('\nLARGEST FILES:');
files.map(p => ({ p, n: fs.readFileSync(p, 'utf8').split('\n').length })).sort((a, b) => b.n - a.n).slice(0, 15).forEach(x => console.log(x.n, x.p));

// App.jsx lazy vs eager
const app = fs.readFileSync('src/App.jsx', 'utf8');
console.log('\nApp.jsx lazy imports:', (app.match(/lazy\(/g) || []).length, '| eager page imports:', (app.match(/^import \w+ from ['"]@\/pages/gm) || []).length);

// Global layout polling (runs on every page)
for (const f of ['src/components/layout/AppLayout.jsx','src/components/layout/EcosystemHeaderBar.jsx','src/components/NotificationBell.jsx','src/hooks/useUnreadMessages.js','src/hooks/useUnreadMessages.jsx','src/components/ai/AjlCopilot.jsx','src/contexts/FilialContext.jsx','src/contexts/OfflineContext.jsx','src/lib/rateLimiter.js','src/components/layout/Sidebar.jsx','src/components/FilialSwitcher.jsx']) {
  if (!fs.existsSync(f)) continue;
  const c = fs.readFileSync(f, 'utf8');
  console.log('GLOBAL', f, 'useQuery:', (c.match(/useQuery\s*\(/g) || []).length, 'refetch:', [...c.matchAll(/refetchInterval\s*:\s*([^,\n}]+)/g)].map(m => m[1].trim()).join('|'), 'setInterval:', (c.match(/setInterval\(/g) || []).length, 'subscribe:', (c.match(/\.subscribe\(/g) || []).length);
}
