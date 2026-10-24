/* 构建：data.json + template.html → index.html（自包含单文件）
   用法：node build.mjs
        node build.mjs --check    只校验数据，不写文件 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const CHECK = process.argv.includes('--check');

const data = JSON.parse(fs.readFileSync(path.join(here, 'data.json'), 'utf8'));
const tpl = fs.readFileSync(path.join(here, 'template.html'), 'utf8');

/* ---------- 校验 ---------- */
const errors = [];
const ids = new Set();
if (!Array.isArray(data.papers)) errors.push('papers 必须是数组');
for (const p of data.papers || []) {
  if (!p.id) errors.push('卷子缺 id：' + JSON.stringify(p.title));
  if (ids.has(p.id)) errors.push('卷子 id 重复：' + p.id);
  ids.add(p.id);
  for (const q of p.questions || []) {
    if (!q.no) errors.push(p.id + ' 有题缺 no');
    if (typeof q.ok !== 'boolean') errors.push(p.id + '#' + q.no + ' 的 ok 必须是 true/false');
    if (!q.ok && (!q.ans || !q.yours)) errors.push(p.id + '#' + q.no + ' 错题缺 ans/yours');
  }
}
for (const w of data.words || []) if (!w.w || !w.zh) errors.push('生词缺 w/zh：' + JSON.stringify(w));

const stat = {
  papers: (data.papers || []).length,
  questions: (data.papers || []).reduce((n, p) => n + (p.questions || []).length, 0),
  wrong: (data.papers || []).reduce((n, p) => n + (p.questions || []).filter(q => !q.ok).length, 0),
  words: (data.words || []).length,
};

if (errors.length) {
  console.error('数据有问题：\n  ' + errors.join('\n  '));
  process.exit(1);
}
console.log(`数据校验通过：${stat.papers} 套 / ${stat.questions} 题（错 ${stat.wrong}）/ ${stat.words} 词`);

if (CHECK) process.exit(0);

/* ---------- 生成 ---------- */
data.meta = data.meta || {};
data.meta.updated = data.meta.updated || new Date().toISOString().slice(0, 10);

const html = tpl.replace('__DATA_JSON__', JSON.stringify(data));
if (html === tpl) { console.error('模板里没有 __DATA_JSON__ 占位符'); process.exit(1); }

const out = path.join(here, 'index.html');
fs.writeFileSync(out, html, 'utf8');
console.log('已生成 index.html  ' + (fs.statSync(out).size / 1024).toFixed(1) + ' KB');
