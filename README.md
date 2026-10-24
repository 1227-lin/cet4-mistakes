# 四级错题本

按卷子归档的错题 + 生词本 + 抽卡复习。纯静态，GitHub Pages 托管，iPad 加主屏幕当 App 用。

**网址**：https://1227-lin.github.io/cet4-mistakes/
**仓库**：https://github.com/1227-lin/cet4-mistakes

---

## 一、这个仓库的组成

| 文件 | 作用 |
|---|---|
| `index.html` | **构建产物**，自包含（数据已内嵌），Pages 托管的就是它 |
| `data.json` | **唯一数据源**：卷子、题目、生词、待处理队列 |
| `template.html` | 页面骨架，`__DATA_JSON__` 是数据占位符 |
| `build.mjs` | `data.json` + `template.html` → `index.html`，顺带校验数据 |
| `tools/add-paper.mjs` | 把一份新卷子的识别结果并入 `data.json` 并重建 |
| `tools/publish.mjs` | 建仓库 / 上传 / 开 Pages，全走 REST API |
| `tools/ship.mjs` | 加卷子 + 重建 + 发布，一条命令搞定 |
| `收件箱/` | 新试卷丢这里（PDF 不上传） |

---

## 二、加一套卷子

**一条命令：**

```bash
node tools/ship.mjs 收件箱/2024-12-2.json
```

它做的事：校验 → 去重 → 按日期排序 → 重建 index.html → 上传 → 等 Pages 构建。

**卷子 JSON 长这样：**

```json
{
  "id": "2024-12-2",
  "title": "2024年12月 · 第二套",
  "date": "2024-12-14",
  "scope": "Part III 阅读 26–55",
  "note": "听力未作答",
  "questions": [
    { "no": "26", "sec": "A", "yours": "N", "ans": "N", "ok": true, "brief": "一句话依据" },
    { "no": "27", "sec": "A", "yours": "M", "ans": "I", "ok": false,
      "tag": "词性判断",
      "stem": "带 <u>27</u> 占位符的原句",
      "zh": "中文意思",
      "quote": "原文定位句，可用 <em> 高亮",
      "why": "正确答案为什么对",
      "you": "你为什么错",
      "fix": "下次怎么做" }
  ],
  "words": [
    { "w": "emerge", "pos": "v.", "zh": "出现；浮现", "eg": "…<em>emerged</em>…", "tag": "仔细阅读" }
  ]
}
```

- `sec`：`A` 选词填空 / `B` 段落匹配 / `C` 仔细阅读
- `ok: true` 的题只要 `brief`；`ok: false` 才有解析和「已掌握」
- `title` 就是网站上的**分类名**

---

## 三、发布

```bash
node tools/publish.mjs        # 或双击 发布错题本.cmd
```

- token 在 `tools/gh-token.txt`（已 .gitignore，不会上传）
- 发布完成后 30–60 秒 Pages 生效
- 想换账号：删掉 `gh-token.txt`，重新跑 `tools/device-login.ps1`（需要能访问 github.com 的网络）

---

## 四、iPad

1. Safari 打开 https://1227-lin.github.io/cet4-mistakes/
2. 分享 → **添加到主屏幕**
3. 从主屏图标打开一次（SW 缓存离线版，之后断网也能看）

进度（已掌握、记忆盒、复习次数）存在 Safari 本地，换设备不同步；页脚可导出 / 导入备份。

---

## 五、备注

- 2026-10 实测：本机网络下 `github.com` 不通，但 `api.github.com` 与 `*.github.io` 通，所以发布和访问都正常，只有 Web 界面打不开。
- Pages 免费只对 Public 仓库生效；月流量 100GB，一个错题站用不到 1%。

---

## 六、自动化

| 触发 | 谁来做 | 结果 |
|---|---|---|
| 推 `data.json` / `template.html` / `build.mjs` | GitHub Actions（`.github/workflows/rebuild.yml`） | 云端执行 `node build.mjs`，把新的 `index.html` 提交回来，Pages 自动更新 |
| 每天 21:30 | DSH 定时任务「检查错题本收件箱」 | 扫 `收件箱/`，有新 PDF 就识别、并入、发布 |
| 你说"加这套卷子" | 我 | 读图 → 写卷子 JSON → `node tools/ship.mjs` |
| 手动 | 双击 `发布错题本.cmd` | 本地构建 + 推送 |

`ship.mjs` = add-paper + build + publish，一条命令走完。

> 识别手写作答和红笔批改必须由模型看图，脚本做不到。所以链路里唯一 "非自动" 的一步就是"看卷子"，
> 其余（合并、去重、排序、构建、上传、部署）都已经交给脚本和 Actions。
