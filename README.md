# 四级错题本

按卷子归档的错题 + 生词本 + 抽卡复习。纯静态，GitHub Pages 直接托管，iPad 加主屏幕当 App 用。

**网址**：`https://<你的用户名>.github.io/cet4-mistakes/`

---

## 一、这个仓库的组成

| 文件 | 作用 |
|---|---|
| `index.html` | **构建产物**，自包含（数据已内嵌），Pages 直接托管这一个就够 |
| `data.json` | **唯一数据源**：卷子、题目、生词、待处理队列 |
| `template.html` | 页面骨架，`__DATA_JSON__` 是数据占位符 |
| `build.mjs` | `data.json` + `template.html` → `index.html`，顺带校验数据 |
| `tools/add-paper.mjs` | 把一份新卷子的识别结果并入 `data.json` 并重建 |
| `tools/device-login.ps1` | GitHub 设备码登录，拿到发布用 token |
| `tools/publish.ps1` | 建仓库 / 上传 / 开 Pages，全走 REST API |
| `收件箱/` | 新试卷丢这里（PDF），等识别 |
| `manifest.json` / `sw.js` / `icon-*.png` | 主屏幕图标与离线缓存 |

---

## 二、数据怎么长（加一套卷子）

`data.json` 里 `papers` 加一项：

```json
{
  "id": "2024-12-1",
  "title": "2024年12月 · 第一套",
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
- `title` 就是网站上的**分类名**，按它分组
- 手工加完记得 `node build.mjs`

或者用脚本加（推荐）：

```bash
node tools/add-paper.mjs 收件箱/2024-12-2.json
```

它会校验、去重、按日期排序、重建 `index.html`。

---

## 三、发布 / 更新

首次：

```powershell
powershell -ExecutionPolicy Bypass -File tools\device-login.ps1   # 浏览器输 8 位码
powershell -ExecutionPolicy Bypass -File tools\publish.ps1
```

以后改了数据，只要再跑一次 `publish.ps1`（它会先 `node build.mjs`）。
桌面上的 `发布错题本.cmd` 双击等同于此。

> token 存在 `tools\gh-token.txt`，已在 `.gitignore` 里，不会上传。
> 想换账号：删掉这个文件重跑 `device-login.ps1`。

---

## 四、iPad

1. Safari 打开 Pages 网址
2. 分享 → **添加到主屏幕**
3. 从主屏图标打开一次（SW 缓存离线版）

进度（已掌握、记忆盒、复习次数）存在 Safari 本地，换设备不同步。
页脚有 **导出进度 / 导入备份**，每周导一次。

---

## 五、说明

- Pages 免费只对 **Public** 仓库生效。
- 免费额度：Pages 每月 100GB 流量，一个错题站用不到 1%。
- 构建时间：push 后一般 30–60 秒生效。
