// WCAG contrast + overlap checker for the explainer.
// node check.js [step=0.25] [from=0] [to=DURATION]
// For each sampled time: screenshot with text hidden → real background pixels behind each word;
// contrast ratio (WCAG 2.x relative luminance) of the text colour (with its effective opacity)
// against those pixels. Normal text needs 4.5:1, large text 3:1. Text that is mid-transition
// (effective opacity < .9) or rendered under 10px tall is skipped as not-yet-readable.
// Overlap: a word box intersecting a different text block, or a card it is not part of.
const { chromium } = require('/Users/parijat/dev/primer-v2/node_modules/@playwright/test');
const path = require('path'), fs = require('fs');
(async () => {
  const [stepA, fromA, toA] = process.argv.slice(2);
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1920, height: 1080 } });
  await p.goto('file://' + path.join(__dirname, 'index.html')); await p.evaluate(() => document.fonts.ready); await p.waitForTimeout(400);
  const D = await p.evaluate(() => window.DURATION), step = +(stepA || .25), from = +(fromA || 0), to = +(toA || D);
  const issues = [];
  for (let t = from; t <= to + 1e-6; t += step) {
    await p.evaluate(t => { window.seek(t); document.getElementById('grain').style.display = 'none'; document.getElementById('vig').style.display = 'none';
      if (!document.getElementById('__pe')) { const s = document.createElement('style'); s.id = '__pe'; s.textContent = '#ui, #ui * { pointer-events: auto !important; }'; document.head.appendChild(s); } }, t);
    const items = await p.evaluate(() => {
      const out = [], vw = 1920, vh = 1080;
      const effOpacity = el => { let o = 1; for (let e = el; e && e !== document.body; e = e.parentElement) { const cs = getComputedStyle(e); if (cs.visibility === 'hidden' || cs.display === 'none') return 0; o *= +cs.opacity; } return o; };
      const blocks = new Map(); let bid = 0;
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      for (let n; (n = walker.nextNode());) {
        if (!n.textContent.trim()) continue; const el = n.parentElement; if (!el || el.closest('script,style,.deco')) continue;
        if (/^[\p{Extended_Pictographic}\uFE0F\u200D\s]+$/u.test(n.textContent)) continue;
        const op = effOpacity(el); if (op < .9) continue;
        const cs = getComputedStyle(el); const block = el.closest('.ttl, .c, .mc, .tab, .bm, .bub, .gl, .chip, .cta, .num, .step, .keepbtn, .abs') || el;
        if (!blocks.has(block)) blocks.set(block, bid++);
        const r = document.createRange(); r.selectNodeContents(n);
        for (const rc0 of r.getClientRects()) {
          let rc = { left: rc0.left, top: rc0.top, right: rc0.right, bottom: rc0.bottom };
          for (let a = el; a && a !== document.body; a = a.parentElement) { const ov = getComputedStyle(a).overflow; if (ov !== 'visible') { const b = a.getBoundingClientRect();
            rc = { left: Math.max(rc.left, b.left), top: Math.max(rc.top, b.top), right: Math.min(rc.right, b.right), bottom: Math.min(rc.bottom, b.bottom) }; } }
          rc.width = rc.right - rc.left; rc.height = rc.bottom - rc.top;
          if (rc.width < 2 || rc.height < 10) continue;
          const hit = document.elementFromPoint(Math.min(1919, Math.max(0, (rc.left + rc.right) / 2)), Math.min(1079, Math.max(0, (rc.top + rc.bottom) / 2)));
          if (hit && !(el.contains(hit) || hit.contains(el) || (block && block.contains(hit)))) continue; // covered by something above it
          if (rc.right < 0 || rc.bottom < 0 || rc.left > vw || rc.top > vh) continue;
          const fs = parseFloat(cs.fontSize) * (rc0.height / (parseFloat(cs.lineHeight) || parseFloat(cs.fontSize) * 1.2));
          out.push({ text: n.textContent.trim().slice(0, 40), x: rc.left, y: rc.top, w: rc.width, h: rc.height, color: cs.color, op, px: fs, bold: +cs.fontWeight >= 700, block: blocks.get(block), card: !!el.closest('.c,.mc,.win'), overOk: !!el.closest('.over-ok') });
        }
      }
      const cards = [...document.querySelectorAll('.c, .mc, .win')].filter(c => effOpacity(c) > .6).map(c => { const r = c.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height, el: c }; })
        .filter(r => r.w > 30 && r.x < vw && r.y < vh && r.x + r.w > 0 && r.y + r.h > 0)
        .filter(() => +getComputedStyle(document.getElementById('paperwash')).opacity < .95)
        .filter(r => { const h = document.elementFromPoint(Math.min(1919, Math.max(0, r.x + r.w / 2)), Math.min(1079, Math.max(0, r.y + r.h / 2))); return h && (r.el.contains(h) || h.closest('.ttl')); });
      // tag each item with the cards that are not its own ancestor
      const all = [...document.querySelectorAll('.c, .mc, .win')];
      return { out, cards: cards.map(({ x, y, w, h, el }) => ({ x, y, w, h, i: all.indexOf(el) })) };
    });
    // background: hide all text
    await p.addStyleTag({ content: '* { color: transparent !important; text-shadow: none !important; -webkit-text-stroke: 0 !important; } #__x{}' });
    const bg = (await p.screenshot({ type: 'png' })).toString('base64');
    await p.evaluate(() => { const s = [...document.querySelectorAll('style')].pop(); s.remove(); });
    const res = await p.evaluate(async ({ bg, items }) => {
      const img = new Image(); img.src = 'data:image/png;base64,' + bg; await img.decode();
      const cv = document.createElement('canvas'); cv.width = 1920; cv.height = 1080; const cx = cv.getContext('2d'); cx.drawImage(img, 0, 0);
      const data = cx.getImageData(0, 0, 1920, 1080).data;
      const lin = c => { c /= 255; return c <= .04045 ? c / 12.92 : Math.pow((c + .055) / 1.055, 2.4); };
      const L = (r, g, b) => .2126 * lin(r) + .7152 * lin(g) + .0722 * lin(b);
      const parse = s => { const m = s.match(/[\d.]+/g).map(Number); return [m[0], m[1], m[2], m[3] == null ? 1 : m[3]]; };
      return items.map(it => {
        const [r, g, b, a] = parse(it.color), alpha = a * it.op, ratios = [];
        for (let yy = 0; yy < 6; yy++) for (let xx = 0; xx < 12; xx++) {
          const px = Math.round(it.x + (xx + .5) / 12 * it.w), py = Math.round(it.y + (yy + .5) / 6 * it.h);
          if (px < 0 || py < 0 || px >= 1920 || py >= 1080) continue;
          const k = (py * 1920 + px) * 4, br = data[k], bgc = data[k + 1], bb = data[k + 2];
          const fr = r * alpha + br * (1 - alpha), fg = g * alpha + bgc * (1 - alpha), fb = b * alpha + bb * (1 - alpha);
          const l1 = L(fr, fg, fb), l2 = L(br, bgc, bb); ratios.push((Math.max(l1, l2) + .05) / (Math.min(l1, l2) + .05));
        }
        ratios.sort((a, b) => a - b);
        return ratios.length ? ratios[Math.floor(ratios.length * .05)] : 99;
      });
    }, { bg, items: items.out });
    items.out.forEach((it, i) => {
      const large = it.px >= 24 || (it.bold && it.px >= 18.66), need = large ? 3 : 4.5;
      if (res[i] < need) issues.push({ t: +t.toFixed(2), kind: 'contrast', text: it.text, ratio: +res[i].toFixed(2), need, px: Math.round(it.px) });
    });
    const I = (a, b) => Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)) * Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));
    const o = items.out;
    for (let i = 0; i < o.length; i++) for (let j = i + 1; j < o.length; j++)
      if (o[i].block !== o[j].block && I(o[i], o[j]) > .15 * Math.min(o[i].w * o[i].h, o[j].w * o[j].h)) issues.push({ t: +t.toFixed(2), kind: 'text-over-text', text: o[i].text + ' ⟷ ' + o[j].text });
    const cs2 = items.cards; if (t > 12.3) for (let i = 0; i < cs2.length; i++) for (let j = i + 1; j < cs2.length; j++) {
      const ov = I(cs2[i], cs2[j]); if (ov > .12 * Math.min(cs2[i].w * cs2[i].h, cs2[j].w * cs2[j].h)) issues.push({ t: +t.toFixed(2), kind: 'card-over-card', text: `#${cs2[i].i} ⟷ #${cs2[j].i}` }); }
    for (const it of o) if (!it.card && !it.overOk) for (const c of items.cards) if (I(it, c) > .2 * it.w * it.h) { issues.push({ t: +t.toFixed(2), kind: 'text-over-card', text: it.text }); break; }
  }
  await b.close();
  // summarise: group by kind+text, list time spans
  const g = new Map();
  for (const x of issues) { const k = x.kind + ' | ' + x.text + (x.need ? ` | need ${x.need}` : ''); if (!g.has(k)) g.set(k, []); g.get(k).push(x); }
  const lines = [...g.entries()].map(([k, xs]) => `${k} | worst ${xs.reduce((m, x) => Math.min(m, x.ratio ?? 99), 99)} | t ${xs[0].t}–${xs[xs.length - 1].t} (${xs.length})`);
  fs.writeFileSync(path.join(__dirname, 'check-report.txt'), lines.join('\n'));
  console.log(`${issues.length} issue samples, ${g.size} distinct`); console.log(lines.join('\n'));
})().catch(e => { console.error(e); process.exit(1); });
