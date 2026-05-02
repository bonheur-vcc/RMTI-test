import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = (name) => fs.readFileSync(path.join(root, name), 'utf8');

const rmti = read('RMTI.html');
const mirror = read('Mirror.html');
const paradox = read('Paradox.html');

function balanceEnd(source, openIndex) {
  const open = source[openIndex];
  const close = open === '{' ? '}' : open === '[' ? ']' : open === '(' ? ')' : null;
  if (!close) throw new Error('Unsupported opener ' + open);
  let depth = 0;
  let quote = null;
  let templateDepth = 0;
  let escaped = false;
  for (let i = openIndex; i < source.length; i++) {
    const ch = source[i];
    const prev = source[i - 1];
    if (quote) {
      if (escaped) {
        escaped = false;
        continue;
      }
      if (ch === '\\') {
        escaped = true;
        continue;
      }
      if (quote === '`' && ch === '$' && source[i + 1] === '{') {
        templateDepth++;
        i++;
        continue;
      }
      if (quote === '`' && templateDepth > 0) {
        if (ch === '{') templateDepth++;
        if (ch === '}') templateDepth--;
        continue;
      }
      if (ch === quote) quote = null;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === '`') {
      quote = ch;
      continue;
    }
    if (ch === '/' && source[i + 1] === '/') {
      const next = source.indexOf('\n', i + 2);
      i = next === -1 ? source.length : next;
      continue;
    }
    if (ch === '/' && source[i + 1] === '*') {
      const next = source.indexOf('*/', i + 2);
      i = next === -1 ? source.length : next + 1;
      continue;
    }
    if (ch === open) depth++;
    if (ch === close) {
      depth--;
      if (depth === 0) return i;
    }
    if (quote === null && templateDepth < 0 && prev) templateDepth = 0;
  }
  throw new Error('No balanced end for ' + open + ' at ' + openIndex);
}

function extractFunction(source, name) {
  const start = source.indexOf('function ' + name);
  if (start === -1) throw new Error('Missing function ' + name);
  const open = source.indexOf('{', start);
  const end = balanceEnd(source, open);
  return source.slice(start, end + 1);
}

function extractConstObjectLiteral(source, name) {
  const start = source.indexOf('const ' + name);
  if (start === -1) throw new Error('Missing const ' + name);
  const equals = source.indexOf('=', start);
  const open = source.slice(equals).search(/[{\[]/);
  if (open === -1) throw new Error('Missing literal for ' + name);
  const openIndex = equals + open;
  const end = balanceEnd(source, openIndex);
  return source.slice(openIndex, end + 1);
}

function extractConstDeclaration(source, name) {
  const start = source.indexOf('const ' + name);
  if (start === -1) throw new Error('Missing const ' + name);
  const equals = source.indexOf('=', start);
  const open = source.slice(equals).search(/[{\[]/);
  if (open === -1) throw new Error('Missing literal for ' + name);
  const end = balanceEnd(source, equals + open);
  const semi = source.indexOf(';', end);
  return source.slice(start, semi + 1);
}

function extractRange(source, startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  if (start === -1) throw new Error('Missing range start ' + startMarker);
  const end = source.indexOf(endMarker, start);
  if (end === -1) throw new Error('Missing range end ' + endMarker);
  return source.slice(start, end);
}

const rmtiQuestionsDecl = extractConstDeclaration(rmti, 'questions');
const getPersonality = extractFunction(rmti, 'getPersonality');
const getDimensionInsight = extractFunction(rmti, 'getDimensionInsight');
const methodologyStart = rmti.indexOf('<div class="methodology">');
const counterStart = rmti.indexOf('<div class="counter"', methodologyStart);
const counterEnd = rmti.indexOf('</div>', counterStart) + '</div>'.length;
if (methodologyStart === -1 || counterStart === -1 || counterEnd === -1) {
  throw new Error('Could not extract RMTI methodology');
}
const methodologyHtml = rmti.slice(methodologyStart, counterEnd);

const existingImages = [];
for (const match of rmti.matchAll(/image:\s*`([^`]+)`/g)) {
  const rel = path.join(root, 'images', match[1]);
  if (fs.existsSync(rel)) existingImages.push(match[1]);
}

const mirrorData = [
  extractRange(mirror, '  const INNER =', '  // ---------- 游戏状态 ----------'),
  "  const WX=['金','木','水','火','土'];",
  extractFunction(mirror, 'wxRel'),
  extractFunction(mirror, 'wxDesc'),
  extractFunction(mirror, 'showLight'),
  extractFunction(mirror, 'showShadow'),
].join('\n\n');

let paradoxEndings = extractConstDeclaration(paradox, 'endings');
paradoxEndings = paradoxEndings.replace('const endings', 'const PARADOX_ENDINGS');

const html = String.raw`<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
  <title>红楼三境 · RMTI / 风月宝鉴 / 太虚幻境</title>
  <link rel="icon" href="data:,">
  <script type="importmap">
    { "imports": { "three": "https://unpkg.com/three@0.150.0/build/three.module.js", "three/addons/": "https://unpkg.com/three@0.150.0/examples/jsm/" } }
  </script>
  <style>
    :root {
      --ink: #24170f;
      --muted: #715f4c;
      --paper: rgba(255, 250, 239, 0.92);
      --paper-solid: #fffaf0;
      --line: rgba(142, 105, 55, 0.36);
      --gold: #c8a35a;
      --gold-deep: #9d7431;
      --red: #8b2c2c;
      --red-soft: #b24a43;
      --jade: #809878;
      --shadow: 0 22px 80px rgba(38, 18, 8, 0.28);
      --song: "Noto Serif SC", "Songti SC", "STSong", "SimSun", "KaiTi", serif;
      --title: "ZCOOL XiaoWei", "Noto Serif SC", "STKaiti", "KaiTi", serif;
    }
    * { box-sizing: border-box; }
    html, body { margin: 0; min-height: 100%; background: #17110d; color: var(--ink); font-family: var(--song); }
    body { overflow-x: hidden; }
    button, input { font: inherit; }
    .app-root { min-height: 100vh; background: #17110d; }
    .home-view {
      min-height: 100svh;
      position: relative;
      overflow: hidden;
      background:
        linear-gradient(90deg, rgba(31, 17, 10, 0.78) 0%, rgba(31, 17, 10, 0.18) 28%, rgba(31, 17, 10, 0.2) 72%, rgba(31, 17, 10, 0.62) 100%),
        linear-gradient(180deg, rgba(255, 250, 235, 0.05), rgba(30, 18, 9, 0.68)),
        url("RMTI.png") center / cover no-repeat;
    }
    .home-view::after {
      content: "";
      position: absolute;
      inset: 0;
      pointer-events: none;
      background:
        radial-gradient(circle at 52% 50%, transparent 0 36%, rgba(38, 18, 8, 0.22) 62%, rgba(22, 12, 7, 0.6) 100%),
        url("data:image/svg+xml,%3Csvg width='120' height='120' viewBox='0 0 120 120' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M12 62c18-28 42-28 60 0s36 28 54 0' fill='none' stroke='%23b08a4d' stroke-opacity='.12' stroke-width='1'/%3E%3C/svg%3E");
    }
    .home-panel {
      position: relative;
      z-index: 2;
      min-height: 100svh;
      display: grid;
      grid-template-columns: minmax(220px, 360px) 1fr;
      gap: 24px;
      padding: clamp(18px, 4vw, 54px);
      align-items: stretch;
    }
    .home-copy {
      align-self: center;
      max-width: 360px;
      color: #f7eddb;
      text-shadow: 0 2px 16px rgba(0,0,0,0.5);
    }
    .home-copy h1 {
      margin: 0;
      font-family: var(--title);
      font-size: clamp(2.4rem, 7vw, 5.8rem);
      line-height: 0.96;
      letter-spacing: 0.08em;
      writing-mode: vertical-rl;
      max-height: 72svh;
    }
    .home-copy p {
      margin: 22px 0 0;
      max-width: 19rem;
      color: rgba(255, 245, 224, 0.86);
      line-height: 1.9;
      letter-spacing: 0.08em;
      font-size: clamp(0.82rem, 1.4vw, 0.98rem);
    }
    .home-stage { position: relative; min-height: 560px; }
    .hotspot {
      position: absolute;
      appearance: none;
      border: 0;
      background: transparent;
      padding: 0;
      cursor: pointer;
      color: #f8ead0;
      filter: drop-shadow(0 16px 22px rgba(28, 12, 5, 0.38));
      transition: transform 0.28s ease, filter 0.28s ease;
    }
    .hotspot:hover, .hotspot:focus-visible { transform: translateY(-6px) scale(1.03); filter: drop-shadow(0 18px 28px rgba(80, 28, 16, 0.48)); outline: none; }
    .hotspot img { display: block; width: min(24vw, 230px); max-width: 100%; height: auto; }
    .hotspot span {
      display: block;
      margin-top: -12px;
      padding: 8px 12px;
      background: rgba(42, 20, 10, 0.72);
      border: 1px solid rgba(218, 179, 99, 0.45);
      box-shadow: 0 8px 26px rgba(0,0,0,0.22);
      backdrop-filter: blur(8px);
      letter-spacing: 0.14em;
      font-size: 0.88rem;
      text-align: center;
      white-space: nowrap;
    }
    .hotspot.rmti { left: 0%; bottom: 6%; }
    .hotspot.mirror { right: 13%; top: 20%; }
    .hotspot.paradox { left: 39%; top: 31%; }
    .home-note {
      position: absolute;
      right: 0;
      bottom: 2.5rem;
      z-index: 2;
      max-width: 360px;
      padding: 18px 20px;
      color: rgba(255, 244, 222, 0.9);
      background: linear-gradient(135deg, rgba(48, 24, 12, 0.72), rgba(80, 36, 24, 0.48));
      border: 1px solid rgba(219, 181, 105, 0.38);
      line-height: 1.8;
      letter-spacing: 0.07em;
      box-shadow: 0 18px 60px rgba(20, 10, 6, 0.28);
      backdrop-filter: blur(12px);
    }
    .view-shell { display: none; min-height: 100svh; position: relative; background: #efe3ce; }
    .view-shell.active { display: block; }
    .back-home {
      position: fixed;
      z-index: 1000;
      top: max(12px, env(safe-area-inset-top));
      left: max(12px, env(safe-area-inset-left));
      border: 1px solid rgba(203, 166, 90, 0.55);
      background: rgba(35, 18, 10, 0.62);
      color: #f7e8c9;
      border-radius: 999px;
      padding: 9px 15px;
      cursor: pointer;
      letter-spacing: 0.08em;
      backdrop-filter: blur(10px);
      box-shadow: 0 10px 34px rgba(0,0,0,0.18);
    }
    .back-home:hover { background: rgba(55, 27, 15, 0.78); }
    .loading-state, .error-state {
      min-height: 100svh;
      display: grid;
      place-items: center;
      padding: 24px;
      color: #f7e8d0;
      background: radial-gradient(circle at 50% 30%, #53342b, #16100e 70%);
      text-align: center;
      letter-spacing: 0.08em;
      line-height: 1.8;
    }

    .rmti-app {
      min-height: 100svh;
      padding: 54px 14px 26px;
      background:
        linear-gradient(rgba(239, 226, 204, 0.76), rgba(239, 226, 204, 0.78)),
        url("RMTI.png") center / cover fixed no-repeat;
      display: flex;
      justify-content: center;
      align-items: flex-start;
      line-height: 1.8;
      letter-spacing: 0.04em;
    }
    .rmti-container {
      width: min(880px, 100%);
      background: rgba(255, 251, 241, 0.94);
      border: 1px solid rgba(156, 118, 65, 0.38);
      box-shadow: var(--shadow), inset 0 0 0 8px rgba(196, 154, 82, 0.05);
      padding: clamp(20px, 4vw, 42px);
      position: relative;
      overflow: hidden;
    }
    .rmti-container::before, .rmti-container::after {
      content: "";
      position: absolute;
      inset: 12px;
      border: 1px solid rgba(166, 124, 46, 0.18);
      pointer-events: none;
    }
    .rmti-container::after { inset: 18px; border-style: dotted; }
    .rmti-content { position: relative; z-index: 1; }
    .rmti-header { text-align: center; margin-bottom: 28px; }
    .rmti-seal, .rmti-badge {
      display: inline-block;
      border: 2px solid var(--red);
      color: var(--red);
      font-family: var(--title);
      padding: 3px 14px;
      letter-spacing: 0.16em;
      background: rgba(255, 244, 225, 0.58);
      transform: rotate(-2deg);
    }
    .rmti-header h2, .rmti-header h1 {
      margin: 8px 0 4px;
      font-family: var(--title);
      font-size: clamp(1.8rem, 5vw, 3rem);
      letter-spacing: 0.1em;
      color: var(--ink);
    }
    .rmti-subtitle { color: var(--muted); font-style: italic; margin: 0; }
    .rmti-poem, .poem-block {
      background: linear-gradient(135deg, rgba(255, 250, 240, 0.82), rgba(247, 232, 205, 0.72));
      border: 1px dashed rgba(160, 124, 74, 0.55);
      color: var(--red-soft);
      padding: 14px 18px;
      margin: 18px auto;
      max-width: 620px;
      text-align: center;
      font-family: var(--title);
    }
    .rmti-btn, .rmti-app .btn {
      appearance: none;
      border: 1px solid rgba(160, 124, 74, 0.45);
      border-radius: 999px;
      padding: 11px 24px;
      background: rgba(255, 252, 245, 0.86);
      color: var(--ink);
      cursor: pointer;
      transition: transform 0.2s ease, box-shadow 0.2s ease, background 0.2s ease;
      white-space: nowrap;
    }
    .rmti-btn:hover, .rmti-app .btn:hover { transform: translateY(-2px); box-shadow: 0 10px 26px rgba(93, 50, 18, 0.12); }
    .rmti-btn.primary, .rmti-app .btn.primary {
      background: linear-gradient(135deg, #a53d38, #842827);
      border-color: #842827;
      color: #fff9ec;
      letter-spacing: 0.12em;
    }
    .rmti-progress { margin-bottom: 20px; }
    .rmti-progress-track { height: 5px; background: #e1d1b8; border-radius: 999px; overflow: hidden; }
    .rmti-progress-fill { height: 100%; width: 0; background: linear-gradient(90deg, #9a2f2d, #c6a251); transition: width 0.35s ease; }
    .rmti-progress-text { text-align: right; color: var(--muted); font-size: 0.78rem; margin-top: 5px; }
    .rmti-question-card {
      position: relative;
      min-height: 246px;
      padding: clamp(18px, 4vw, 30px);
      border: 1px solid rgba(159, 124, 75, 0.36);
      background:
        linear-gradient(rgba(255, 251, 240, 0.86), rgba(255, 249, 236, 0.9)),
        radial-gradient(circle at 18% 20%, rgba(179, 68, 63, 0.13), transparent 32%),
        radial-gradient(circle at 88% 78%, rgba(128, 152, 120, 0.16), transparent 34%),
        url("assets/vase-patterns.png") center / cover;
      box-shadow: inset 0 0 0 8px rgba(255,255,255,0.34);
      overflow: hidden;
    }
    .rmti-question-card::before {
      content: attr(data-chapter);
      position: absolute;
      right: 18px;
      top: 18px;
      color: rgba(139, 44, 44, 0.22);
      font-family: var(--title);
      font-size: clamp(2.2rem, 10vw, 4.8rem);
      writing-mode: vertical-rl;
      pointer-events: none;
    }
    .rmti-scene { color: var(--gold-deep); font-family: var(--title); margin-bottom: 10px; }
    .rmti-qtext {
      margin: 0 0 18px;
      padding-left: 14px;
      border-left: 3px solid rgba(189, 151, 72, 0.62);
      font-weight: 600;
      font-size: clamp(0.98rem, 2.4vw, 1.16rem);
    }
    .rmti-options { display: grid; gap: 10px; }
    .rmti-option {
      width: 100%;
      text-align: left;
      border: 1px solid rgba(185, 153, 105, 0.42);
      background: rgba(255, 253, 247, 0.84);
      padding: 13px 14px;
      cursor: pointer;
      color: var(--ink);
      line-height: 1.65;
    }
    .rmti-option:hover, .rmti-option.selected {
      border-color: rgba(156, 54, 49, 0.65);
      background: rgba(255, 246, 230, 0.94);
      box-shadow: inset 3px 0 0 rgba(156, 54, 49, 0.5);
    }
    .rmti-label {
      display: inline-grid;
      place-items: center;
      width: 28px;
      height: 28px;
      margin-right: 9px;
      border-radius: 50%;
      background: #e6d4b8;
      color: var(--red);
      font-size: 0.78rem;
    }
    .rmti-nav { display: flex; justify-content: space-between; gap: 12px; margin-top: 22px; flex-wrap: wrap; }
    .result-type { text-align: center; margin-bottom: 22px; }
    .result-type h2 { font-family: var(--title); font-size: clamp(1.6rem, 5vw, 2.4rem); margin: 8px 0 4px; }
    .result-type .tags { color: var(--muted); margin: 0; }
    .result-card, .methodology {
      background: rgba(255, 250, 240, 0.82);
      border: 1px solid rgba(170, 135, 86, 0.34);
      padding: 18px;
      margin: 14px 0;
      box-shadow: 0 8px 24px rgba(80, 42, 13, 0.06);
    }
    .result-card h3, .methodology h2, .methodology h3 { font-family: var(--title); color: var(--gold-deep); }
    .verse { white-space: normal; color: var(--red-soft); font-family: var(--title); line-height: 1.7; }
    .dimension-bars { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
    .dim-bar { background: rgba(239, 226, 203, 0.65); padding: 11px 12px; }
    .dim-label, .dim-values { font-size: 0.78rem; color: var(--muted); display: flex; justify-content: space-between; gap: 10px; }
    .track { height: 5px; border-radius: 999px; background: #decdb5; overflow: hidden; margin-top: 6px; }
    .fill-dim { height: 100%; }
    .fill-ei { background: #b3443f; } .fill-ns { background: #a67c2e; } .fill-tf { background: #735e4c; } .fill-jp { background: #872b2b; }
    .counter { display: none; }

    .mirror-app {
      min-height: 100svh;
      padding: 56px 16px 28px;
      display: grid;
      place-items: center;
      background:
        radial-gradient(circle at 50% 42%, rgba(209, 168, 86, 0.12), transparent 36%),
        linear-gradient(180deg, #130c0b, #080609 72%);
      color: #ddc796;
      overflow: hidden;
      position: relative;
      user-select: none;
    }
    .mirror-app::before {
      content: "";
      position: absolute;
      inset: 0;
      opacity: 0.2;
      background: url("RMTI.png") center / cover no-repeat;
      filter: sepia(0.8) brightness(0.45) contrast(1.12);
    }
    .mirror-starfield { position: absolute; inset: 0; pointer-events: none; }
    .star-dust { position: absolute; width: 2px; height: 2px; border-radius: 50%; background: #d2ae60; animation: floatDust linear infinite; opacity: 0; }
    @keyframes floatDust { 0% { transform: translateY(0) scale(.3); opacity: 0; } 10% { opacity: .65; } 100% { transform: translateY(-100vh) scale(.15); opacity: 0; } }
    .mirror-container { position: relative; z-index: 2; display: grid; justify-items: center; gap: 13px; width: min(100%, 560px); }
    .mirror-title { text-align: center; }
    .mirror-title h2 { margin: 0; color: #f1cc70; font-family: var(--title); letter-spacing: 0.24em; font-size: clamp(1.6rem, 7vw, 2.4rem); }
    .mirror-subtitle { color: rgba(222, 199, 150, 0.62); font-size: 0.8rem; letter-spacing: 0.18em; margin-top: 4px; }
    .mode-indicator { margin-top: 6px; display: inline-block; border: 1px solid rgba(219, 180, 98, 0.4); padding: 4px 14px; border-radius: 999px; font-size: 0.75rem; letter-spacing: 0.14em; }
    .mode-dark { color: #e7aaa0; border-color: rgba(205, 92, 82, 0.45); }
    .canvas-wrapper {
      width: clamp(280px, min(86vw, 58vh), 480px);
      aspect-ratio: 1;
      border-radius: 50%;
      border: 1px solid rgba(218, 177, 95, 0.36);
      box-shadow: 0 0 70px rgba(197, 141, 58, 0.22), inset 0 0 32px rgba(255, 230, 150, 0.08);
      overflow: hidden;
      background: radial-gradient(circle, #2d2112, #090708 78%);
    }
    #oracleCanvas { display: block; width: 100%; height: 100%; border-radius: 50%; }
    .button-row { display: flex; justify-content: center; flex-wrap: wrap; gap: 10px; }
    .mirror-btn, .cert-btn {
      border: 1px solid rgba(212, 169, 83, 0.5);
      background: rgba(38, 25, 13, 0.72);
      color: #dfc892;
      padding: 9px 18px;
      border-radius: 999px;
      cursor: pointer;
      letter-spacing: 0.12em;
      backdrop-filter: blur(8px);
    }
    .mirror-btn:hover, .cert-btn:hover { background: rgba(66, 40, 18, 0.84); }
    .mirror-btn.active { color: #f0b7ad; border-color: rgba(210, 88, 80, 0.58); background: rgba(65, 22, 21, 0.8); }
    .hint-text { color: rgba(222, 199, 150, 0.48); font-size: 0.72rem; letter-spacing: 0.14em; text-align: center; }
    .modal-overlay {
      position: fixed;
      inset: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: max(18px, env(safe-area-inset-top)) max(14px, env(safe-area-inset-right)) max(18px, env(safe-area-inset-bottom)) max(14px, env(safe-area-inset-left));
      background: rgba(4, 3, 5, 0.82);
      backdrop-filter: blur(14px);
      opacity: 0;
      pointer-events: none;
      z-index: 250;
      transition: opacity 0.28s ease;
    }
    .modal-overlay.active { opacity: 1; pointer-events: auto; }
    .modal-panel {
      width: min(560px, 96vw);
      max-height: min(86vh, 820px);
      overflow: auto;
      background: rgba(12, 8, 8, 0.96);
      border: 1px solid rgba(216, 175, 95, 0.34);
      color: #dcc796;
      padding: 22px;
      box-shadow: 0 24px 80px rgba(0,0,0,0.45);
    }
    .modal-panel.dark { border-color: rgba(203, 86, 80, 0.45); color: #d9b5aa; }
    .modal-title { font-family: var(--title); color: #f0ca68; font-size: 1.4rem; text-align: center; letter-spacing: 0.14em; }
    .dark .modal-title { color: #e89486; }
    .modal-sub { text-align: center; color: rgba(220, 199, 150, 0.58); margin: 5px 0 10px; }
    .modal-combo { display: flex; gap: 8px; flex-wrap: wrap; justify-content: center; margin: 10px 0; }
    .combo-item { border: 1px solid rgba(213, 170, 87, 0.36); padding: 5px 12px; border-radius: 999px; }
    .modal-section { white-space: pre-line; line-height: 1.8; font-size: 0.9rem; padding: 12px 13px; margin: 10px 0; background: rgba(255,255,255,0.035); border-left: 2px solid rgba(220, 176, 90, 0.5); }
    .dark .modal-section { border-left-color: rgba(205, 88, 80, 0.55); }
    .modal-grade { display: inline-block; margin: 8px auto; padding: 5px 14px; border: 1px solid currentColor; border-radius: 999px; }
    .grade-ji { color: #f0ca68; } .grade-banji { color: #d5b25f; } .grade-xiong { color: #d58d80; }

    .paradox-app {
      min-height: 100svh;
      position: relative;
      overflow: hidden;
      background: #160f1d;
      color: #e8d8f0;
      touch-action: manipulation;
    }
    .paradox-app canvas { display: block; width: 100%; height: 100%; }
    .paradox-hud {
      position: fixed;
      z-index: 20;
      pointer-events: none;
      color: #ead6b8;
      text-shadow: 0 0 14px rgba(80, 42, 12, 0.9);
      letter-spacing: 0.1em;
    }
    .paradox-info { left: max(16px, env(safe-area-inset-left)); top: calc(max(52px, env(safe-area-inset-top)) + 18px); line-height: 1.8; font-size: 0.88rem; }
    .paradox-incense { right: max(16px, env(safe-area-inset-right)); top: calc(max(52px, env(safe-area-inset-top)) + 18px); text-align: right; }
    .incense-meter { width: 76px; height: 5px; margin: 6px 0 0 auto; background: rgba(255,255,255,0.18); overflow: hidden; border-radius: 999px; }
    .incense-meter span { display: block; height: 100%; background: linear-gradient(90deg, #8b2c2c, #e2bd69); width: 0%; }
    .paradox-entropy { left: 50%; bottom: max(18px, env(safe-area-inset-bottom)); transform: translateX(-50%); background: rgba(31, 17, 38, 0.58); border: 1px solid rgba(214, 177, 119, 0.28); border-radius: 999px; padding: 8px 18px; }
    .paradox-message { position: fixed; z-index: 30; top: 34%; left: 50%; transform: translate(-50%, -50%); width: min(760px, 88vw); text-align: center; color: #fff2dc; opacity: 0; transition: opacity 0.35s ease; pointer-events: none; font-style: italic; line-height: 1.8; text-shadow: 0 0 20px rgba(0,0,0,0.62); }
    .temptation-pulse { position: fixed; z-index: 35; width: 24px; height: 24px; border-radius: 50%; display: none; background: radial-gradient(circle, #ffe2cb, #b14949 55%, transparent 70%); box-shadow: 0 0 34px #cf6f6f; animation: pulse 1.3s infinite; cursor: pointer; }
    @keyframes pulse { 0%,100% { transform: scale(1); opacity: .9; } 50% { transform: scale(1.9); opacity: .32; } }
    .cert-overlay {
      position: fixed;
      inset: 0;
      z-index: 300;
      display: none;
      align-items: center;
      justify-content: center;
      padding: max(58px, env(safe-area-inset-top)) 18px max(18px, env(safe-area-inset-bottom));
      background: rgba(13, 7, 18, 0.94);
      backdrop-filter: blur(22px);
      overflow: auto;
    }
    .cert-panel { width: min(720px, 96vw); max-height: 88vh; overflow: auto; text-align: center; border: 1px solid rgba(218, 178, 98, 0.3); padding: 24px; background: rgba(20, 12, 24, 0.82); box-shadow: 0 22px 80px rgba(0,0,0,0.38); }
    #cert-title { font-family: var(--title); font-size: clamp(2rem, 8vw, 3.6rem); color: #f3d28d; letter-spacing: 0.22em; }
    #cert-poem, #cert-quote { color: #f0dec4; line-height: 1.85; margin: 12px auto; max-width: 620px; }
    #cert-stats, #cert-analysis { color: #cdbdd8; line-height: 1.8; max-width: 620px; margin: 12px auto; text-align: left; }
    .paradox-fallback { min-height: 100svh; display: grid; place-items: center; padding: 24px; text-align: center; line-height: 1.8; background: radial-gradient(circle at 50% 35%, #422236, #120c16 76%); }

    @media (max-width: 760px) {
      .home-panel { grid-template-columns: 1fr; padding: 18px; }
      .home-copy { max-width: none; align-self: start; padding-top: 28px; }
      .home-copy h1 { writing-mode: horizontal-tb; font-size: clamp(2.2rem, 13vw, 4.2rem); max-height: none; }
      .home-copy p { max-width: 100%; margin-top: 12px; }
      .home-stage { min-height: 56svh; }
      .hotspot img { width: clamp(94px, 28vw, 150px); }
      .hotspot span { font-size: 0.74rem; padding: 6px 9px; }
      .hotspot.rmti { left: 2%; bottom: 7%; }
      .hotspot.mirror { right: 3%; top: 4%; }
      .hotspot.paradox { left: 38%; top: 34%; }
      .home-note { position: relative; right: auto; bottom: auto; margin-top: 14px; max-width: none; }
      .dimension-bars { grid-template-columns: 1fr; }
      .rmti-nav { justify-content: center; }
      .paradox-info { font-size: 0.74rem; top: 62px; }
      .paradox-incense { font-size: 0.74rem; top: 62px; }
      .paradox-entropy { font-size: 0.78rem; white-space: nowrap; }
    }
    @media (prefers-reduced-motion: reduce) {
      *, *::before, *::after { animation-duration: 0.001ms !important; animation-iteration-count: 1 !important; scroll-behavior: auto !important; transition-duration: 0.001ms !important; }
    }
  </style>
</head>
<body>
  <main class="app-root">
    <section id="home-view" class="home-view">
      <div class="home-panel">
        <div class="home-copy">
          <h1>红楼三境</h1>
          <p>入园问情，照鉴观心，循香游梦。三处皆从《红楼梦》生发，一为情榜人格，一为风月宝鉴，一为太虚幻境。</p>
        </div>
        <div class="home-stage" aria-label="大观园入口">
          <button class="hotspot rmti" type="button" data-view="rmti" aria-label="进入红楼情榜人格">
            <img src="assets/landing-pavilion.png" alt="">
            <span>怡红楼前 · 情榜人格</span>
          </button>
          <button class="hotspot mirror" type="button" data-view="mirror" aria-label="进入风月宝鉴">
            <img src="assets/landing-mirror.png" alt="">
            <span>风月宝鉴 · 谶纬转盘</span>
          </button>
          <button class="hotspot paradox" type="button" data-view="paradox" aria-label="进入太虚幻境">
            <img src="assets/landing-taixu-gate.png" alt="">
            <span>太虚门下 · 香烬判词</span>
          </button>
        </div>
        <div class="home-note">说明：此页将三个原作整合为同一处“大观园”。点击画中物件即可入境；每一境都保留原有文字与玩法，并添以红楼式纹样、册页、铜镜、香案与太虚云水。</div>
      </div>
    </section>
    <section id="game-shell" class="view-shell" aria-live="polite">
      <button id="back-home" class="back-home" type="button">归园</button>
      <div id="game-mount"></div>
    </section>
  </main>
  <script>
    const RMTI_AVAILABLE_IMAGES = __RMTI_AVAILABLE_IMAGES__;
    const RMTI_METHODOLOGY_HTML = __RMTI_METHODOLOGY_HTML__;

    function escapeHTML(value) {
      return String(value).replace(/[&<>"']/g, function (ch) {
        return ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[ch];
      });
    }

    function initRmtiApp(mountEl) {
      mountEl.innerHTML =
        '<div class="rmti-app"><div class="rmti-container"><div class="rmti-content">' +
          '<section id="rmti-start" style="text-align:center;">' +
            '<div class="rmti-header"><div class="rmti-seal">警 幻 情 榜</div><h1>红楼·情榜人格</h1><p class="rmti-subtitle">你的情，困在哪里？</p></div>' +
            '<p style="max-width:600px;margin:0 auto 18px;color:var(--muted);text-indent:2em;">曹雪芹原拟在小说末尾，列一张“警幻情榜”，以“情”为尺，为群芳定评。今以《红楼梦》的美学概念为经，现代人格心理学为纬，不测“你是谁”，只看“你在大观园里，如何活着”。</p>' +
            '<div class="rmti-poem">“满纸荒唐言，一把辛酸泪。都云作者痴，谁解其中味？”<br><span style="font-size:.76rem;color:var(--muted);">—— 曹雪芹《自题一绝》</span></div>' +
            '<p style="color:var(--gold-deep);letter-spacing:.1em;">凡三十题 · 每题四择 · 约需五分钟</p>' +
            '<button class="rmti-btn primary" id="rmti-start-btn" type="button">入 园 一 测</button>' +
            '<p style="font-size:.76rem;color:var(--muted);opacity:.68;">仅供娱乐 · 莫失莫忘</p>' +
          '</section>' +
          '<section id="rmti-test" style="display:none;">' +
            '<div class="rmti-header"><div class="rmti-seal">警 幻 情 榜</div><h2>红楼·情榜人格</h2></div>' +
            '<div class="rmti-progress"><div class="rmti-progress-track"><div class="rmti-progress-fill" id="rmti-progress-fill"></div></div><div class="rmti-progress-text" id="rmti-progress-text"></div></div>' +
            '<div id="rmti-question"></div>' +
            '<div class="rmti-nav"><button class="rmti-btn" id="rmti-prev" type="button">上一题</button><button class="rmti-btn primary" id="rmti-next" type="button">下一题</button></div>' +
          '</section>' +
          '<section id="rmti-result" style="display:none;"><div id="rmti-result-content"></div><div class="rmti-nav" style="justify-content:center;"><button class="rmti-btn primary" id="rmti-restart" type="button">重新测试</button></div>' + RMTI_METHODOLOGY_HTML + '</section>' +
        '</div></div></div>';

      __RMTI_QUESTIONS_DECL__
      let currentQ = 0;
      const answers = {};
      const startPage = mountEl.querySelector('#rmti-start');
      const testPage = mountEl.querySelector('#rmti-test');
      const resultPage = mountEl.querySelector('#rmti-result');
      const questionBox = mountEl.querySelector('#rmti-question');
      const progressFill = mountEl.querySelector('#rmti-progress-fill');
      const progressText = mountEl.querySelector('#rmti-progress-text');
      const prevBtn = mountEl.querySelector('#rmti-prev');
      const nextBtn = mountEl.querySelector('#rmti-next');
      const resultContent = mountEl.querySelector('#rmti-result-content');

      function calculateResult() {
        const scores = { E: 0, I: 0, N: 0, S: 0, T: 0, F: 0, J: 0, P: 0 };
        Object.values(answers).forEach(function (v) { if (scores[v] !== undefined) scores[v]++; });
        const ei = scores.E >= scores.I ? 'E' : 'I';
        const ns = scores.N >= scores.S ? 'N' : 'S';
        const tf = scores.T >= scores.F ? 'T' : 'F';
        const jp = scores.P >= scores.J ? 'P' : 'J';
        return { ei: ei, ns: ns, tf: tf, jp: jp, scores: scores };
      }
      __RMTI_PERSONALITY_FUNCTION__
      __RMTI_DIMENSION_FUNCTION__

      function updateProgress() {
        progressFill.style.width = (((currentQ + 1) / questions.length) * 100) + '%';
        progressText.textContent = '第 ' + (currentQ + 1) + ' / ' + questions.length + ' 题';
        prevBtn.style.visibility = currentQ === 0 ? 'hidden' : 'visible';
        nextBtn.textContent = currentQ === questions.length - 1 ? '看判词' : '下一题';
      }
      function renderQuestion() {
        const q = questions[currentQ];
        const labels = ['甲', '乙', '丙', '丁'];
        const chapter = '第' + String(q.id).padStart(2, '0') + '题';
        let html = '<article class="rmti-question-card" data-chapter="' + chapter + '">';
        html += '<div class="rmti-scene">' + escapeHTML(q.scene) + '</div>';
        html += '<p class="rmti-qtext">' + escapeHTML(q.text) + '</p>';
        html += '<div class="rmti-options">';
        q.options.forEach(function (opt, i) {
          const selected = answers[currentQ] === opt.dim ? ' selected' : '';
          html += '<button class="rmti-option' + selected + '" type="button" data-dim="' + opt.dim + '"><span class="rmti-label">' + labels[i] + '</span>' + escapeHTML(opt.text) + '</button>';
        });
        html += '</div></article>';
        questionBox.innerHTML = html;
        questionBox.querySelectorAll('.rmti-option').forEach(function (btn) {
          btn.addEventListener('click', function () {
            answers[currentQ] = btn.dataset.dim;
            questionBox.querySelectorAll('.rmti-option').forEach(function (b) { b.classList.remove('selected'); });
            btn.classList.add('selected');
            if (currentQ < questions.length - 1) {
              setTimeout(function () { currentQ++; renderQuestion(); }, 130);
            }
          });
        });
        updateProgress();
      }
      function showResult() {
        testPage.style.display = 'none';
        resultPage.style.display = 'block';
        const calc = calculateResult();
        const p = getPersonality();
        const dimCN = { E: '闹', I: '静', N: '空', S: '象', T: '理', F: '情', J: '谨', P: '逸' };
        const dimBars = [
          { a: 'E', b: 'I', label: '闹 ↔ 静（能量来源）', cls: 'fill-ei' },
          { a: 'N', b: 'S', label: '空 ↔ 象（认知方式）', cls: 'fill-ns' },
          { a: 'T', b: 'F', label: '理 ↔ 情（判断方式）', cls: 'fill-tf' },
          { a: 'J', b: 'P', label: '谨 ↔ 逸（处世态度）', cls: 'fill-jp' }
        ];
        const barsHTML = dimBars.map(function (d) {
          const valA = calc.scores[d.a] || 0;
          const valB = calc.scores[d.b] || 0;
          const pctA = Math.round((valA / Math.max(valA + valB, 1)) * 100);
          return '<div class="dim-bar"><div class="dim-label"><span>' + d.label + '</span></div><div class="dim-values"><span>' + dimCN[d.a] + ' ' + valA + '题</span><span>' + dimCN[d.b] + ' ' + valB + '题</span></div><div class="track"><div class="fill-dim ' + d.cls + '" style="width:' + pctA + '%"></div></div></div>';
        }).join('');
        resultContent.innerHTML =
          '<div class="result-type"><div class="rmti-badge">警幻情榜 · 定评</div><h2>' + p.name + '</h2><p class="tags">' + p.tags + '</p></div>' +
          '<div class="result-card"><h3>判词</h3><div class="verse">' + p.verse.replace(/\n/g, '<br>') + '</div></div>' +
          '<div class="result-card"><h3>情榜评语（脂评·红学注）</h3><p>' + p.desc + '</p><p style="text-indent:0;color:var(--red-soft);">' + p.extra + '</p><div class="ref">学术依据：' + p.ref + '</div></div>' +
          '<div class="result-card"><h3>情态四维度</h3><div class="dimension-bars">' + barsHTML + '</div><p style="text-indent:0;color:var(--muted);">最终情榜类型：<strong>' + dimCN[calc.ei] + '·' + dimCN[calc.ns] + '·' + dimCN[calc.tf] + '·' + dimCN[calc.jp] + '</strong> —— ' + p.name + '</p></div>' +
          '<div class="result-card"><h3>维度心理解析</h3><p style="text-indent:0;">' + getDimensionInsight(calc.ei, calc.ns, calc.tf, calc.jp, calc.scores) + '</p></div>';
        mountEl.querySelector('.rmti-app').scrollTo({ top: 0, behavior: 'smooth' });
      }
      function start() {
        currentQ = 0;
        Object.keys(answers).forEach(function (key) { delete answers[key]; });
        startPage.style.display = 'none';
        resultPage.style.display = 'none';
        testPage.style.display = 'block';
        renderQuestion();
      }
      mountEl.querySelector('#rmti-start-btn').addEventListener('click', start);
      mountEl.querySelector('#rmti-restart').addEventListener('click', start);
      prevBtn.addEventListener('click', function () { if (currentQ > 0) { currentQ--; renderQuestion(); } });
      nextBtn.addEventListener('click', function () {
        if (!answers[currentQ]) return;
        if (currentQ === questions.length - 1) showResult();
        else { currentQ++; renderQuestion(); }
      });
      return { destroy: function () { mountEl.innerHTML = ''; }, reset: start };
    }

    function initMirrorApp(mountEl) {
      mountEl.innerHTML =
        '<div class="mirror-app"><div class="mirror-starfield" id="starfield"></div><div class="mirror-container">' +
          '<div class="mirror-title"><h2>风月宝鉴</h2><div class="mirror-subtitle">太虚幻境 · 阴影谶纬</div><div id="modeIndicator" class="mode-indicator mode-light">正面 · 观红颜</div></div>' +
          '<div class="canvas-wrapper" id="canvasWrapper"><canvas id="oracleCanvas" aria-label="三层谶纬星盘"></canvas></div>' +
          '<div class="button-row"><button class="mirror-btn" id="spinBtn" type="button">转动命盘</button><button class="mirror-btn" id="mirrorBtn" type="button">照鉴反面</button><button class="mirror-btn" id="resetBtn" type="button">重绘谶纬</button></div>' +
          '<div class="hint-text">指针所向 · 宝鉴两面 · 真幻自取</div></div>' +
          '<div class="modal-overlay" id="modalOverlay" role="dialog" aria-modal="true"><div class="modal-panel" id="modalPanel"><div class="modal-title" id="modalTitle"></div><div class="modal-sub" id="modalSub"></div><div class="modal-combo" id="modalCombo"></div><div class="modal-section" id="modalDeconstruct"></div><div class="modal-section" id="modalDivination"></div><div class="modal-grade" id="modalGrade"></div><div style="text-align:center;"><button class="cert-btn modal-close" id="modalCloseBtn" type="button">闭目</button></div></div></div>' +
        '</div>';
      __MIRROR_DATA_AND_FUNCTIONS__
      let innerAngle = 0, midAngle = 0, outerAngle = 0;
      let innerVel = 0, midVel = 0, outerVel = 0;
      let isSpinning = false, mirrorMode = false;
      const spinDecay = 0.975;
      let canvas, ctx, dpr, centerX, centerY, radius, rafId = 0;
      const canvasWrapper = mountEl.querySelector('#canvasWrapper');
      const spinBtn = mountEl.querySelector('#spinBtn');
      const mirrorBtn = mountEl.querySelector('#mirrorBtn');
      const resetBtn = mountEl.querySelector('#resetBtn');
      const modalOverlay = mountEl.querySelector('#modalOverlay');
      const modalPanel = mountEl.querySelector('#modalPanel');
      const modalTitle = mountEl.querySelector('#modalTitle');
      const modalSub = mountEl.querySelector('#modalSub');
      const modalCombo = mountEl.querySelector('#modalCombo');
      const modalDeconstruct = mountEl.querySelector('#modalDeconstruct');
      const modalDivination = mountEl.querySelector('#modalDivination');
      const modalGrade = mountEl.querySelector('#modalGrade');
      const modalCloseBtn = mountEl.querySelector('#modalCloseBtn');
      const modeIndicator = mountEl.querySelector('#modeIndicator');
      const starfieldDiv = mountEl.querySelector('#starfield');
      function createStarfield() {
        starfieldDiv.innerHTML = '';
        for (let i = 0; i < 72; i++) {
          const d = document.createElement('div');
          d.className = 'star-dust';
          const s = 1 + Math.random() * 2.8;
          d.style.width = s + 'px';
          d.style.height = s + 'px';
          d.style.left = Math.random() * 100 + '%';
          d.style.top = 40 + Math.random() * 60 + '%';
          d.style.animationDuration = 10 + Math.random() * 18 + 's';
          d.style.animationDelay = Math.random() * 12 + 's';
          starfieldDiv.appendChild(d);
        }
      }
      function setupCanvas() { canvas = mountEl.querySelector('#oracleCanvas'); ctx = canvas.getContext('2d'); resizeCanvas(); }
      function resizeCanvas() {
        const rect = canvas.getBoundingClientRect();
        dpr = Math.min(window.devicePixelRatio || 1, 2.5);
        canvas.width = Math.max(1, Math.floor(rect.width * dpr));
        canvas.height = Math.max(1, Math.floor(rect.height * dpr));
        centerX = canvas.width / 2;
        centerY = canvas.height / 2;
        radius = Math.min(centerX, centerY) * 0.88;
      }
      function normAngle(value) {
        let a = value % (Math.PI * 2);
        if (a > Math.PI) a -= Math.PI * 2;
        if (a < -Math.PI) a += Math.PI * 2;
        return a;
      }
      function getIndex(angle) {
        const sec = Math.PI * 2 / 12;
        const target = -Math.PI / 2;
        let best = 0, bestD = Infinity;
        for (let i = 0; i < 12; i++) {
          const center = normAngle(i * sec + sec / 2 + angle);
          const dist = Math.abs(normAngle(center - target));
          if (dist < bestD) { bestD = dist; best = i; }
        }
        return best;
      }
      function draw() {
        if (!ctx) return;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.save();
        ctx.translate(centerX, centerY);
        const bg = ctx.createRadialGradient(0, 0, radius * 0.06, 0, 0, radius);
        if (mirrorMode) {
          bg.addColorStop(0, '#2a1614'); bg.addColorStop(0.55, '#120b0b'); bg.addColorStop(1, '#050404');
        } else {
          bg.addColorStop(0, '#4d361b'); bg.addColorStop(0.55, '#1d130b'); bg.addColorStop(1, '#070506');
        }
        ctx.fillStyle = bg;
        ctx.beginPath(); ctx.arc(0, 0, radius, 0, Math.PI * 2); ctx.fill();
        drawMirrorFrame();
        drawRing(OUTER, outerAngle, radius * 0.76, radius * 0.26, 9);
        drawRing(MIDDLE, midAngle, radius * 0.54, radius * 0.2, 10);
        drawRing(INNER_SYMBOL, innerAngle, radius * 0.34, radius * 0.16, 12);
        drawCenter();
        drawPointer();
        ctx.restore();
      }
      function drawMirrorFrame() {
        ctx.save();
        for (let i = 0; i < 4; i++) {
          ctx.beginPath();
          ctx.arc(0, 0, radius * (1 - i * 0.055), 0, Math.PI * 2);
          ctx.strokeStyle = mirrorMode ? 'rgba(183,83,72,' + (0.52 - i * 0.08) + ')' : 'rgba(229,188,98,' + (0.58 - i * 0.08) + ')';
          ctx.lineWidth = (i === 0 ? 4 : 1.4) * dpr;
          ctx.stroke();
        }
        const sec = Math.PI * 2 / 48;
        for (let i = 0; i < 48; i++) {
          const a = i * sec;
          const r1 = radius * 0.89, r2 = radius * (i % 4 === 0 ? 0.82 : 0.85);
          ctx.beginPath();
          ctx.moveTo(Math.cos(a) * r1, Math.sin(a) * r1);
          ctx.lineTo(Math.cos(a) * r2, Math.sin(a) * r2);
          ctx.strokeStyle = mirrorMode ? 'rgba(215,142,126,.38)' : 'rgba(232,196,112,.42)';
          ctx.lineWidth = (i % 4 === 0 ? 1.7 : 0.8) * dpr;
          ctx.stroke();
        }
        ctx.restore();
      }
      function drawRing(items, angle, rr, band, fs) {
        const sec = Math.PI * 2 / items.length;
        ctx.save();
        ctx.rotate(angle);
        for (let i = 0; i < items.length; i++) {
          const start = i * sec;
          const end = start + sec;
          ctx.beginPath();
          ctx.arc(0, 0, rr + band / 2, start, end);
          ctx.arc(0, 0, rr - band / 2, end, start, true);
          ctx.closePath();
          ctx.fillStyle = i % 2 === 0 ? (mirrorMode ? 'rgba(96,38,32,.25)' : 'rgba(194,144,61,.13)') : (mirrorMode ? 'rgba(160,70,60,.12)' : 'rgba(120,150,118,.10)');
          ctx.fill();
          ctx.strokeStyle = mirrorMode ? 'rgba(210,120,105,.25)' : 'rgba(226,186,100,.26)';
          ctx.lineWidth = 1 * dpr;
          ctx.stroke();
          const mid = start + sec / 2;
          const x = Math.cos(mid) * rr;
          const y = Math.sin(mid) * rr;
          ctx.save();
          ctx.translate(x, y);
          ctx.rotate(mid + Math.PI / 2);
          ctx.fillStyle = mirrorMode ? '#e5b5a8' : '#e4c785';
          ctx.font = 'bold ' + (fs * dpr) + 'px "Noto Serif SC","KaiTi",serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(items[i], 0, 0);
          ctx.restore();
        }
        ctx.restore();
      }
      function drawCenter() {
        const r = radius * 0.18;
        ctx.save();
        const g = ctx.createRadialGradient(0, 0, 0, 0, 0, r);
        g.addColorStop(0, mirrorMode ? '#2d0e0d' : '#4d3519');
        g.addColorStop(1, mirrorMode ? '#070405' : '#090706');
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = mirrorMode ? '#c66f62' : '#d9b05c';
        ctx.lineWidth = 2 * dpr; ctx.stroke();
        ctx.fillStyle = mirrorMode ? '#efb2a5' : '#f0d17a';
        ctx.font = 'bold ' + (22 * dpr) + 'px "KaiTi",serif';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(mirrorMode ? '骨' : '鉴', 0, 0);
        ctx.restore();
      }
      function drawPointer() {
        ctx.save();
        ctx.rotate(-Math.PI / 2);
        ctx.beginPath();
        ctx.moveTo(radius * 0.93, 0);
        ctx.lineTo(radius * 0.79, -8 * dpr);
        ctx.lineTo(radius * 0.79, 8 * dpr);
        ctx.closePath();
        ctx.fillStyle = mirrorMode ? '#dc7568' : '#f0cc70';
        ctx.shadowBlur = 14 * dpr;
        ctx.shadowColor = ctx.fillStyle;
        ctx.fill();
        ctx.restore();
      }
      function startSpin() {
        if (isSpinning) return;
        isSpinning = true;
        innerVel = (Math.random() - 0.5) * 0.5 + 0.35;
        midVel = (Math.random() - 0.5) * 0.45 - 0.28;
        outerVel = (Math.random() - 0.5) * 0.4 + 0.18;
      }
      function updateAnim() {
        if (isSpinning) {
          innerAngle += innerVel; midAngle += midVel; outerAngle += outerVel;
          innerVel *= spinDecay; midVel *= spinDecay; outerVel *= spinDecay;
          if (Math.abs(innerVel) < 0.0006 && Math.abs(midVel) < 0.0006 && Math.abs(outerVel) < 0.0006) {
            innerVel = midVel = outerVel = 0; isSpinning = false;
            const iI = getIndex(innerAngle), iM = getIndex(midAngle), iO = getIndex(outerAngle);
            if (mirrorMode) showShadow(iI, iM, iO); else showLight(iI, iM, iO);
          }
        }
        draw();
        rafId = requestAnimationFrame(updateAnim);
      }
      const originalShowShadow = showShadow;
      showShadow = function(iI, iM, iO) {
        originalShowShadow(iI, iM, iO);
        modalDeconstruct.textContent = '【镜照说明】此为象征性镜照，不作诊断或预言；所谓“枯骨”，只是被压抑的需要与未被整合的力量。\\n\\n' + modalDeconstruct.textContent;
        modalDivination.textContent += '\\n\\n【今日整合】把镜中最刺眼的一句写成一个可实行的小动作：少一点逃避，多一点辨认；少一点自责，多一点收回自己的力量。';
      };
      function toggleMirror() {
        mirrorMode = !mirrorMode;
        if (mirrorMode) {
          mirrorBtn.classList.add('active');
          mirrorBtn.textContent = '收起宝鉴';
          modeIndicator.textContent = '反面 · 观枯骨';
          modeIndicator.className = 'mode-indicator mode-dark';
        } else {
          mirrorBtn.classList.remove('active');
          mirrorBtn.textContent = '照鉴反面';
          modeIndicator.textContent = '正面 · 观红颜';
          modeIndicator.className = 'mode-indicator mode-light';
        }
        draw();
      }
      function resetGame() { if (!isSpinning) { innerAngle = midAngle = outerAngle = 0; hideModal(); draw(); } }
      function hideModal() { modalOverlay.classList.remove('active'); }
      function spawnBurst(dark) {
        const rect = canvas.getBoundingClientRect();
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height * 0.12;
        const color = dark ? '#e08080' : '#e8c860';
        for (let i = 0; i < 26; i++) {
          const spark = document.createElement('div');
          const angle = Math.random() * Math.PI * 2;
          const dist = 24 + Math.random() * 72;
          spark.style.cssText = 'position:fixed;left:' + cx + 'px;top:' + cy + 'px;width:3px;height:3px;border-radius:50%;pointer-events:none;z-index:300;background:' + color + ';box-shadow:0 0 10px ' + color + ';transition:transform .85s ease-out, opacity .85s ease-out;';
          document.body.appendChild(spark);
          requestAnimationFrame(function () { spark.style.transform = 'translate(' + Math.cos(angle) * dist + 'px,' + Math.sin(angle) * dist + 'px) scale(0)'; spark.style.opacity = '0'; });
          setTimeout(function () { spark.remove(); }, 950);
        }
      }
      function onKey(e) {
        if (e.key === ' ') { e.preventDefault(); startSpin(); }
        else if (e.key === 'm' || e.key === 'M') toggleMirror();
        else if (e.key === 'r' || e.key === 'R') resetGame();
        else if (e.key === 'Escape') hideModal();
      }
      const onResize = function () { resizeCanvas(); draw(); };
      spinBtn.addEventListener('click', startSpin);
      mirrorBtn.addEventListener('click', toggleMirror);
      resetBtn.addEventListener('click', resetGame);
      modalCloseBtn.addEventListener('click', hideModal);
      modalOverlay.addEventListener('click', function (e) { if (e.target === modalOverlay) hideModal(); });
      window.addEventListener('resize', onResize);
      document.addEventListener('keydown', onKey);
      createStarfield();
      setupCanvas();
      updateAnim();
      return { destroy: function () { cancelAnimationFrame(rafId); window.removeEventListener('resize', onResize); document.removeEventListener('keydown', onKey); mountEl.innerHTML = ''; }, reset: resetGame };
    }
  </script>
  <script>
    __PARADOX_ENDINGS_DECL__
    async function initParadoxApp(mountEl) {
      mountEl.innerHTML =
        '<div class="paradox-app"><div class="paradox-hud paradox-info"><span id="rule-count">情缘：3</span><br><span id="still-time">空寂：0s</span></div><div class="paradox-hud paradox-incense"><div id="censer-text">香初燃 · 30息</div><div class="incense-meter"><span id="incense-fill"></span></div></div><div class="paradox-hud paradox-entropy" id="entropy-display">情障 H = 0.02</div><div class="paradox-message" id="message"></div><div class="temptation-pulse" id="temptation-dot"></div><div class="cert-overlay" id="cert-overlay"><div class="cert-panel"><div id="cert-title"></div><div id="cert-poem"></div><div id="cert-stats"></div><div id="cert-quote"></div><div id="cert-analysis"></div><button class="cert-btn" id="cert-download" type="button">下载判词</button><button class="cert-btn" id="cert-close" type="button">再入幻境</button></div></div></div>';
      const app = mountEl.querySelector('.paradox-app');
      let THREE, OrbitControls;
      try {
        THREE = await import('three');
        const controlsMod = await import('three/addons/controls/OrbitControls.js');
        OrbitControls = controlsMod.OrbitControls;
      } catch (err) {
        mountEl.innerHTML = '<div class="paradox-fallback">太虚幻境需要加载 Three.js。当前网络或本地策略阻止了 3D 库加载；RMTI 与风月宝鉴仍可正常使用。<br><small>' + escapeHTML(err.message || err) + '</small></div>';
        return { destroy: function () { mountEl.innerHTML = ''; }, reset: function () {} };
      }
      const MAX_RULES = 110;
      const GAME_DURATION = 30;
      const state = { rules: [], connections: [], totalClicks: 0, totalHoverCreates: 0, stillTime: 0, lastActivity: Date.now(), frozen: false, entropy: 0, countdown: GAME_DURATION, hoverStreak: 0, maxHoverStreak: 0, rapidClicks: 0, lastClickTime: 0, trimmedCount: 0, idleTotal: 0, peakStillness: 0, gameStartTime: Date.now(), phase: 'playing', mirrorFlipCount: 0, lastPromptAt: 0 };
      const scene = new THREE.Scene();
      scene.background = new THREE.Color('#170f1d');
      scene.fog = new THREE.Fog('#170f1d', 8, 58);
      const camera = new THREE.PerspectiveCamera(48, innerWidth / innerHeight, 0.5, 180);
      camera.position.set(5, 4.8, 11);
      const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
      renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
      renderer.setSize(innerWidth, innerHeight);
      renderer.shadowMap.enabled = true;
      app.appendChild(renderer.domElement);
      const controls = new OrbitControls(camera, renderer.domElement);
      controls.enableDamping = true; controls.dampingFactor = 0.08; controls.autoRotate = true; controls.autoRotateSpeed = 0.22; controls.target.set(0, 0.1, 0);
      scene.add(new THREE.AmbientLight('#51344a', 0.72));
      const mainLight = new THREE.DirectionalLight('#fff0da', 0.85); mainLight.position.set(4, 13, 7); mainLight.castShadow = true; scene.add(mainLight);
      const redLight = new THREE.PointLight('#b44a4a', 1.2, 18); redLight.position.set(-4, 1.4, 5); scene.add(redLight);
      const goldLight = new THREE.PointLight('#d9b06d', 0.8, 12); goldLight.position.set(3, -1, 2); scene.add(goldLight);

      function makeTextTexture(text, w, h, dark) {
        const canvas = document.createElement('canvas'); canvas.width = w; canvas.height = h;
        const c = canvas.getContext('2d');
        c.clearRect(0, 0, w, h);
        c.fillStyle = dark ? 'rgba(55,22,18,.82)' : 'rgba(218,186,122,.9)';
        c.strokeStyle = dark ? 'rgba(228,160,135,.85)' : 'rgba(118,72,36,.75)';
        c.lineWidth = 8;
        c.beginPath(); c.roundRect(8, 8, w - 16, h - 16, 26); c.fill(); c.stroke();
        c.fillStyle = dark ? '#f0c1ad' : '#5b2b1d';
        c.font = 'bold 42px KaiTi, serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
        c.fillText(text, w / 2, h / 2);
        const tex = new THREE.CanvasTexture(canvas); tex.colorSpace = THREE.SRGBColorSpace; return tex;
      }
      function makePatternTexture(theme) {
        const canvas = document.createElement('canvas'); canvas.width = 512; canvas.height = 512;
        const c = canvas.getContext('2d');
        const base = theme === 'red' ? '#8d4a42' : theme === 'grey' ? '#83766a' : '#d8d2c5';
        c.fillStyle = base; c.fillRect(0, 0, 512, 512);
        c.globalAlpha = 0.24; c.strokeStyle = theme === 'red' ? '#f1c48d' : '#986f3b'; c.lineWidth = 3;
        for (let y = 24; y < 512; y += 64) for (let x = 24; x < 512; x += 64) {
          c.beginPath(); c.arc(x, y, 18, 0, Math.PI * 2); c.stroke();
          c.beginPath(); c.moveTo(x - 20, y); c.quadraticCurveTo(x, y - 24, x + 20, y); c.quadraticCurveTo(x, y + 24, x - 20, y); c.stroke();
        }
        c.globalAlpha = 0.18; c.strokeStyle = '#2b1a12'; c.lineWidth = 1;
        for (let i = 0; i < 80; i++) { c.beginPath(); const x = Math.random() * 512, y = Math.random() * 512; c.moveTo(x, y); c.lineTo(x + Math.random() * 80 - 40, y + Math.random() * 80 - 40); c.stroke(); }
        const tex = new THREE.CanvasTexture(canvas); tex.colorSpace = THREE.SRGBColorSpace; tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.repeat.set(1, 1); return tex;
      }
      function createGlowTexture() {
        const canvas = document.createElement('canvas'); canvas.width = 64; canvas.height = 64;
        const c = canvas.getContext('2d'); const g = c.createRadialGradient(32,32,0,32,32,32);
        g.addColorStop(0, 'rgba(255,240,225,1)'); g.addColorStop(0.4, 'rgba(226,140,115,.75)'); g.addColorStop(1, 'rgba(0,0,0,0)');
        c.fillStyle = g; c.fillRect(0,0,64,64); return new THREE.CanvasTexture(canvas);
      }
      const glowMap = createGlowTexture();
      function createHonglouVase(theme) {
        const group = new THREE.Group();
        const points = [];
        for (let i = 0; i <= 34; i++) {
          const t = i / 34, y = t * 1.9 - 0.95;
          let r = 0.18 + 0.28 * Math.sin(Math.PI * Math.pow(t, 0.68));
          if (t < 0.12) r = 0.18 + t * 1.4;
          if (t > 0.65) r *= 0.58 + (t - 0.65) * 1.1;
          if (t > 0.86) r = 0.22 + (t - 0.86) * 0.72;
          points.push(new THREE.Vector2(r, y));
        }
        const body = new THREE.Mesh(new THREE.LatheGeometry(points, 72), new THREE.MeshStandardMaterial({ color: '#eee3cf', map: makePatternTexture(theme), roughness: 0.34, metalness: 0.05 }));
        body.castShadow = body.receiveShadow = true; group.add(body);
        const goldMat = new THREE.MeshStandardMaterial({ color: '#d3a650', roughness: 0.22, metalness: 0.55 });
        [['rim', .32, .025, .98], ['neck', .24, .018, .64], ['shoulder', .42, .018, .18], ['foot', .3, .028, -.92]].forEach(function (p) {
          const ring = new THREE.Mesh(new THREE.TorusGeometry(p[1], p[2], 10, 72), goldMat); ring.rotation.x = Math.PI / 2; ring.position.y = p[3]; group.add(ring);
        });
        for (let i = 0; i < 8; i++) {
          const petal = new THREE.Mesh(new THREE.SphereGeometry(0.055, 12, 8), goldMat);
          const a = i / 8 * Math.PI * 2; petal.position.set(Math.cos(a) * .42, .08, Math.sin(a) * .42); petal.scale.set(1, .35, .55); group.add(petal);
        }
        return group;
      }
      function createFengyueMirror(reflective) {
        const group = new THREE.Group();
        const frameMat = new THREE.MeshStandardMaterial({ color: '#b88a42', roughness: 0.25, metalness: 0.74 });
        const mirrorMat = reflective || new THREE.MeshPhysicalMaterial({ color: '#c9c4b7', roughness: 0.08, metalness: 1, clearcoat: 1 });
        const face = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.045, 72), mirrorMat); face.userData.isReflective = true; face.name = 'mirrorSurface'; group.add(face);
        const outer = new THREE.Mesh(new THREE.TorusGeometry(0.52, 0.065, 12, 72), frameMat); outer.rotation.x = Math.PI / 2; group.add(outer);
        const inner = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.018, 8, 72), frameMat); inner.rotation.x = Math.PI / 2; group.add(inner);
        const curve = new THREE.CatmullRomCurve3([new THREE.Vector3(0,-.45,0), new THREE.Vector3(.04,-.78,.02), new THREE.Vector3(-.04,-1.12,0)]);
        const handle = new THREE.Mesh(new THREE.TubeGeometry(curve, 24, .045, 12), frameMat); group.add(handle);
        const plaque = new THREE.Mesh(new THREE.CircleGeometry(.32, 48), new THREE.MeshStandardMaterial({ map: makeTextTexture('风月宝鉴', 320, 160, false), transparent: true, roughness: .35, metalness: .2 }));
        plaque.rotation.y = Math.PI; plaque.position.z = -0.035; group.add(plaque);
        return group;
      }
      function getModelForLabel(label, mirrorMaterial) {
        if (label.includes('金玉') || label.includes('太虚') || label.includes('痴念')) return createFengyueMirror(mirrorMaterial);
        if (label.includes('情劫')) return createHonglouVase('red');
        if (label.includes('情鬼')) return createHonglouVase('grey');
        return createHonglouVase('pale');
      }
      function createIncenseTimer() {
        const group = new THREE.Group(); group.position.set(3.6, -1.65, 1.5); group.rotation.y = -0.35;
        const wood = new THREE.MeshStandardMaterial({ color: '#4f2b19', roughness: .6 });
        const bronze = new THREE.MeshStandardMaterial({ color: '#8f673c', roughness: .3, metalness: .55 });
        const censer = new THREE.Mesh(new THREE.CylinderGeometry(.38, .46, .28, 48), bronze); censer.castShadow = true; group.add(censer);
        const ash = new THREE.Mesh(new THREE.CylinderGeometry(.33, .35, .035, 48), new THREE.MeshStandardMaterial({ color: '#b9afa0', roughness: .8 })); ash.position.y = .16; group.add(ash);
        const stick = new THREE.Mesh(new THREE.CylinderGeometry(.018, .018, 1.35, 12), wood); stick.position.y = .82; stick.rotation.z = -0.08; group.add(stick);
        const ember = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowMap, transparent: true, color: '#ff8e5a', depthWrite: false })); ember.scale.set(.18,.18,.18); group.add(ember);
        const smokeGeo = new THREE.BufferGeometry(); const count = 60; const pos = new Float32Array(count * 3);
        for (let i = 0; i < count; i++) { pos[i*3] = 0; pos[i*3+1] = Math.random() * 1.8; pos[i*3+2] = 0; }
        smokeGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
        const smoke = new THREE.Points(smokeGeo, new THREE.PointsMaterial({ map: glowMap, size: .16, transparent: true, opacity: .25, color: '#d9c8ba', depthWrite: false }));
        group.add(smoke);
        group.updateBurn = function(progress, time) {
          const remain = Math.max(.05, 1 - progress);
          stick.scale.y = remain; stick.position.y = .18 + .675 * remain;
          ember.position.set(Math.sin(time * 2) * .025, .18 + 1.35 * remain, Math.cos(time * 1.8) * .025);
          ember.material.opacity = progress >= 1 ? 0 : .9;
          ash.scale.set(1 + progress * .6, 1, 1 + progress * .6);
          const arr = smokeGeo.attributes.position.array;
          for (let i = 0; i < count; i++) {
            arr[i*3] = Math.sin(time * .8 + i) * .08 + Math.sin(i) * .04;
            arr[i*3+1] = .22 + ((time * .22 + i / count * 1.8) % 1.8);
            arr[i*3+2] = Math.cos(time * .7 + i * 1.7) * .08;
          }
          smokeGeo.attributes.position.needsUpdate = true;
        };
        return group;
      }
      function addBackdrop() {
        const gateTex = makeTextTexture('太虚幻境', 512, 180, true);
        const gate = new THREE.Mesh(new THREE.PlaneGeometry(7.2, 2.4), new THREE.MeshBasicMaterial({ map: gateTex, transparent: true, opacity: .28, depthWrite: false }));
        gate.position.set(0, 1.9, -8); scene.add(gate);
        const moon = new THREE.Mesh(new THREE.CircleGeometry(2.4, 96), new THREE.MeshBasicMaterial({ color: '#ead6c5', transparent: true, opacity: .08, depthWrite: false }));
        moon.position.set(-3.4, 2.1, -9); scene.add(moon);
      }
      addBackdrop();
      const bgCount = 900, bgGeo = new THREE.BufferGeometry(), bgPos = new Float32Array(bgCount * 3);
      for (let i = 0; i < bgCount; i++) { bgPos[i*3] = (Math.random()-.5)*70; bgPos[i*3+1] = (Math.random()-.5)*45; bgPos[i*3+2] = (Math.random()-.5)*60; }
      bgGeo.setAttribute('position', new THREE.BufferAttribute(bgPos, 3));
      const bgPetals = new THREE.Points(bgGeo, new THREE.PointsMaterial({ color:'#f0d8d0', size:.34, map:glowMap, blending:THREE.AdditiveBlending, transparent:true, opacity:.5, depthWrite:false })); scene.add(bgPetals);
      const cubeRenderTarget = new THREE.WebGLCubeRenderTarget(128); const cubeCamera = new THREE.CubeCamera(.1, 80, cubeRenderTarget); let mirrorForReflection = null;
      function createRule(x, y, z, colorIdx, label) {
        let mirrorMaterial = null;
        if (label.includes('金玉')) mirrorMaterial = new THREE.MeshPhysicalMaterial({ color:0xc8c0b8, roughness:.08, metalness:1, envMap:cubeRenderTarget.texture, clearcoat:1 });
        const model = getModelForLabel(label, mirrorMaterial); model.position.set(x,y,z); model.userData = { type: label, active: true, hoverActive: false, colorIndex: colorIdx };
        model.traverse(function(child){ if(child.isMesh){ child.castShadow = true; child.receiveShadow = true; } if(child.userData && child.userData.isReflective) mirrorForReflection = child; });
        scene.add(model); return model;
      }
      function createConnection(a, b) { const geo = new THREE.BufferGeometry().setFromPoints([a.position.clone(), b.position.clone()]); const line = new THREE.Line(geo, new THREE.LineBasicMaterial({ color:'#c4a0c8', transparent:true, opacity:.32 })); scene.add(line); return { line: line, from: a, to: b }; }
      function updateConn(c) { const arr = c.line.geometry.attributes.position.array; arr[0]=c.from.position.x; arr[1]=c.from.position.y; arr[2]=c.from.position.z; arr[3]=c.to.position.x; arr[4]=c.to.position.y; arr[5]=c.to.position.z; c.line.geometry.attributes.position.needsUpdate = true; }
      function disposeObj(obj) { obj.traverse(function(child){ if(child.geometry) child.geometry.dispose(); if(child.material){ if(Array.isArray(child.material)) child.material.forEach(function(m){m.dispose();}); else child.material.dispose(); } }); }
      function removeRule(mesh) { state.connections = state.connections.filter(function(c){ if(c.from===mesh || c.to===mesh){ scene.remove(c.line); c.line.geometry.dispose(); c.line.material.dispose(); return false; } return true; }); scene.remove(mesh); disposeObj(mesh); state.rules = state.rules.filter(function(r){ return r !== mesh; }); }
      function spawnNear(origin, label) { if(state.rules.length >= MAX_RULES) return null; const pos = origin.position.clone(); pos.x += (Math.random()-.5)*2.7; pos.y += (Math.random()-.5)*2.5; pos.z += (Math.random()-.5)*2.7; const nr = createRule(pos.x,pos.y,pos.z,origin.userData.colorIndex+1,label); state.rules.push(nr); state.connections.push(createConnection(origin,nr)); return nr; }
      const r1 = createRule(0,.2,0,0,'木石前盟'), r2 = createRule(2.2,.6,.7,1,'金玉良缘'), r3 = createRule(-1.5,-.3,1.4,2,'太虚幻境');
      state.rules.push(r1,r2,r3); state.connections.push(createConnection(r1,r2), createConnection(r2,r3), createConnection(r3,r1));
      const incense = createIncenseTimer(); scene.add(incense);
      const raycaster = new THREE.Raycaster(), pointer = new THREE.Vector2(); let hovered = null, hoverAccum = 0, trimT = 0, temptT = 0, rafId = 0, disposed = false;
      const messagePool = {
        click: ['你触动了一段情缘，却生出了新的劫难。','金风玉露一相逢，幻境便多一缕牵缠。','一念入红尘，花影又生枝。'],
        gaze: ['你凝视缘起，却滋养了痴念。','看得太久，镜花也会生根。','一眼成痴，水月添痕。'],
        trim: ['万境归空，一缕情丝随风而逝。','香烟散处，旧缘自解。','花影渐淡，情障少了一重。'],
        tempt: ['情鬼诱你入迷，幻境又添新障。','镜中红粉一笑，劫数暗生。','风月一闪，心猿又动。'],
        time: ['香初燃，梦门已启。','烟入绛云，情缘渐密。','残香欲断，判词将成。','香尽梦醒，薄命司开。']
      };
      function pick(list){ return list[Math.floor(Math.random()*list.length)]; }
      function showMessage(t, force) { const now = Date.now(); if(!force && now - state.lastPromptAt < 1200) return; state.lastPromptAt = now; const m = mountEl.querySelector('#message'); m.textContent = t; m.style.opacity = '1'; setTimeout(function(){ if(m) m.style.opacity='0'; }, 2400); }
      function updateEntropy(){ state.entropy = Math.min(1, state.rules.length / MAX_RULES); mountEl.querySelector('#entropy-display').textContent = '情障 H = ' + state.entropy.toFixed(2); mountEl.querySelector('#rule-count').textContent = '情缘：' + state.rules.length; }
      function setHover(obj, active){ obj.traverse(function(child){ if(child.isMesh && child.material && child.material.emissive){ child.material.emissive.set(active ? '#3a1410' : '#000000'); } }); }
      function pointerFromEvent(e) { const rect = renderer.domElement.getBoundingClientRect(); pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1; pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1; }
      function onPointerMove(e){ if(state.frozen) return; pointerFromEvent(e); raycaster.setFromCamera(pointer,camera); const hits = raycaster.intersectObjects(state.rules, true); if(hits.length){ let obj = hits[0].object; while(obj && !state.rules.includes(obj)) obj = obj.parent; if(obj && obj !== hovered){ if(hovered) setHover(hovered,false); hovered = obj; setHover(hovered,true); hovered.userData.hoverActive = true; state.hoverStreak++; state.maxHoverStreak = Math.max(state.maxHoverStreak,state.hoverStreak); } state.lastActivity = Date.now(); state.stillTime = 0; } else if(hovered){ setHover(hovered,false); hovered.userData.hoverActive = false; hovered = null; state.hoverStreak = 0; } }
      function onPointerDown(e){ if(state.frozen) return; pointerFromEvent(e); raycaster.setFromCamera(pointer,camera); const hits = raycaster.intersectObjects(state.rules,true); if(hits.length){ let obj = hits[0].object; while(obj && !state.rules.includes(obj)) obj = obj.parent; if(obj && obj.userData.active){ const now = Date.now(); if(now - state.lastClickTime < 420) state.rapidClicks++; state.lastClickTime = now; state.totalClicks++; state.lastActivity = Date.now(); state.stillTime = 0; spawnNear(obj,'情劫'); obj.userData.active = false; obj.traverse(function(child){ if(child.isMesh && child.material && child.material.color) child.material.color.multiplyScalar(.72); }); updateEntropy(); showMessage(pick(messagePool.click)); if(obj.userData.type && obj.userData.type.includes('金玉')) { state.mirrorFlipCount++; showMessage('宝鉴翻面，正照红粉，反见清骨。', true); } } } }
      function updateHover(dt){ if(!hovered || !hovered.userData.hoverActive){ hoverAccum = 0; return; } hoverAccum += dt; if(hoverAccum >= 1){ hoverAccum = 0; state.totalHoverCreates++; state.lastActivity = Date.now(); state.stillTime = 0; spawnNear(hovered,'痴念'); updateEntropy(); showMessage(pick(messagePool.gaze)); } }
      const temptDot = mountEl.querySelector('#temptation-dot');
      function updateStillness(dt){ const idle = (Date.now() - state.lastActivity) / 1000; state.stillTime = idle; state.idleTotal += dt; state.peakStillness = Math.max(state.peakStillness, idle); mountEl.querySelector('#still-time').textContent = '空寂：' + Math.floor(idle) + 's'; if(idle > 8 && state.rules.length > 2){ trimT += dt; if(trimT >= 3){ trimT = 0; removeRule(state.rules[Math.floor(Math.random()*state.rules.length)]); state.trimmedCount++; updateEntropy(); showMessage(pick(messagePool.trim)); } } else trimT = 0; if(idle > 6 && !state.frozen){ temptT += dt; if(temptT > 4){ temptT = 0; temptDot.style.display = 'block'; temptDot.style.left = (Math.random()*80+10)+'%'; temptDot.style.top = (Math.random()*70+15)+'%'; setTimeout(function(){ temptDot.style.display='none'; }, 2500); } } }
      temptDot.addEventListener('click', function(e){ e.stopPropagation(); state.lastActivity = Date.now(); state.stillTime = 0; showMessage(pick(messagePool.tempt), true); if(state.rules.length){ const b = state.rules[Math.floor(Math.random()*state.rules.length)]; spawnNear(b,'情鬼'); spawnNear(b,'情鬼'); } updateEntropy(); temptDot.style.display = 'none'; });
      function updateCountdown(){ if(state.frozen) return; const elapsed = (Date.now() - state.gameStartTime) / 1000; state.countdown = Math.max(0, GAME_DURATION - Math.floor(elapsed)); const progress = Math.min(1, elapsed / GAME_DURATION); mountEl.querySelector('#incense-fill').style.width = (progress*100).toFixed(1)+'%'; const phase = progress < .35 ? '香初燃' : progress < .7 ? '烟入绛云' : progress < .94 ? '残香欲断' : '香尽梦醒'; mountEl.querySelector('#censer-text').textContent = phase + ' · ' + state.countdown + '息'; incense.updateBurn(progress, elapsed); if([20,10,5,3].includes(state.countdown)) showMessage(phase + '，' + pick(messagePool.time)); if(state.countdown <= 0) determineEnding(); }
      function determineEnding(){ if(state.frozen) return; const ratio = state.stillTime / GAME_DURATION; if(state.totalClicks === 0 && state.totalHoverCreates === 0 && ratio > .85) triggerEnding('pure_stillness'); else if(state.totalHoverCreates >= 4 && state.totalClicks === 0) triggerEnding('gazer'); else if(state.rapidClicks >= 4) triggerEnding('frenzy'); else if(state.maxHoverStreak >= 4 && state.totalClicks >= 2) triggerEnding('obsession'); else if(state.rules.length >= 18) triggerEnding('breeder'); else if(state.rules.length <= 5 && state.totalClicks >= 3) triggerEnding('paradox'); else if(state.totalClicks >= 6 && state.totalHoverCreates <= 1) triggerEnding('explorer'); else if(state.trimmedCount >= 2) triggerEnding('recluse'); else if(state.totalClicks >= 2 && state.totalHoverCreates >= 2) triggerEnding('balanced'); else if(state.totalClicks === 1 && state.totalHoverCreates === 0) triggerEnding('single_touch'); else triggerEnding('default'); }
      function triggerEnding(type){ state.frozen = true; state.phase = 'ending'; const data = PARADOX_ENDINGS[type] || PARADOX_ENDINGS.default; mountEl.querySelector('#cert-title').textContent = data.title; mountEl.querySelector('#cert-poem').textContent = '《' + data.poem + '》'; mountEl.querySelector('#cert-stats').innerHTML = '情缘总数：' + state.rules.length + '  涉情次数：' + state.totalClicks + '<br>痴念滋生：' + state.totalHoverCreates + '  空寂峰值：' + Math.floor(state.peakStillness) + 's<br>快速连击：' + state.rapidClicks + '次  最长凝视：' + state.maxHoverStreak + '次'; mountEl.querySelector('#cert-quote').textContent = data.quote; mountEl.querySelector('#cert-analysis').textContent = data.analysis; mountEl.querySelector('#cert-overlay').style.display = 'flex'; }
      mountEl.querySelector('#cert-close').onclick = function(){ mountEl.querySelector('#cert-overlay').style.display='none'; state.frozen=false; state.phase='playing'; state.gameStartTime=Date.now(); state.countdown=GAME_DURATION; state.totalClicks=0; state.totalHoverCreates=0; state.stillTime=0; state.lastActivity=Date.now(); state.hoverStreak=0; state.maxHoverStreak=0; state.rapidClicks=0; state.lastClickTime=0; state.trimmedCount=0; state.idleTotal=0; state.peakStillness=0; updateEntropy(); };
      mountEl.querySelector('#cert-download').onclick = function(){ const blob = new Blob([mountEl.querySelector('#cert-title').textContent + '\\n\\n' + mountEl.querySelector('#cert-poem').textContent + '\\n\\n' + mountEl.querySelector('#cert-quote').textContent + '\\n\\n' + mountEl.querySelector('#cert-analysis').textContent], { type:'text/plain;charset=utf-8' }); const a = document.createElement('a'); a.download = 'taixu-panci.txt'; a.href = URL.createObjectURL(blob); a.click(); URL.revokeObjectURL(a.href); };
      function onKey(e){ if(e.key === 'q' || e.key === 'Q'){ showMessage('你试图远观，却仍在幻界之中。', true); state.lastActivity = Date.now(); state.stillTime = 0; } }
      function onResize(){ camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight); }
      renderer.domElement.addEventListener('pointermove', onPointerMove);
      renderer.domElement.addEventListener('pointerdown', onPointerDown);
      window.addEventListener('resize', onResize);
      document.addEventListener('keydown', onKey);
      const clock = new THREE.Clock();
      function animate(){ if(disposed) return; const dt = Math.min(clock.getDelta(), .3); if(!state.frozen){ updateCountdown(); state.rules.forEach(function(r){ r.rotation.y += .002; r.rotation.z += .0008; }); bgPetals.rotation.y += .0002; updateHover(dt); updateStillness(dt); state.connections.forEach(updateConn); updateEntropy(); controls.autoRotate = true; if(mirrorForReflection && Math.floor(performance.now()/120) % 8 === 0){ mirrorForReflection.visible = false; cubeCamera.position.copy(mirrorForReflection.getWorldPosition(new THREE.Vector3())); cubeCamera.update(renderer, scene); mirrorForReflection.visible = true; } } else controls.autoRotate = false; controls.update(); renderer.render(scene,camera); rafId = requestAnimationFrame(animate); }
      updateEntropy(); animate();
      return { destroy: function(){ disposed = true; cancelAnimationFrame(rafId); renderer.domElement.removeEventListener('pointermove', onPointerMove); renderer.domElement.removeEventListener('pointerdown', onPointerDown); window.removeEventListener('resize', onResize); document.removeEventListener('keydown', onKey); state.rules.forEach(disposeObj); state.connections.forEach(function(c){ c.line.geometry.dispose(); c.line.material.dispose(); }); renderer.dispose(); mountEl.innerHTML = ''; }, reset: function(){ mountEl.querySelector('#cert-close')?.click(); } };
    }

    const homeView = document.getElementById('home-view');
    const shell = document.getElementById('game-shell');
    const mount = document.getElementById('game-mount');
    const back = document.getElementById('back-home');
    let currentApp = null;
    async function showView(view) {
      if (currentApp && currentApp.destroy) currentApp.destroy();
      currentApp = null;
      if (view === 'home') {
        shell.classList.remove('active');
        homeView.style.display = 'block';
        mount.innerHTML = '';
        return;
      }
      homeView.style.display = 'none';
      shell.classList.add('active');
      mount.innerHTML = '<div class="loading-state">正在入境...</div>';
      if (view === 'rmti') currentApp = initRmtiApp(mount);
      if (view === 'mirror') currentApp = initMirrorApp(mount);
      if (view === 'paradox') currentApp = await initParadoxApp(mount);
    }
    window.showView = showView;
    document.querySelectorAll('[data-view]').forEach(function(btn){ btn.addEventListener('click', function(){ showView(btn.dataset.view); }); });
    back.addEventListener('click', function(){ showView('home'); });
  </script>
</body>
</html>`;

const out = html
  .replace('__RMTI_AVAILABLE_IMAGES__', JSON.stringify(existingImages))
  .replace('__RMTI_METHODOLOGY_HTML__', JSON.stringify(methodologyHtml))
  .replace('__RMTI_QUESTIONS_DECL__', rmtiQuestionsDecl)
  .replace('__RMTI_PERSONALITY_FUNCTION__', getPersonality)
  .replace('__RMTI_DIMENSION_FUNCTION__', getDimensionInsight)
  .replace('__MIRROR_DATA_AND_FUNCTIONS__', mirrorData)
  .replace('__PARADOX_ENDINGS_DECL__', paradoxEndings);

fs.writeFileSync(path.join(root, 'index.html'), out, 'utf8');
console.log('Wrote index.html with', out.length, 'characters');
