/* 发布到 GitHub Pages（纯 Node，走 REST API，不需要 git）
   用法：node tools/publish.mjs [--repo cet4-mistakes]
   token 来源：tools/gh-token.txt 或环境变量 GH_TOKEN

   特点：
   - 只上传内容真的变了的文件（用 git blob sha 比对），避免触发 GitHub 二级限流
   - 遇到 403 secondary rate limit 自动退避重试
*/
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
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

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function raw(method, p, body) {
  const res = await fetch(API + p, {
    method,
    headers: { ...H, ...(body ? { 'content-type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const txt = await res.text();
  let json = null;
  try { json = txt ? JSON.parse(txt) : null; } catch { json = txt; }
  return { res, json, txt };
}

async function call(method, p, body, { retry = 3 } = {}) {
  for (let attempt = 1; attempt <= retry; attempt++) {
    const { res, json, txt } = await raw(method, p, body);
    if (res.ok) return json;
    const msg = (json && (json.message || json.error)) || String(txt).slice(0, 200);
    const rate = res.status === 403 && /rate limit/i.test(msg);
    if (rate && attempt < retry) {
      const wait = 45000 * attempt;
      console.log(`      触发限流，${Math.round(wait / 1000)}s 后重试（${attempt}/${retry - 1}）`);
      await sleep(wait);
      continue;
    }
    if (rate) {
      console.error('\nGitHub 限流：' + msg);
      console.error('通常是短时间推送太频繁。已经只上传变化的文件，等 10 分钟左右再跑一次即可。');
      process.exit(2);
    }
    const err = new Error(`${method} ${p} → ${res.status} ${msg}`);
    err.status = res.status;
    throw err;
  }
}

/* git blob sha，用来判断文件在远端是否已是最新 */
function blobSha(buf) {
  const h = crypto.createHash('sha1');
  h.update('blob ' + buf.length + '\0');
  h.update(buf);
  return h.digest('hex');
}

/* 1. 构建 */
console.log('[1/6] 本地构建');
execFileSync(process.execPath, [path.join(ROOT, 'build.mjs')], { stdio: 'inherit', cwd: ROOT });

/* 2. token */
console.log('[2/6] 验证 token');
const me = await call('GET', '/user');
const owner = me.login;
console.log('      ' + owner);

/* 3. 仓库（先查，存在就不再创建——创建也属于"写入"，限流时会直接被拒） */
console.log('[3/6] 仓库 ' + REPO);
let repo = null;
try {
  repo = await call('GET', `/repos/${owner}/${REPO}`);
  console.log('      已存在，复用 ' + repo.html_url);
} catch (e) {
  if (e.status !== 404) throw e;
  repo = await call('POST', '/user/repos', {
    name: REPO,
    description: '四级错题本 · 按卷子归档的错题与生词',
    private: false,
    auto_init: false,
  });
  console.log('      已创建 ' + repo.html_url);
}

/* 4. 上传（只推动了的） */
console.log('[4/6] 上传文件');
const FILES = [
  'index.html', 'data.json', 'template.html', 'build.mjs',
  'manifest.json', 'sw.js', 'icon-180.png', 'icon-192.png', 'icon-512.png',
  'README.md', '.gitignore', 'tools/add-paper.mjs', 'tools/publish.mjs',
  '.github/workflows/rebuild.yml',
];
let pushed = 0, skipped = 0;
for (const rel of FILES) {
  const full = path.join(ROOT, rel);
  if (!fs.existsSync(full)) { console.log('      跳过 ' + rel); continue; }
  const buf = fs.readFileSync(full);
  const local = blobSha(buf);

  let remote = null;
  try { remote = (await call('GET', `/repos/${owner}/${REPO}/contents/${encodeURIComponent(rel)}`)).sha; } catch { }

  if (remote === local) { skipped++; continue; }

  const body = { message: `更新 ${rel}`, content: buf.toString('base64') };
  if (remote) body.sha = remote;
  await call('PUT', `/repos/${owner}/${REPO}/contents/${encodeURIComponent(rel)}`, body);
  pushed++;
  console.log('      ✓ ' + rel);
  await sleep(250);
}
console.log(`      推送 ${pushed} 个，跳过 ${skipped} 个（内容未变）`);

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
  await sleep(10000);
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
