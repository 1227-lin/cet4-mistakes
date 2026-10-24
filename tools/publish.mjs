/* 发布到 GitHub Pages（纯 Node，走 REST API，不需要 git）
   用法：node tools/publish.mjs [--repo cet4-mistakes]
   token 来源：tools/gh-token.txt 或环境变量 GH_TOKEN
*/
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const here = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(here, '..');
const API = 'https://api.github.com';

const argRepo = process.argv.indexOf('--repo');
const REPO = argRepo > -1 ? process.argv[argRepo + 1] : 'cet4-mistakes';

let token = process.env.GH_TOKEN || '';
const tf = path.join(here, 'gh-token.txt');
if (!token && fs.existsSync(tf)) token = fs.readFileSync(tf, 'utf8').trim();
if (!token) {
  console.error('没有 token。先把 classic token 存到 tools/gh-token.txt，或设置 GH_TOKEN。');
  process.exit(1);
}

const H = {
  authorization: 'Bearer ' + token,
  accept: 'application/vnd.github+json',
  'x-github-api-version': '2022-11-28',
  'user-agent': 'cet4-mistakes',
};

async function call(method, p, body) {
  const res = await fetch(API + p, {
    method,
    headers: { ...H, ...(body ? { 'content-type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const txt = await res.text();
  let json = null;
  try { json = txt ? JSON.parse(txt) : null; } catch { json = txt; }
  if (!res.ok) {
    const msg = (json && (json.message || json.error)) || txt.slice(0, 200);
    const err = new Error(`${method} ${p} → ${res.status} ${msg}`);
    err.status = res.status;
    throw err;
  }
  return json;
}

/* 1. 本地构建 */
console.log('[1/6] 本地构建');
execFileSync(process.execPath, [path.join(ROOT, 'build.mjs')], { stdio: 'inherit', cwd: ROOT });

/* 2. 验证 token */
console.log('[2/6] 验证 token');
const me = await call('GET', '/user');
const owner = me.login;
console.log('      ' + owner + (me.name ? '（' + me.name + '）' : ''));

/* 3. 仓库 */
console.log('[3/6] 仓库 ' + REPO);
let repo;
try {
  repo = await call('POST', '/user/repos', {
    name: REPO,
    description: '四级错题本 · 按卷子归档的错题与生词',
    private: false,
    auto_init: false,
  });
  console.log('      已创建 ' + repo.html_url);
} catch (e) {
  if (e.status === 422) {
    repo = await call('GET', `/repos/${owner}/${REPO}`);
    console.log('      已存在，复用 ' + repo.html_url);
  } else throw e;
}

/* 4. 上传 */
console.log('[4/6] 上传文件');
const FILES = [
  'index.html', 'data.json', 'template.html', 'build.mjs',
  'manifest.json', 'sw.js', 'icon-180.png', 'icon-192.png', 'icon-512.png',
  'README.md', '.gitignore', 'tools/add-paper.mjs', 'tools/publish.mjs',
];
let n = 0;
for (const rel of FILES) {
  const full = path.join(ROOT, rel);
  if (!fs.existsSync(full)) { console.log('      跳过 ' + rel); continue; }
  const content = fs.readFileSync(full).toString('base64');
  let sha = null;
  try { sha = (await call('GET', `/repos/${owner}/${REPO}/contents/${encodeURIComponent(rel)}`)).sha; } catch { }
  const body = { message: `更新 ${rel}`, content };
  if (sha) body.sha = sha;
  await call('PUT', `/repos/${owner}/${REPO}/contents/${encodeURIComponent(rel)}`, body);
  n++;
  console.log('      ✓ ' + rel);
}

/* 5. Pages */
console.log('[5/6] 开启 GitHub Pages');
try {
  await call('POST', `/repos/${owner}/${REPO}/pages`, { source: { branch: 'main', path: '/' } });
  console.log('      已开启');
} catch (e) {
  if (e.status === 409) console.log('      之前已开启');
  else console.log('      ' + e.message);
}

/* 6. 等构建 */
const url = `https://${owner}.github.io/${REPO}/`;
console.log('[6/6] 等 Pages 构建 ' + url);
for (let i = 0; i < 30; i++) {
  await new Promise(r => setTimeout(r, 10000));
  try {
    const st = await call('GET', `/repos/${owner}/${REPO}/pages`);
    console.log('      ' + st.status + '  (' + (i + 1) * 10 + 's)');
    if (st.status === 'built') break;
  } catch { console.log('      构建中…'); }
}

console.log('\n================ 完成 ================');
console.log('仓库： ' + repo.html_url);
console.log('网址： ' + url);
console.log('');
console.log('iPad：Safari 打开网址 → 分享 → 添加到主屏幕 → 从图标打开一次');
