/* 卷子交付标准：每套卷必须齐七块内容，缺一块 build 就会失败
   用法：node tools/check.mjs        仅检查并打印报告
        node tools/check.mjs --strict  有缺项就以非零码退出
   同时被 build.mjs 引用（构建时强制）。 */

export const STANDARD = {
  questions: '每题：对的给 brief，错的给 line/why/you/fix + phrases≥2',
  summary: '卷末小结：verdict + roots≥2',
  diagnosis: '诊断：steps≥3',
  words: '生词 ≥ 8 个，且带 paper 字段',
  sentences: '长难句：卷面有中括号就要录入（无括号可 0）',
  translations: '全文翻译 4 篇（A / B / C1 / C2），每篇 ≥3 段'
};

const SEC_OK = ['A', 'B', 'C'];

export function checkPapers(data) {
  const errors = [];
  const report = [];
  const papers = data.papers || [];
  const words = data.words || [];
  const sentences = data.sentences || [];
  const translations = data.translations || [];

  for (const p of papers) {
    const qs = p.questions || [];
    const wrong = qs.filter(q => !q.ok);
    const ok = qs.filter(q => q.ok);

    const missingBrief = ok.filter(q => !q.brief);
    const badWrong = wrong.filter(q =>
      !q.line || !q.why || !q.you || !q.fix || !Array.isArray(q.phrases) || q.phrases.length < 2);

    const paperWords = words.filter(w => w.paper === p.id);
    const paperSent = sentences.filter(s => s.paper === p.id);
    const paperTr = translations.filter(t => t.paper === p.id);
    const trSecs = new Set(paperTr.map(t => t.sec));
    const thinTr = paperTr.filter(t => !Array.isArray(t.paras) || t.paras.length < 3);

    const problems = [];
    if (!qs.length) problems.push('没有题目');
    if (qs.some(q => !SEC_OK.includes(q.sec))) problems.push('sec 必须是 A/B/C');
    if (missingBrief.length) problems.push(`${missingBrief.length} 道对题缺 brief（${missingBrief.map(q => q.no).join(',')}）`);
    if (badWrong.length) problems.push(`${badWrong.length} 道错题缺解析/短语（${badWrong.map(q => q.no).join(',')}）`);
    if (!p.summary || !p.summary.verdict) problems.push('缺小结 verdict');
    if (!p.summary || !Array.isArray(p.summary.roots) || p.summary.roots.length < 2) problems.push('小结 roots 少于 2 条');
    if (!p.diagnosis || !Array.isArray(p.diagnosis.steps) || p.diagnosis.steps.length < 3) problems.push('诊断 steps 少于 3 条');
    if (paperWords.length < 8) problems.push(`生词只有 ${paperWords.length} 个（要求 ≥8）`);
    if (paperTr.length < 4) problems.push(`译文只有 ${paperTr.length} 篇（要求 4 篇）`);
    if (trSecs.size < 3) problems.push('译文缺少 A/B/C 某一类');
    if (thinTr.length) problems.push(`${thinTr.length} 篇译文段落少于 3 段`);

    report.push({
      id: p.id, title: p.title,
      q: qs.length, wrong: wrong.length,
      phrase: wrong.filter(q => Array.isArray(q.phrases) && q.phrases.length >= 2).length,
      words: paperWords.length,
      sent: paperSent.length,
      trans: paperTr.length,
      problems
    });

    for (const x of problems) errors.push(`${p.title}：${x}`);
  }

  return { errors, report };
}

/* 直接运行时打印报告 */
if (process.argv[1] && process.argv[1].endsWith('check.mjs')) {
  const fs = await import('node:fs');
  const path = await import('node:path');
  const { fileURLToPath } = await import('node:url');
  const here = path.dirname(fileURLToPath(import.meta.url));
  const data = JSON.parse(fs.readFileSync(path.join(here, '..', 'data.json'), 'utf8'));
  const { errors, report } = checkPapers(data);

  for (const r of report) {
    const flag = r.problems.length ? '✗' : '✓';
    console.log(`${flag} ${r.title}`);
    console.log(`   ${r.q} 题 / 错 ${r.wrong} / 带短语 ${r.phrase} / 生词 ${r.words} / 长难句 ${r.sent} / 译文 ${r.trans} 篇`);
    for (const x of r.problems) console.log('   · ' + x);
  }
  console.log('');
  if (errors.length) {
    console.log(`共 ${errors.length} 处不合格`);
    if (process.argv.includes('--strict')) process.exit(1);
  } else {
    console.log('全部符合交付标准');
  }
}
