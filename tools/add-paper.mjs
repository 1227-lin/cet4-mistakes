/* 把一份识别结果并入 data.json，然后重新构建
   用法：node tools/add-paper.mjs 收件箱/2024-12-2.json [--force]

   文件格式（一份卷子）：
   {
     "id": "2024-12-2",
     "title": "2024年12月 · 第二套",
     "date": "2024-12-14",
     "scope": "Part III 阅读 26–55",
     "note": "听力未作答",
     "questions": [ { "no":"26","sec":"A","yours":"N","ans":"N","ok":true,"brief":"…" }, … ],
     "words": [ { "w":"emerge","pos":"v.","zh":"出现","eg":"…<em>emerge</em>…","tag":"仔细阅读" } ]
   }
*/
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(here, '..');
const DATA = path.join(ROOT, 'data.json');

const file = process.argv[2];
const FORCE = process.argv.includes('--force');
if (!file) { console.error('用法：node tools/add-paper.mjs <paper.json> [--force]'); process.exit(1); }

const raw = JSON.parse(fs.readFileSync(file, 'utf8'));
const paper = raw.paper || raw;            // 允许直接传卷子对象
const words = raw.words || paper.words || [];

if (!paper.id || !paper.title || !Array.isArray(paper.questions)) {
  console.error('缺少 id / title / questions');
  process.exit(1);
}

const data = JSON.parse(fs.readFileSync(DATA, 'utf8'));
data.papers = data.papers || [];
data.words = data.words || [];
data.pending = (data.pending || []).filter(x => (x.id || x.file) !== paper.id);

const idx = data.papers.findIndex(p => p.id === paper.id);
if (idx >= 0 && !FORCE) {
  console.error('已存在同 id 卷子：' + paper.id + '（要覆盖加 --force）');
  process.exit(1);
}

paper.words = undefined;
if (idx >= 0) data.papers.splice(idx, 1, paper); else data.papers.push(paper);
data.papers.sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));

let added = 0, skipped = 0;
const have = new Set(data.words.map(w => w.w));
for (const w of words) {
  if (!w.w || !w.zh) { skipped++; continue; }
  if (have.has(w.w)) { skipped++; continue; }
  data.words.push(w); have.add(w.w); added++;
}
data.words.sort((a, b) => a.w.localeCompare(b.w));
data.meta = data.meta || {};
data.meta.updated = new Date().toISOString().slice(0, 10);

fs.writeFileSync(DATA, JSON.stringify(data, null, 2) + '\n', 'utf8');
console.log(`已并入《${paper.title}》：${paper.questions.length} 题（错 ${paper.questions.filter(q => !q.ok).length}），新增生词 ${added}（跳过重复 ${skipped}）`);

execFileSync(process.execPath, [path.join(ROOT, 'build.mjs')], { stdio: 'inherit', cwd: ROOT });
