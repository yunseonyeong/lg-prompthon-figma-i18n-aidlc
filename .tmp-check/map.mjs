import fs from 'fs';
const flat=(o,p='')=>Object.entries(o).reduce((a,[k,v])=>{const K=p?p+'.'+k:k;return typeof v==='object'&&v?{...a,...flat(v,K)}:{...a,[K]:v}},{});
const en = flat(JSON.parse(fs.readFileSync('src/locales/en.json','utf-8')));
const keys = Object.keys(en);
const files = ['src/components/steps/StepPreview.tsx','src/components/steps/StepCodeGen.tsx'];

const old = new Set();
for (const f of files) {
  for (const m of fs.readFileSync(f,'utf-8').matchAll(/signage\.setting\.group\.[a-z]+\.[a-z0-9_]+/g)) old.add(m[0]);
}

// snake_case / 소문자 압축형 → 현재 camelCase 키 후보 찾기
const norm = s => s.replace(/[^a-z0-9]/gi,'').toLowerCase();
const byNorm = new Map();
for (const k of keys) {
  const id = k.split('.').slice(-1)[0];
  const role = k.split('.').slice(-2)[0];
  byNorm.set(role + '|' + norm(id), k);
}

const mapping = {}; const missing = [];
for (const o of [...old].sort()) {
  const parts = o.split('.');
  const role = parts[3], id = parts.slice(4).join('.');
  const hit = byNorm.get(role + '|' + norm(id));
  if (hit) mapping[o] = hit; else missing.push(o);
}
console.log(`구 키 ${old.size}종 / 매핑 성공 ${Object.keys(mapping).length} / 실패 ${missing.length}\n`);
for (const [o,n] of Object.entries(mapping)) console.log(`  ${o.padEnd(52)} → ${n}`);
if (missing.length) { console.log('\n❌ 대응 키 없음:'); missing.forEach(m=>console.log('  '+m)); }
fs.writeFileSync('.tmp-check/mapping.json', JSON.stringify(mapping,null,2));
