#!/usr/bin/env node
/**
 * 漫画生成器：comics/scripts/EP.NN.json（分镜数据）→ EP.NN-slug.svg（四格漫画）
 * 设计决策：
 * 1) 版式参数全部来自 style-guide.md（1200x840、四格 572x361、编号色 1青2紫3品红4橙）；
 * 2) 文案只做「行」级输入，坐标/宽高由布局算法计算，杜绝手写 SVG 的溢出与重叠；
 * 3) 每话 defs id 加 ep{NN}- 前缀做命名空间隔离，阅读器内联多话同屏时渐变不串引用；
 * 4) 同步生成 manifest.json（ episodes 列表唯一数据源 = scripts/*.json ）。
 * 用法：node comics/generate-comics.mjs
 */
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const scriptsDir = join(here, 'scripts');

/* ---------- 与 check-comics.mjs 一致的宽度估算（用于气泡宽度自适应） ---------- */
function estWidth(s, fs) {
  let w = 0;
  for (const ch of s) {
    const c = ch.codePointAt(0);
    if (c > 0x2e7f) w += fs;
    else if (ch === ' ') w += fs * 0.35;
    else if (/[iIl1.,:;'|(){}[\]]/.test(ch)) w += fs * 0.34;
    else if (/[A-Z0-9@#%&WWM]/.test(ch)) w += fs * 0.72;
    else w += fs * 0.58;
  }
  return w;
}
const esc = (s) =>
  String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

/* ---------- 三角色半身头像（44px 级，与 samples/character-sheet.svg 定妆稿一致） ---------- */
const AVATARS = {
  jun: '<g transform="translate(52,110)"><rect x="-19" y="14" width="38" height="22" rx="9" fill="#1d4ed8"/><path d="M-5,18 L5,18 L3.5,27 L0,29 L-3.5,27 Z" fill="#f97316"/><circle cx="0" cy="-2" r="16" fill="#ffd9b3"/><path d="M-16,-2 L-11,-13 L-6,-4 L0,-14 L6,-4 L11,-13 L16,-2 Q0,-11 -16,-2 Z" fill="#f97316"/><circle cx="-5" cy="0" r="1.7" fill="#0b1220"/><circle cx="5" cy="0" r="1.7" fill="#0b1220"/><path d="M-3,5 q3,3 6,0" stroke="#0b1220" stroke-width="1.3" fill="none"/></g>',
  shu: '<g transform="translate(52,110)"><rect x="-19" y="14" width="38" height="22" rx="9" fill="#cbd5e1"/><circle cx="0" cy="-2" r="16" fill="#ffd9b3"/><path d="M-16,-2 a16,16 0 0 1 32,0 q-3,-12 -16,-12 q-13,0 -16,12 z" fill="#e2e8f0"/><circle cx="-5" cy="0" r="4" fill="none" stroke="#94a3b8" stroke-width="1.4"/><circle cx="5" cy="0" r="4" fill="none" stroke="#94a3b8" stroke-width="1.4"/><path d="M-1,0 L1,0" stroke="#94a3b8" stroke-width="1.4"/><circle cx="-5" cy="0" r="1.4" fill="#0b1220"/><circle cx="5" cy="0" r="1.4" fill="#0b1220"/><path d="M-8,5 q8,7 16,0 q-2,7 -8,7 q-6,0 -8,-7 z" fill="#e2e8f0"/></g>',
  jiang: '<g transform="translate(52,110)"><rect x="-19" y="14" width="38" height="22" rx="9" fill="#7C3AED"/><circle cx="0" cy="-2" r="16" fill="#ffd9b3"/><path d="M-16,-2 a16,16 0 0 1 32,0 q-3,-13 -16,-13 q-13,0 -16,13 z" fill="#22d3ee"/><circle cx="15" cy="4" r="6.5" fill="#22d3ee"/><circle cx="-5" cy="0" r="1.7" fill="#0b1220"/><circle cx="5" cy="0" r="1.7" fill="#0b1220"/><path d="M-3,5 q3,3 6,0" stroke="#0b1220" stroke-width="1.3" fill="none"/></g>',
};
const PANEL_COLORS = ['#22d3ee', '#a78bfa', '#f472b6', '#f97316'];
const PANEL_POS = ['translate(20,84)', 'translate(608,84)', 'translate(20,462)', 'translate(608,462)'];

/* ---------- 气泡：宽度按最长行自适应，垂直与头像居中 ---------- */
function bubble(lines) {
  const fs = 15;
  const n = lines.length;
  const h = n * 22 + 8;
  const y0 = Math.round(110 - h / 2);
  const w = clamp(Math.ceil(Math.max(...lines.map((l) => estWidth(l, fs)))) + 28, 200, 430);
  const texts = lines
    .map((l, i) => `    <text x="102" y="${y0 + 22 + i * 22}" font-size="${fs}" fill="#0b1220">${esc(l)}</text>`)
    .join('\n');
  return `    <polygon points="88,100 74,106 88,112" fill="#f8fafc"/>
    <rect x="88" y="${y0}" width="${w}" height="${h}" rx="10" fill="#f8fafc"/>
${texts}`;
}

/* ---------- 代码芯片：行数 3~6，行可为字符串（默认蓝）或 {t, c} 指定颜色 ---------- */
function codeChip(lines, accent, y) {
  const h = lines.length * 18 + 28;
  const texts = lines
    .map((l, i) => {
      const t = typeof l === 'string' ? l : l.t;
      const c = typeof l === 'string' ? '#7dd3fc' : l.c || '#7dd3fc';
      return `    <text x="38" y="${y + 22 + i * 18}" font-size="12.5" fill="${c}" font-family="'SF Mono',Consolas,monospace">${esc(t)}</text>`;
    })
    .join('\n');
  return `    <rect x="24" y="${y}" width="524" height="${h}" rx="8" fill="#0a0f1c" stroke="${accent}" stroke-opacity="0.35"/>
${texts}`;
}

/* ---------- 底部注脚：两行，第一行亮、第二行暗 ---------- */
function note(lines, accent, y) {
  return `    <rect x="24" y="${y}" width="524" height="52" rx="8" fill="#111a30" stroke="#1e2a44"/>
    <rect x="24" y="${y}" width="4" height="52" rx="2" fill="${accent}"/>
    <text x="40" y="${y + 22}" font-size="13.5" fill="#e2e8f0">${esc(lines[0])}</text>
    <text x="40" y="${y + 42}" font-size="13.5" fill="#94a3b8">${esc(lines[1])}</text>`;
}

/* ---------- 单格渲染：第 1~3 格 = 头像+气泡+代码+注脚；第 4 格 = 气泡+坑点+码叔总结 ---------- */
function renderPanel(p, idx, epSlug) {
  const accent = PANEL_COLORS[idx];
  const parts = [];
  parts.push(`  <g transform="${PANEL_POS[idx]}">`);
  parts.push(`    <rect width="572" height="361" rx="14" fill="#0e1730" stroke="#223055"/>`);
  parts.push(`    <polygon points="380,0 450,0 120,361 50,361" fill="${accent}" opacity="0.04"/>`);
  parts.push(`    <rect x="14" y="13" width="26" height="20" rx="6" fill="${accent}"/>`);
  parts.push(`    <text x="27" y="28" text-anchor="middle" font-size="14" font-weight="bold" fill="#0b1220">${idx + 1}</text>`);
  parts.push(`    <text x="50" y="29" font-size="17" font-weight="bold" fill="#e2e8f0">${esc(p.title)}</text>`);
  parts.push(AVATARS[p.speaker]);
  parts.push(bubble(p.bubble));

  if (idx < 3) {
    const codeY = 152;
    const chipH = p.code.length * 18 + 28;
    parts.push(codeChip(p.code, accent, codeY));
    parts.push(note(p.note, accent, codeY + chipH + 8));
  } else {
    parts.push(`    <rect x="24" y="154" width="96" height="26" rx="13" fill="#f97316"/>`);
    parts.push(`    <text x="72" y="172" text-anchor="middle" font-size="13" font-weight="bold" fill="#0b1220">⚠ 坑点</text>`);
    p.pitfalls.forEach((t, i) => {
      const y = 200 + i * 28;
      parts.push(`    <rect x="32" y="${y}" width="9" height="9" rx="2" fill="#f97316"/>`);
      parts.push(`    <text x="52" y="${y + 9}" font-size="14" fill="#e2e8f0">${esc(t)}</text>`);
    });
    parts.push(`    <rect x="24" y="290" width="524" height="50" rx="8" fill="#111a30" stroke="#1e2a44"/>`);
    parts.push(`    <rect x="24" y="290" width="4" height="50" rx="2" fill="#22d3ee"/>`);
    parts.push(`    <text x="40" y="311" font-size="13.5" font-weight="bold" fill="#22d3ee">码叔总结</text>`);
    parts.push(`    <text x="40" y="331" font-size="13.5" fill="#e2e8f0">${esc(p.summary)}</text>`);
  }
  parts.push('  </g>');
  return parts.join('\n');
}

/* ---------- 整话渲染 ---------- */
function renderEpisode(ep) {
  const ns = `ep${String(ep.ep).padStart(2, '0')}`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 840" font-family="'PingFang SC','Hiragino Sans GB','Microsoft YaHei',sans-serif">
  <defs>
    <linearGradient id="${ns}-bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#0b1220"/>
      <stop offset="1" stop-color="#101a33"/>
    </linearGradient>
    <linearGradient id="${ns}-titleGrad" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="#22d3ee"/>
      <stop offset="1" stop-color="#a78bfa"/>
    </linearGradient>
  </defs>
  <rect width="1200" height="840" fill="url(#${ns}-bg)"/>
  <polygon points="980,0 1060,0 760,840 680,840" fill="#22d3ee" opacity="0.04"/>
  <polygon points="150,0 220,0 1040,840 970,840" fill="#a78bfa" opacity="0.03"/>
  <rect x="20" y="14" width="92" height="36" rx="9" fill="#7C3AED"/>
  <text x="66" y="38" text-anchor="middle" font-size="18" font-weight="bold" fill="#ffffff">EP.${String(ep.ep).padStart(2, '0')}</text>
  <text x="126" y="40" font-size="26" font-weight="bold" fill="url(#${ns}-titleGrad)">${esc(ep.title)}</text>
  <text x="1180" y="38" text-anchor="end" font-size="13" fill="#64748b">Nuxt 4 实战漫画剧场 · NEON INK</text>
  <rect x="20" y="62" width="1160" height="2" rx="1" fill="url(#${ns}-titleGrad)" opacity="0.6"/>
${ep.panels.map((p, i) => renderPanel(p, i, ep.slug)).join('\n')}
  <text x="1180" y="832" text-anchor="end" font-size="11" fill="#475569">NEON INK · nuxt-tutorial-project · EP${ep.ep}</text>
</svg>
`;
}

/* ---------- 分镜数据校验（生成前拦截，错误信息定位到字段） ---------- */
function validate(ep) {
  const errs = [];
  const L = (arr, n, label, max) => {
    if (!Array.isArray(arr) || arr.length !== n) errs.push(`${label} 必须是 ${n} 行数组（当前 ${Array.isArray(arr) ? arr.length : '非数组'}）`);
    else arr.forEach((s, i) => { if (estWidth(typeof s === 'string' ? s : s.t, max.fs) > max.w) errs.push(`${label}[${i}] 超宽：「${String(typeof s === 'string' ? s : s.t).slice(0, 16)}…」`); });
  };
  if (!ep.slug || !/^EP\.\d{2}-[a-z0-9-]+$/.test(ep.slug)) errs.push(`slug 不合法：${ep.slug}`);
  if (!Array.isArray(ep.panels) || ep.panels.length !== 4) errs.push('panels 必须恰好 4 格');
  (ep.panels || []).forEach((p, i) => {
    const tag = `第${i + 1}格`;
    if (!p.title || estWidth(p.title, 17) > 160) errs.push(`${tag} title 过长（≤8 汉字）`);
    if (!AVATARS[p.speaker]) errs.push(`${tag} speaker 必须是 ${Object.keys(AVATARS).join('/')}`);
    L(p.bubble, i === 3 ? p.bubble?.length : p.bubble?.length, `${tag} bubble`, { fs: 15, w: 400 });
    if (!p.bubble || p.bubble.length < 2 || p.bubble.length > 3) errs.push(`${tag} bubble 必须 2~3 行`);
    if (i < 3) {
      if (!Array.isArray(p.code) || p.code.length < 3 || p.code.length > 6) errs.push(`${tag} code 必须 3~6 行`);
      else p.code.forEach((s, j) => { const t = typeof s === 'string' ? s : s.t; if (estWidth(t, 12.5) > 500) errs.push(`${tag} code[${j}] 超宽：「${t.slice(0, 20)}…」`); });
      L(p.note, 2, `${tag} note`, { fs: 13.5, w: 490 });
    } else {
      if (!Array.isArray(p.pitfalls) || p.pitfalls.length < 2 || p.pitfalls.length > 3) errs.push('第4格 pitfalls 必须 2~3 条');
      else p.pitfalls.forEach((t, j) => { if (estWidth(t, 14) > 490) errs.push(`第4格 pitfalls[${j}] 超宽：「${t.slice(0, 16)}…」`); });
      if (!p.summary || estWidth(p.summary, 13.5) > 480) errs.push('第4格 summary 缺失或超宽（≤34 汉字）');
    }
  });
  return errs;
}

/* ---------- 主流程 ---------- */
const files = readdirSync(scriptsDir).filter((f) => /^EP\.\d{2}.*\.json$/.test(f)).sort();
if (!files.length) { console.error('comics/scripts/ 下没有 EP.NN*.json 分镜数据'); process.exit(1); }

const episodes = [];
let hasError = false;
for (const f of files) {
  const ep = JSON.parse(readFileSync(join(scriptsDir, f), 'utf8'));
  const errs = validate(ep);
  if (errs.length) { hasError = true; console.error(`✗ ${f}：\n  - ${errs.join('\n  - ')}`); continue; }
  writeFileSync(join(here, `${ep.slug}.svg`), renderEpisode(ep));
  episodes.push({ ep: ep.ep, slug: ep.slug, title: ep.title, part: ep.part });
  console.log(`✓ 生成 ${ep.slug}.svg`);
}
if (hasError) process.exit(1);

episodes.sort((a, b) => a.ep - b.ep);
const manifest = {
  series: 'Nuxt 4 实战漫画剧场 · 霓虹墨 Neon Ink',
  version: '1.0.0',
  canvas: { width: 1200, height: 840 },
  panels: { count: 4, width: 572, height: 361 },
  characters: ['像素酱', '标签君', '码叔'],
  episodes,
};
writeFileSync(join(here, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
console.log(`✓ manifest.json（${episodes.length} 话）`);
