// Checks for the specimens page. Run: node checks/specimens.cjs  (PORT defaults to 8850)
// Prints PASS/FAIL per check and exits non-zero on any failure.
const { chromium } = require('/Users/parijat/dev/primer-v2/node_modules/@playwright/test');
const BASE = `http://localhost:${process.env.PORT || 8850}/`;
const SHOTS = process.env.SHOTS; // set to a folder to save screenshots

let passed = 0, failed = 0;
function check(name, ok, detail = '') {
  if (ok) { passed++; console.log(`PASS ${name}`); }
  else { failed++; console.log(`FAIL ${name}${detail ? ' :: ' + detail : ''}`); }
}
const wait = ms => new Promise(r => setTimeout(r, ms));

const VIEWPORTS = {
  desktop: { viewport: { width: 1440, height: 900 } },
  phone: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 3 },
  small: { viewport: { width: 360, height: 740 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 },
};

async function newPage(browser, vpName, extra = {}) {
  const ctx = await browser.newContext({ ...VIEWPORTS[vpName], ...extra });
  const page = await ctx.newPage();
  const errors = [];
  page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await wait(300);
  return { ctx, page, errors };
}
const explore = async page => { await page.click('#explore'); await wait(700); };
const isOpen = page => page.evaluate(() => !document.getElementById('spec').hidden);
const specInfo = page => page.evaluate(() => Object.fromEntries(Object.entries(SPECS).map(([k, s]) => [k, { title: s.title, owner: s.owner, garden: s.garden, from: s.from, next: s.next }])));
const inView = (r, vw, vh) => r.left >= 0 && r.top >= 0 && r.right <= vw && r.bottom <= vh;

// Pan to the spec's garden, then click the card centre with a real mouse click.
async function openViaCard(page, id, spec) {
  await page.evaluate(g => goGarden(g), spec.garden);
  await wait(900);
  const r = await page.evaluate(id => { const b = document.querySelector(`[data-spec="${id}"]`).getBoundingClientRect(); return { left: b.left, top: b.top, right: b.right, bottom: b.bottom, w: innerWidth, h: innerHeight }; }, id);
  const cx = (r.left + r.right) / 2, cy = (r.top + r.bottom) / 2;
  if (!(cx > 0 && cy > 0 && cx < r.w && cy < r.h)) return { ok: false, why: `card centre off screen (${cx | 0},${cy | 0})` };
  await page.mouse.click(cx, cy);
  await wait(450);
  return { ok: await isOpen(page), why: 'view did not open' };
}
async function closeEsc(page) { await page.keyboard.press('Escape'); await wait(450); }

async function openingCard(page, vp) {
  const c = await page.evaluate(() => {
    const t = s => (document.querySelector(s)?.textContent || '').replace(/ /g, ' ').trim();
    const visible = s => { const el = document.querySelector(s); if (!el) return false; const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== 'hidden'; };
    return { h1: t('#card h1'), lede: t('#card .lede'), btn: t('#f button'), email: !!document.querySelector('#f input[type=email][required]'), reassure: t('#reassure'), explore: t('#explore'), oldWander: !!document.getElementById('wander'),
      ledeVisible: visible('#card .lede'), wait: document.getElementById('waitnote') ? t('#waitnote') : null, pill: t('#pill'), label: document.getElementById('card').getAttribute('aria-label'),
      lowerName: (document.body.innerText.match(/\bgrdn\b/g) || []).length };
  });
  check(`${vp}: headline unchanged`, c.h1 === 'Everything worth a revisit.', c.h1);
  check(`${vp}: definition line is the owner's line: keep, build on it with your agents, share`, c.ledeVisible && c.lede === 'Keep what you find online, build on it with your agents, share it with the people who’d love it.', c.lede);
  check(`${vp}: form button says "Reserve your Grdn"`, c.email && c.btn === 'Reserve your Grdn', c.btn);
  check(`${vp}: pill and card label say "Reserve your Grdn"`, c.pill === 'Reserve your Grdn' && c.label === 'Reserve your Grdn', `${c.pill} / ${c.label}`);
  check(`${vp}: no lower-case "grdn" in visible text`, c.lowerName === 0, String(c.lowerName));
  check(`${vp}: reassure line unchanged`, c.reassure === 'We’ll email you once, when your garden is ready.', c.reassure);
  check(`${vp}: no opens-soon line on the opening card (owner: the gardens behind it are clearly examples)`, c.wait === null && !/opens soon|example gardens/i.test(c.lede), c.wait);
  await widows(page, vp); // every line on the card, not only the wait line
  check(`${vp}: Wander is now "Explore the gardens"`, c.explore === 'Explore the gardens' && !c.oldWander, c.explore);
}

// The made line names Grdn as the maker and the owner as the keeper; possessives and plurals read right for every owner.
const MADE = { titan: 'Grdn built this game from 3 things Leo kept:', moon: 'Grdn built this dashboard from 3 things Grandpa Tom kept:', paper: 'Grdn wrote this paper from 4 gardens Amara follows:',
  mood: 'Grdn built this moodboard from 4 things Mo kept:', kyoto: 'Grdn built this planner from 3 things Mei & Jo kept:', recipe: 'Grdn built this scaler from 3 things Priya & Sam kept:', savings: 'Grdn built this chart from 2 things Dami kept:',
  stream: 'This stream follows 3 feeds and what Lena kept last week:', agent: 'Arjun’s agent tends this garden with him, through Grdn’s MCP tools:' };
// The badge on each specimen card names what you do with it.
const BADGE = { titan: 'Play', paper: 'Read', moon: 'View', mood: 'View', kyoto: 'Try', recipe: 'Try', savings: 'Try', stream: 'Try', agent: 'Watch' };
async function badges(page, vp) {
  const b = await page.evaluate(() => [...document.querySelectorAll('[data-spec]')].map(c => { const m = c.querySelector('.open-mark'); return { id: c.dataset.spec, t: m.textContent.trim(), after: getComputedStyle(m, '::after').content, label: c.getAttribute('aria-label') }; }));
  const bad = b.filter(x => x.t !== BADGE[x.id] || x.after !== '" ↗"' || !x.label.startsWith(BADGE[x.id] + ' '));
  check(`${vp}: specimen badges say Play/Read/Try/View by kind (${b.length})`, b.length === Object.keys(BADGE).length && bad.length === 0, JSON.stringify(bad));
}
async function everyCardOpens(page, vp, specs) {
  for (const [id, s] of Object.entries(specs)) {
    const o = await openViaCard(page, id, s);
    if (!o.ok) { check(`${vp}: card ${id} opens on click`, false, o.why); continue; }
    const v = await page.evaluate(() => ({ title: document.getElementById('spec-title').textContent, lead: document.querySelector('#spec-made > span:first-child')?.textContent.trim(), chips: document.querySelectorAll('#spec-made .chip').length }));
    check(`${vp}: card ${id} opens on click, title "${s.title}"`, v.title === s.title, v.title);
    check(`${vp}: ${id} made line reads "${MADE[id]}" with ${s.from.length} chips`, v.lead === MADE[id] && v.chips === s.from.length, `${v.lead} / ${v.chips}`);
    const shown = await page.evaluate(t => [...document.querySelectorAll('#spec .panel *')].filter(e => e.children.length === 0 && e.textContent.trim() === t && e.getClientRects().length && e.getBoundingClientRect().width > 2).length, s.title);
    check(`${vp}: ${id} title shows once`, shown === 1, String(shown));
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/${vp}-${id}.png` });
    await closeEsc(page);
  }
}

async function whereNext(page, vp, specs) {
  for (const [id, s] of Object.entries(specs)) {
    for (let i = 0; i < s.next.length; i++) {
      const n = s.next[i];
      await page.evaluate(id => openSpec(id), id); await wait(450);
      await page.locator(`#spec-next .nx[data-i="${i}"]`).click();
      await wait(1100);
      if (n.open) {
        const t = await page.evaluate(() => document.getElementById('spec-title').textContent);
        check(`${vp}: ${id} next[${i}] opens ${n.open}`, (await isOpen(page)) && t === specs[n.open].title, t);
        await closeEsc(page);
      } else {
        const r = await page.evaluate(name => { const h = [...document.querySelectorAll('.garden h2')].find(h => h.textContent.trim() === name); if (!h) return null; const b = h.getBoundingClientRect(); return { left: b.left, top: b.top, right: b.right, bottom: b.bottom, w: innerWidth, h: innerHeight }; }, n.garden);
        const closed = !(await isOpen(page));
        check(`${vp}: ${id} next[${i}] closes and pans to "${n.garden}"`, closed && r && inView(r, r.w, r.h), JSON.stringify({ closed, r }));
        if (!closed) await closeEsc(page);
      }
    }
  }
}

// Recipe sources are the things Priya & Sam kept (links with their sites, and their note), not the ingredients.
async function recipeSources(page, vp) {
  const r = await page.evaluate(() => { const g = G.find(g => g.name === SPECS.recipe.garden), low = s => s.toLowerCase().replace(/[“”".]/g, '').trim();
    const ingredients = ['rice', 'eggs', 'spring onions', 'garlic', 'soy sauce', 'sesame oil', 'oil'];
    return SPECS.recipe.from.map(f => f.t || f).map(c => ({ c, ok: !ingredients.includes(low(c)) && g.things.some(th => th.type === 'link' ? c.includes(th.t) && c.includes(th.dom) : th.type === 'note' ? /^Note:/.test(c) && low(th.text).includes(low(c.replace(/^Note:\s*/, ''))) : false) })); });
  check(`${vp}: recipe sources are Priya & Sam's kept links and note`, r.length >= 2 && r.every(x => x.ok) && r.some(x => /^Note:/.test(x.c)), JSON.stringify(r));
}

// "kept by N" reads as people keeping the thing; the ambient keep still counts up.
async function keptCounts(page, vp) {
  const FORM = /^[\d,]+ (people keep|person keeps) this$/;
  const read = () => page.evaluate(() => [...document.querySelectorAll('.kept')].map(k => k.textContent.trim()));
  const sum = a => a.reduce((t, s) => t + (parseInt(s.replace(/\D/g, ''), 10) || 0), 0);
  const a = await read();
  check(`${vp}: every count reads "N people keep this" (${a.length})`, a.length > 50 && a.every(s => FORM.test(s)), a.filter(s => !FORM.test(s)).slice(0, 3).join(' | '));
  await page.evaluate(() => keepSomething()); await wait(100);
  const b = await read();
  check(`${vp}: someone keeping a thing bumps a count and keeps the wording`, sum(b) > sum(a) && b.every(s => FORM.test(s)), `${sum(a)} -> ${sum(b)}; ${b.filter(s => !FORM.test(s)).slice(0, 3).join(' | ')}`);
}

// After the card closes, the floating pill never sits over card text that is still visible around it.
async function pillClear(page, vp) {
  const moves = [[0, 0], [0, -260], [-380, -120], [260, -540], [-640, -900], [150, -1300], [-90, -170]];
  const bad = [];
  let shown = true;
  for (const [dx, dy] of moves) {
    await page.evaluate(([dx, dy]) => { px += dx; py += dy; apply(); }, [dx, dy]); await wait(200);
    const res = await page.evaluate(() => {
      const pill = document.getElementById('pill'), P = pill.getBoundingClientRect(), out = [];
      const sees = (x, y, host) => { if (x < 0 || y < 0 || x > innerWidth || y > innerHeight) return false; const e = document.elementFromPoint(x, y); return !!e && e.closest('.thing, .garden header') === host; };
      const walker = document.createTreeWalker(document.getElementById('world'), NodeFilter.SHOW_TEXT);
      for (let n; (n = walker.nextNode());) {
        if (!n.textContent.trim()) continue; const host = n.parentElement.closest('.thing, .garden header'); if (!host) continue;
        const range = document.createRange(); range.selectNodeContents(n);
        for (const r of range.getClientRects()) {
          if (r.right <= P.left || r.left >= P.right || r.bottom <= P.top || r.top >= P.bottom) continue;
          const y = (r.top + r.bottom) / 2, ix = (Math.max(r.left, P.left) + Math.min(r.right, P.right)) / 2;
          const pts = [[r.left + 2, y], [r.right - 2, y], [P.left - 3, y], [P.right + 3, y], [ix, P.top - 3], [ix, P.bottom + 3]]
            .filter(([x, yy]) => x >= r.left && x <= r.right && yy >= r.top && yy <= r.bottom && (x < P.left || x > P.right || yy < P.top || yy > P.bottom));
          if (pts.some(([x, yy]) => sees(x, yy, host))) out.push(n.textContent.trim().slice(0, 28));
        }
      }
      return { out, shown: pill.classList.contains('show') && getComputedStyle(pill).opacity === '1' };
    });
    // pixels just outside the pill are solid paper, so no card text shows beside it
    const P = await page.evaluate(() => { const r = document.getElementById('pill').getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; });
    const png = (await page.screenshot({ scale: 'css', clip: { x: P.x - 8, y: P.y - 8, width: P.w + 16, height: P.h + 16 } })).toString('base64');
    const ring = await page.evaluate(async b64 => { const img = await createImageBitmap(await (await fetch('data:image/png;base64,' + b64)).blob()), c = new OffscreenCanvas(img.width, img.height), x = c.getContext('2d'); x.drawImage(img, 0, 0);
      const d = x.getImageData(0, 0, img.width, img.height).data, at = (i, j) => [...d.slice((j * img.width + i) * 4, (j * img.width + i) * 4 + 3)], off = [];
      for (let i = 2; i < img.width - 2; i += 3) off.push(at(i, 3), at(i, img.height - 4)); for (let j = 3; j < img.height - 3; j += 3) off.push(at(3, j), at(img.width - 4, j));
      return off.filter(([r, g, b]) => Math.abs(r - 248) > 4 || Math.abs(g - 245) > 4 || Math.abs(b - 236) > 4).length; }, png);
    if (ring) bad.push(`(${dx},${dy}) ${ring} non-paper pixels around the pill`);
    shown = shown && res.shown;
    bad.push(...res.out.map(t => `(${dx},${dy}) "${t}"`));
  }
  check(`${vp}: the pill shows after the card closes`, shown);
  const band = await page.evaluate(() => { const b = document.getElementById('pillbar'), cs = getComputedStyle(b); return { h: b.getBoundingClientRect().height, bg: cs.backgroundImage }; });
  // soft: at the band's top edge the canvas looks the same with and without the band, so no hard line cuts the cards
  const strip = async () => (await page.screenshot({ scale: 'css', clip: { x: 0, y: (await page.evaluate(() => document.getElementById('pillbar').getBoundingClientRect().top)) + 1, width: VIEWPORTS[vp].viewport.width, height: 3 } })).toString('base64');
  // the band alone over a black backdrop (cards hidden): animated card pictures and text antialiasing under the band's layer would differ between shots on their own
  await page.evaluate(() => { document.getElementById('world').style.visibility = 'hidden'; document.getElementById('view').style.setProperty('background', '#000', 'important'); });
  const withBand = await strip(); await page.evaluate(() => document.getElementById('pillbar').style.visibility = 'hidden'); const noBand = await strip(); await page.evaluate(() => document.getElementById('pillbar').style.visibility = '');
  await page.evaluate(() => { document.getElementById('world').style.visibility = ''; document.getElementById('view').style.removeProperty('background'); apply(); });
  const edge = await page.evaluate(async ([a, b]) => { const px = async b64 => { const i = await createImageBitmap(await (await fetch('data:image/png;base64,' + b64)).blob()), c = new OffscreenCanvas(i.width, i.height), x = c.getContext('2d'); x.drawImage(i, 0, 0); return x.getImageData(0, 0, i.width, i.height).data; };
    const A = await px(a), B = await px(b); let n = 0; for (let k = 0; k < A.length; k += 4) if (Math.abs(A[k] - B[k]) + Math.abs(A[k + 1] - B[k + 1]) + Math.abs(A[k + 2] - B[k + 2]) > 9) n++; return n; }, [withBand, noBand]);
  check(`${vp}: the paper band is soft: solid only around the pill, no hard edge where cards slide under it`, /radial-gradient/.test(band.bg) && edge === 0, JSON.stringify({ ...band, edgePixels: edge }));
  check(`${vp}: the pill never covers visible card text at ${moves.length} pan positions`, bad.length === 0, bad.slice(0, 6).join(' | '));
}

async function recipeAndSavings(page, vp) {
  await page.evaluate(() => openSpec('recipe')); await wait(450);
  const before = await page.evaluate(() => ({ serves: document.querySelector('#spec-body [data-serves]')?.textContent, q: [...document.querySelectorAll('#spec-body [data-q]')].map(e => +e.dataset.q) }));
  const plus = page.locator('#spec-body button[data-step="1"]');
  let ok = before.q.length > 0 && (await plus.count()) === 1;
  if (ok) for (let k = 0; k < 4; k++) await plus.click();
  const after = await page.evaluate(() => ({ serves: document.querySelector('#spec-body [data-serves]')?.textContent, q: [...document.querySelectorAll('#spec-body [data-q]')].map(e => +e.dataset.q), shown: document.querySelector('#spec-body [data-q]')?.textContent }));
  ok = ok && before.serves.trim() === '2' && after.serves.trim() === '6' && before.q.every((q, i) => Math.abs(after.q[i] - q * 3) < 1e-6) && before.q.some((q, i) => after.q[i] !== q);
  check(`${vp}: recipe scaler 2 → 6 triples amounts`, ok, JSON.stringify({ before, after }));
  await closeEsc(page);

  await page.evaluate(() => openSpec('savings')); await wait(450);
  const read = () => page.evaluate(() => ({ total: document.querySelector('#spec-body [data-total]')?.textContent, d: document.querySelector('#spec-body svg path[data-grow]')?.getAttribute('d') }));
  const s0 = await read();
  const years = page.locator('#spec-body input[data-years]');
  let sok = !!s0.total && !!s0.d && (await years.count()) === 1;
  if (sok) { await years.focus(); for (let k = 0; k < 3; k++) await page.keyboard.press('ArrowRight'); }
  const s1 = await read();
  const monthly = page.locator('#spec-body input[data-monthly]');
  if (sok && (await monthly.count()) === 1) { await monthly.focus(); for (let k = 0; k < 2; k++) await page.keyboard.press('ArrowLeft'); } else sok = false;
  const s2 = await read();
  sok = sok && s1.total !== s0.total && s1.d !== s0.d && s2.total !== s1.total && s2.d !== s1.d;
  check(`${vp}: savings chart total and path follow the inputs`, sok, JSON.stringify({ s0: s0.total, s1: s1.total, s2: s2.total }));
  await closeEsc(page);
}

async function landerCheck(page, vp) {
  const speedAfter = async hold => {
    await page.evaluate(() => openSpec('titan')); await wait(300);
    const b = await page.locator('#spec-body canvas').boundingBox();
    if (hold) { await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2); await page.mouse.down(); }
    await wait(900);
    const v = await page.evaluate(() => +document.querySelector('#spec-body [data-v]').textContent);
    if (hold) await page.mouse.up();
    return v;
  };
  const free = await speedAfter(false); await closeEsc(page);
  const held = await speedAfter(true);
  check(`${vp}: lander thrust slows the fall (held ${held} < free ${free})`, held < free, `${held} vs ${free}`);
  let txt = '';
  for (let k = 0; k < 40; k++) { txt = await page.evaluate(() => document.querySelector('#spec-body [data-s]').textContent); if (/Landed|Too fast/.test(txt)) break; await wait(250); }
  check(`${vp}: lander shows a landing state`, /Landed|Too fast/.test(txt), txt);
  // The result is a clear card with a restart button; the restart puts the lander back at the top with a full tank.
  const end = await page.evaluate(() => { const l = document.querySelector('#spec-body .lander'), b = l.querySelector('button.again'), r = b && b.getBoundingClientRect(), st = l.querySelector('.stage').getBoundingClientRect();
    return { state: l.dataset.state, btn: b && b.textContent.trim(), shown: !!r && r.width > 0 && r.left >= st.left && r.right <= st.right && r.top >= st.top && r.bottom <= st.bottom }; });
  check(`${vp}: lander result card has a restart button inside the game`, /^(landed|crashed)$/.test(end.state) && /^(Fly again|Try again)$/.test(end.btn) && end.shown, JSON.stringify(end));
  if (end.btn) await page.locator('#spec-body button.again').click();
  await wait(150);
  const re = await page.evaluate(() => ({ state: document.querySelector('#spec-body .lander').dataset.state, fuel: document.querySelector('#spec-body [data-f]').textContent, alt: +document.querySelector('#spec-body [data-a]')?.textContent }));
  check(`${vp}: restart flies again with a full tank`, re.state === 'play' && re.fuel === '100' && re.alt > 40, JSON.stringify(re));
  await closeEsc(page);
}

// The view frame: kind and home garden in the header, readable HUD inside the game, Where next rows say what they do.
async function frame(page, vp, specs) {
  await page.evaluate(() => openSpec('titan')); await wait(450);
  const f = await page.evaluate(() => {
    const t = s => (document.querySelector(s)?.textContent || '').replace(/\s+/g, ' ').trim(), st = document.querySelector('#spec-body .stage').getBoundingClientRect(), p = document.querySelector('#spec .panel').getBoundingClientRect();
    const gauges = [...document.querySelectorAll('#spec-body .hud .gauge')].map(g => { const r = g.getBoundingClientRect(); return { t: g.textContent.replace(/\s+/g, ' ').trim(), inside: r.left >= st.left && r.right <= st.right && r.top >= st.top && r.bottom <= st.bottom }; });
    return { kind: t('#spec-kind .kind'), home: t('#spec-kind .home'), head: t('#spec .next .nx-head'), gauges, stageInPanel: st.left >= p.left && st.right <= p.right,
      rows: [...document.querySelectorAll("#spec-next .nx .go")].map(g => g.textContent.replace(/\s+/g, " ").trim()), stream: /stream/i.test(document.getElementById('spec').innerText) };
  });
  check(`${vp}: header names the kind and the garden it lives in`, f.kind === 'Game' && f.home === 'in Tiny games, Leo’s garden', `${f.kind} / ${f.home}`);
  check(`${vp}: titan HUD shows altitude, descent and fuel with units, inside the game`, f.gauges.length === 3 && /Altitude [\d.]+ m/.test(f.gauges[0].t) && /Descent -?[\d.]+ m\/s/.test(f.gauges[1].t) && /Fuel \d+%/.test(f.gauges[2].t) && f.gauges.every(g => g.inside) && f.stageInPanel, JSON.stringify(f.gauges));
  check(`${vp}: Where next heading reads "Where next", never "stream"`, f.head === 'Where next' && !f.stream, f.head);
  check(`${vp}: Where next rows say what they do (Play/View ↗ or Visit →)`, f.rows.length === 3 && f.rows.every((r, i) => specs.titan.next[i].open ? /^(Play|Read|Try|View) ↗$/.test(r) : r === 'Visit →'), JSON.stringify(f.rows));
  await closeEsc(page);
}

async function keyboard(page, vp, specs) {
  const id = 'titan';
  const o = await openViaCard(page, id, specs[id]);
  const inDialog = await page.evaluate(() => !!document.activeElement.closest('#spec .panel'));
  check(`${vp}: focus moves into the dialog on open`, o.ok && inDialog);
  let trapped = true;
  for (let k = 0; k < 12; k++) { await page.keyboard.press('Tab'); if (!(await page.evaluate(() => !!document.activeElement.closest('#spec .panel')))) trapped = false; }
  for (let k = 0; k < 4; k++) { await page.keyboard.press('Shift+Tab'); if (!(await page.evaluate(() => !!document.activeElement.closest('#spec .panel')))) trapped = false; }
  check(`${vp}: Tab stays within the dialog`, trapped);
  await closeEsc(page);
  const back = await page.evaluate(() => ({ open: !document.getElementById('spec').hidden, focus: document.activeElement.dataset.spec || document.activeElement.tagName }));
  check(`${vp}: Esc closes`, !back.open);
  check(`${vp}: focus returns to the opened card`, back.focus === id, back.focus);
  const a = await page.evaluate(() => [...document.querySelectorAll('[data-spec]')].every(c => c.getAttribute('role') === 'button' && c.tabIndex === 0));
  check(`${vp}: cards have role=button and tabindex=0`, a);
  for (const key of ['Enter', ' ']) {
    await page.evaluate(() => document.querySelector('[data-spec="mood"]').focus());
    await page.keyboard.press(key === ' ' ? 'Space' : key); await wait(450);
    const t = await page.evaluate(() => !document.getElementById('spec').hidden && document.getElementById('spec-title').textContent);
    check(`${vp}: ${key === ' ' ? 'Space' : key} on a focused card opens it`, t === specs.mood.title, String(t));
    await closeEsc(page);
  }
}

async function sheet(page, vp, specs) {
  for (const id of ['paper', 'kyoto', 'savings']) {
    await page.evaluate(id => openSpec(id), id); await wait(450);
    const world0 = await page.evaluate(() => document.getElementById('world').style.transform);
    const pb = await page.locator('#spec .panel').boundingBox();
    await page.mouse.move(pb.x + pb.width / 2, pb.y + Math.min(pb.height - 10, 200));
    for (let k = 0; k < 6; k++) { await page.mouse.wheel(0, 600); await wait(60); }
    await page.evaluate(() => { const p = document.querySelector('#spec .panel'); p.scrollTop = p.scrollHeight; });
    await wait(200);
    const r = await page.evaluate(() => {
      const p = document.querySelector('#spec .panel'), c = document.querySelector('#spec .close'), b = c.getBoundingClientRect();
      const hit = document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2);
      const m = document.querySelector('#spec .main').getBoundingClientRect(), n = document.querySelector('#spec .next').getBoundingClientRect();
      return { scrolled: p.scrollTop > 0, scrollable: p.scrollHeight > p.clientHeight + 2, closeIn: b.top >= 0 && b.bottom <= innerHeight && b.right <= innerWidth && b.left >= 0, closeHit: hit === c || c.contains(hit),
        nextUnder: n.top >= m.bottom - 1, world: document.getElementById('world').style.transform, docScroll: document.scrollingElement.scrollTop + document.scrollingElement.scrollLeft + scrollX + scrollY };
    });
    check(`${vp}: ${id} sheet scrolls inside itself`, !r.scrollable || r.scrolled, JSON.stringify(r));
    check(`${vp}: ${id} close button visible after scrolling to the bottom`, r.closeIn && r.closeHit, JSON.stringify(r));
    check(`${vp}: ${id} Where next sits under the specimen`, r.nextUnder);
    check(`${vp}: ${id} page behind does not move`, r.world === world0 && r.docScroll === 0, `${world0} -> ${r.world}, doc ${r.docScroll}`);
    await closeEsc(page);
  }
}

async function motion(browser, vp, specs) {
  const { ctx, page, errors } = await newPage(browser, vp);
  await explore(page);
  await page.evaluate(g => goGarden(g), specs.titan.garden); await wait(900);
  const b = await page.locator('[data-spec="titan"]').boundingBox();
  await page.mouse.click(b.x + b.width / 2, b.y + b.height / 2);
  const f = await page.evaluate(() => { const p = document.querySelector('#spec .panel'); return p.getAnimations().some(a => { const k = a.effect.getKeyframes(); return k.length && /scale|matrix/.test(k[0].transform || ''); }); });
  check(`${vp}: opening grows the view from the card (FLIP)`, f);
  await wait(500);
  await page.keyboard.press('Escape');
  const r = await page.evaluate(() => { const p = document.querySelector('#spec .panel'); return p.getAnimations().some(a => { const k = a.effect.getKeyframes(); return k.length && /scale|matrix/.test(k[k.length - 1].transform || ''); }); });
  check(`${vp}: closing shrinks the view back to the card`, r);
  await wait(500);
  check(`${vp}: closed after the reverse motion`, !(await isOpen(page)));
  check(`${vp}: no errors in the motion pass`, errors.length === 0, errors.join(' | '));
  await ctx.close();

  const rm = await newPage(browser, vp, { reducedMotion: 'reduce' });
  await explore(rm.page);
  await rm.page.evaluate(g => goGarden(g), specs.titan.garden); await wait(900);
  const b2 = await rm.page.locator('[data-spec="titan"]').boundingBox();
  await rm.page.mouse.click(b2.x + b2.width / 2, b2.y + b2.height / 2);
  const s = await rm.page.evaluate(() => { const p = document.querySelector('#spec .panel'); return { open: !document.getElementById('spec').hidden, anims: p.getAnimations().length, tf: getComputedStyle(p).transform }; });
  check(`${vp}: reduced motion opens instantly, no FLIP`, s.open && s.anims === 0 && s.tf === 'none', JSON.stringify(s));
  await rm.page.keyboard.press('Escape');
  check(`${vp}: reduced motion closes instantly`, !(await isOpen(rm.page)));
  check(`${vp}: no errors with reduced motion`, rm.errors.length === 0, rm.errors.join(' | '));
  await rm.ctx.close();
}

async function pulse(browser, vp, long) {
  const { ctx, page, errors } = await newPage(browser, vp);
  await explore(page);
  await wait(3300);
  const p1 = await page.evaluate(() => ({ n: +(document.body.dataset.pulses || 0), id: document.body.dataset.pulsed || '' }));
  const vis = p1.id && await page.evaluate(id => { const b = document.querySelector(`[data-spec="${id}"]`).getBoundingClientRect(); const w = Math.min(b.right, innerWidth) - Math.max(b.left, 0), h = Math.min(b.bottom, innerHeight) - Math.max(b.top, 0); return w > 0 && h > 0 && w * h >= .6 * b.width * b.height; }, p1.id);
  check(`${vp}: a visible specimen pulses once after idle`, p1.n === 1 && vis, JSON.stringify(p1));
  if (long) {
    await wait(3000);
    const p2 = +(await page.evaluate(() => document.body.dataset.pulses || 0));
    check(`${vp}: pulse rests (not again within 8 s)`, p2 === 1, String(p2));
    await page.evaluate(() => openSpec('moon')); await wait(400); await page.keyboard.press('Escape');
    const n0 = +(await page.evaluate(() => document.body.dataset.pulses || 0));
    await wait(9500);
    const n1 = +(await page.evaluate(() => document.body.dataset.pulses || 0));
    check(`${vp}: pulse stops after the first open`, n1 === n0, `${n0} -> ${n1}`);
  }
  check(`${vp}: no errors in the pulse pass`, errors.length === 0, errors.join(' | '));
  await ctx.close();
}


// ---------- the stream and the agent: new finds come to you, and your agents work in your garden ----------
const streamState = page => page.evaluate(() => { const r = document.querySelector('#spec-body .stream'); if (!r) return null;
  const items = [...r.querySelectorAll('.st-item:not(.gone)')], end = r.querySelector('.st-end');
  return { arrived: +r.dataset.arrived, done: r.dataset.done === 'true', paused: r.dataset.paused === 'true', ids: items.map(i => +i.dataset.i),
    items: items.map(i => ({ src: (i.querySelector('.st-src') || {}).textContent?.trim() || '', t: (i.querySelector('.st-t') || {}).textContent?.trim() || '', why: (i.querySelector('.st-why') || {}).textContent?.trim() || '', keep: !!i.querySelector('button.st-keep'), skip: !!i.querySelector('button.st-skip') })),
    count: +((r.querySelector('.mg-count') || {}).textContent || '').replace(/\D/g, '') || NaN, things: [...r.querySelectorAll('.mg-thing')].map(t => (t.querySelector('.mg-t') || {}).textContent?.trim()),
    end: end && end.getClientRects().length && getComputedStyle(end).visibility !== 'hidden' && +getComputedStyle(end).opacity > .5 ? end.textContent.trim() : '' }; });
// nothing in the open view is wider than the panel, and the page itself never scrolls sideways
const overflow = page => page.evaluate(() => { const P = document.querySelector('#spec .panel'), p = P.getBoundingClientRect(), m = document.querySelector('#spec .main');
  const wide = [...P.querySelectorAll('*')].filter(e => { const b = e.getBoundingClientRect(); return b.width && (b.right > p.right + 1 || b.left < p.left - 1); }).map(e => e.className || e.tagName).slice(0, 4);
  return { docOver: document.documentElement.scrollWidth - innerWidth, panelOver: P.scrollWidth - P.clientWidth, mainOver: m.scrollWidth - m.clientWidth, wide }; });
const noOverflow = o => o.docOver <= 0 && o.panelOver <= 1 && o.mainOver <= 1 && o.wide.length === 0;

async function streamCheck(page, vp, long) {
  await page.mouse.move(2, 2); // off the stream, so it does not pause
  await page.evaluate(() => openSpec('stream')); await wait(300);
  const a = await streamState(page); await wait(3300);
  const b = await streamState(page);
  check(`${vp}: stream: items arrive one at a time over time (${a && a.arrived} → ${b && b.arrived})`, !!a && !!b && a.arrived <= 1 && b.arrived > a.arrived && b.arrived - a.arrived <= 2 && b.items.length === b.arrived, JSON.stringify({ a, b }));
  check(`${vp}: stream: newest on top`, !!b && b.ids.length >= 2 && b.ids.every((v, i) => !i || v < b.ids[i - 1]), JSON.stringify(b && b.ids));
  check(`${vp}: stream: each item shows its source, title, why it came, Keep and Skip`, !!b && b.items.length >= 1 && b.items.every(i => /arXiv|blog|video/i.test(i.src) && i.t.length > 8 && /follows|because/i.test(i.why) && i.keep && i.skip), JSON.stringify(b && b.items));
  const o = await overflow(page);
  check(`${vp}: stream view has no horizontal overflow`, noOverflow(o), JSON.stringify(o));
  if (vp !== 'desktop') { const t = await page.evaluate(() => [...document.querySelectorAll('#spec-body .st-item button')].map(e => Math.round(e.getBoundingClientRect().height)));
    check(`${vp}: stream Keep and Skip are ≥44px tall on a phone`, t.length >= 2 && t.every(h => h >= 44), JSON.stringify(t)); }
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/${vp}-stream-mid.png` });
  // Keep: the item flies into the garden, which grows by one with it on top
  const k0 = await streamState(page), top = k0.items[0];
  await page.locator('#spec-body .st-item:not(.gone) .st-keep').first().click();
  const flying = await page.evaluate(() => { const f = document.querySelector('.st-fly'); return !!f && f.getAnimations().some(a => a.playState === 'running'); });
  await wait(1000);
  const k1 = await streamState(page);
  check(`${vp}: stream: Keep puts the item in the garden (count ${k0.count} → ${k1.count}) and takes it out of the stream`, k1.count === k0.count + 1 && k1.things.length === k1.count && k1.things[0] === top.t && !k1.items.some(i => i.t === top.t), JSON.stringify({ top: top.t, k0: k0.count, k1: k1.count, first: k1.things[0] }));
  check(`${vp}: stream: the kept item flies to the garden`, flying);
  // Skip: the item fades out, the garden stays the same
  await page.mouse.move(2, 2); for (let t = 0; t < 40 && !(await streamState(page)).items.length; t++) await wait(100);
  const s0 = await streamState(page), sk = s0.items[0];
  if (sk) await page.locator('#spec-body .st-item:not(.gone) .st-skip').first().click();
  await wait(600);
  const s1 = await streamState(page);
  check(`${vp}: stream: Skip removes the item and leaves the garden as it was`, !!sk && !s1.items.some(i => i.t === sk.t) && s1.count === s0.count && !s1.things.includes(sk.t), JSON.stringify({ sk: sk && sk.t, s0: s0.count, s1: s1.count }));
  // hovering the stream pauses arrivals; leaving it lets them come again
  await page.mouse.move(2, 2); await wait(200);
  const fb = await page.locator('#spec-body .st-feed').boundingBox();
  await page.mouse.move(fb.x + fb.width / 2, fb.y + Math.min(60, fb.height / 2)); await wait(150);
  const h0 = await streamState(page); await wait(3500);
  const h1 = await streamState(page);
  await page.mouse.move(2, 2); await wait(3500);
  const h2 = await streamState(page);
  check(`${vp}: stream: hovering pauses arrivals (${h0.arrived} → ${h1.arrived}) and leaving resumes them (→ ${h2.arrived})`, h0.paused && h1.arrived === h0.arrived && !h2.paused && h2.arrived > h1.arrived, JSON.stringify({ h0: [h0.arrived, h0.paused], h1: h1.arrived, h2: [h2.arrived, h2.paused] }));
  const fz = await page.evaluate(() => { const b = document.querySelector('#spec-body .st-item:not(.gone) button'); if (!b) return null; b.focus(); const p = document.querySelector('#spec-body .stream').dataset.paused; b.blur(); return { on: p, off: document.querySelector('#spec-body .stream').dataset.paused }; });
  check(`${vp}: stream: focus inside the stream pauses it too`, !!fz && fz.on === 'true' && fz.off === 'false', JSON.stringify(fz));
  await closeEsc(page);
  // closing stops the stream: nothing more arrives in the closed view
  const c0 = await streamState(page); await wait(3000); const c1 = await streamState(page);
  check(`${vp}: stream: nothing arrives after the view closes`, !!c0 && c1.arrived === c0.arrived, `${c0 && c0.arrived} / ${c1 && c1.arrived}`);
  if (long) {
    // left alone, the stream brings 8 items, shows at most 5, then says it is done and stops
    await page.evaluate(() => openSpec('stream')); const t0 = Date.now(); let d = null;
    for (let t = 0; t < 300; t++) { d = await streamState(page); if (d.done) break; await wait(100); }
    const secs = (Date.now() - t0) / 1000; await wait(700); d = await streamState(page); // the closing line fades in
    check(`${vp}: stream: stops after 8 items with "That’s this week’s stream." (${secs.toFixed(1)} s)`, d.done && d.arrived === 8 && d.end === 'That’s this week’s stream.' && secs >= 16 && secs <= 28, JSON.stringify({ secs, ...d, items: d.items.length }));
    check(`${vp}: stream: at most 5 items show at once`, d.items.length <= 5 && d.items.length >= 3, String(d.items.length));
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/${vp}-stream-done.png` });
    await wait(3000); const e = await streamState(page);
    check(`${vp}: stream: nothing more arrives once it is done`, e.arrived === 8, String(e.arrived));
    await closeEsc(page);
  }
}

const AG_TOOLS = ['read_stream', 'keep', 'keep', 'keep', 'file', 'create_note'];
const AG_NOTE = '2 orders need splitting before the 11am pickup.';
const agentState = page => page.evaluate(() => { const r = document.querySelector('#spec-body .agent'); if (!r) return null; const tx = e => (e || {}).textContent?.replace(/\s+/g, ' ').trim() || '';
  const things = [...r.querySelectorAll('.mg-thing')];
  return { done: r.dataset.done === 'true', steps: r.querySelectorAll('.ag-step').length, start: +r.dataset.start,
    tools: [...r.querySelectorAll('.ag-tool')].map(t => { const n = t.querySelector('.ag-name'); return { name: tx(n), mono: !!n && /mono/i.test(getComputedStyle(n).fontFamily), args: tx(t.querySelector('.ag-args')), res: tx(t.querySelector('.ag-res')), ok: t.dataset.state === 'done' }; }),
    user: tx(r.querySelector('.ag-user .ag-say')), reply: tx(r.querySelector('.ag-reply .ag-say')), chip: tx(r.querySelector('.ag-chip')), count: +tx(r.querySelector('.mg-count')).replace(/\D/g, '') || NaN,
    things: things.map(t => tx(t.querySelector('.mg-t'))), lit: things.filter(t => t.classList.contains('lit')).map(t => tx(t.querySelector('.mg-t'))), fresh: things.filter(t => t.classList.contains('fresh')).map(t => tx(t.querySelector('.mg-t'))),
    again: !!r.querySelector('button.ag-again') }; });
async function agentRun(page) { // until the run is done; notes whether a garden card glowed while it ran
  const t0 = Date.now(); let s = null, glow = false;
  for (let t = 0; t < 120; t++) { s = await agentState(page); glow = glow || await page.evaluate(() => [...document.querySelectorAll('#spec-body .mg-thing.glow')].some(e => e.getAnimations().some(a => a.playState === 'running')));
    if (s.done) break; await wait(150); }
  return { s, glow, secs: (Date.now() - t0) / 1000 };
}
async function agentCheck(page, vp) {
  await page.mouse.move(2, 2);
  await page.evaluate(() => openSpec('agent')); await wait(400);
  const a = await agentState(page);
  check(`${vp}: agent: the run starts small when the view opens (${a && a.steps} step${a && a.steps === 1 ? '' : 's'}) and says it is connected to Grdn over MCP`, !!a && !a.done && a.steps <= 2 && a.count === a.start && /connected to Grdn over MCP/i.test(a.chip), JSON.stringify(a));
  if (SHOTS) { await wait(3600); await page.screenshot({ path: `${SHOTS}/${vp}-agent-mid.png` }); }
  const r = await agentRun(page), s = r.s;
  check(`${vp}: agent: the morning run takes 7–12 s (${(r.secs + 0.4 + (SHOTS ? 3.6 : 0)).toFixed(1)} s)`, s.done && r.secs + 0.4 + (SHOTS ? 3.6 : 0) >= 7 && r.secs + 0.4 + (SHOTS ? 3.6 : 0) <= 12, String(r.secs));
  check(`${vp}: agent: the transcript shows Grdn's MCP tools in order, in monospace (${s.tools.map(t => t.name).join(', ')})`, s.tools.map(t => t.name).join() === AG_TOOLS.join() && s.tools.every(t => t.mono && t.ok), JSON.stringify(s.tools));
  const args = s.tools.map(t => t.args);
  check(`${vp}: agent: each tool call shows its arguments`, /Orders sheet/.test(args[0]) && /48213/.test(args[1]) && /48214/.test(args[2]) && /48215/.test(args[3]) && /#48213/.test(args[4]) && /Small shop, less admin/.test(args[4]) && /Small shop, less admin/.test(args[5]), JSON.stringify(args));
  check(`${vp}: agent: Arjun asks, and the agent answers when done`, s.user === 'Check the new orders and tell me what needs splitting.' && s.reply === 'Done. 2 need splitting; I left you a note.', `${s.user} / ${s.reply}`);
  check(`${vp}: agent: the garden gains the 3 orders and the note (${s.start} → ${s.count})`, s.count === s.start + 4 && s.things.length === s.count && ['#48213', '#48214', '#48215'].every(n => s.things.some(t => t.includes(n))) && s.things.includes(AG_NOTE), JSON.stringify(s.things));
  check(`${vp}: agent: the new note is highlighted in the garden`, s.fresh.includes(AG_NOTE), JSON.stringify(s.fresh));
  check(`${vp}: agent: a garden card glows as the tool call that changed it completes`, r.glow);
  const o = await overflow(page);
  check(`${vp}: agent view has no horizontal overflow`, noOverflow(o), JSON.stringify(o));
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/${vp}-agent-done.png` });
  // tapping a tool line opens it and highlights what it changed
  const line = i => page.locator('#spec-body .ag-tool .ag-line').nth(i);
  await line(5).click(); await wait(150);
  const t1 = await page.evaluate(() => { const t = document.querySelectorAll('#spec-body .ag-tool')[5], d = t.querySelector('.ag-detail'); return { exp: t.querySelector('.ag-line').getAttribute('aria-expanded'), detail: !!d && d.getClientRects().length > 0 && d.textContent.length > 10 }; });
  const l1 = (await agentState(page)).lit;
  check(`${vp}: agent: tapping the create_note line opens it and highlights the note`, t1.exp === 'true' && t1.detail && l1.length === 1 && l1[0] === AG_NOTE, JSON.stringify({ t1, l1 }));
  await line(2).click(); await wait(150);
  const l2 = (await agentState(page)).lit;
  check(`${vp}: agent: tapping a keep line highlights the order it kept`, l2.length === 1 && l2[0].includes('#48214'), JSON.stringify(l2));
  if (vp !== 'desktop') { const h = await page.evaluate(() => [...document.querySelectorAll('#spec-body .ag-again, #spec-body .ag-line')].map(e => Math.round(e.getBoundingClientRect().height)));
    check(`${vp}: agent: Run again and the tool lines are ≥44px tall on a phone`, h.length >= 7 && h.every(x => x >= 44), JSON.stringify(h)); }
  // Run again plays the morning again from the start
  await page.mouse.move(2, 2); await page.locator('#spec-body .ag-again').click(); await wait(300);
  const b = await agentState(page);
  const r2 = await agentRun(page);
  check(`${vp}: agent: Run again starts over (${b.steps} steps, ${b.count} things) and plays the same run`, !b.done && b.steps <= 2 && b.count === b.start && r2.s.done && r2.s.tools.map(t => t.name).join() === AG_TOOLS.join() && r2.s.count === r2.s.start + 4 && r2.secs >= 6, JSON.stringify({ b, secs: r2.secs, count: r2.s.count }));
  // closing mid-run stops it
  await page.locator('#spec-body .ag-again').click(); await wait(1500); await closeEsc(page);
  const c0 = await agentState(page); await wait(3000); const c1 = await agentState(page);
  check(`${vp}: agent: the run stops when the view closes mid-run`, !!c0 && !c0.done && c1.steps === c0.steps && c1.count === c0.count, JSON.stringify({ c0: c0 && c0.steps, c1: c1 && c1.steps }));
}

// ---------- polish checks: measured, not presence-only ----------
// In-page helpers: colour parsing, WCAG contrast, and decoding a screenshot into pixels.
const HELP = () => { window.__c = {
  rgb: s => { const m = String(s).match(/rgba?\(([^)]+)\)/); if (!m) return null; const p = m[1].split(/[\s,\/]+/).filter(Boolean).map(Number); return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 }; },
  lum: c => { const f = v => { v /= 255; return v <= .03928 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4); }; return .2126 * f(c.r) + .7152 * f(c.g) + .0722 * f(c.b); },
  over: (fg, bg) => ({ r: fg.r * fg.a + bg.r * (1 - fg.a), g: fg.g * fg.a + bg.g * (1 - fg.a), b: fg.b * fg.a + bg.b * (1 - fg.a), a: 1 }),
  ratio: (a, b) => { const x = __c.lum(a), y = __c.lum(b); return (Math.max(x, y) + .05) / (Math.min(x, y) + .05); },
  // the text colour as painted: its alpha times every ancestor's opacity
  ink: el => { const c = __c.rgb(getComputedStyle(el).color); let a = c.a; for (let e = el; e; e = e.parentElement) a *= +getComputedStyle(e).opacity; return { ...c, a }; },
  px: async b64 => { const i = await createImageBitmap(await (await fetch('data:image/png;base64,' + b64)).blob()), c = new OffscreenCanvas(i.width, i.height), x = c.getContext('2d'); x.drawImage(i, 0, 0); return { w: i.width, h: i.height, d: [...x.getImageData(0, 0, i.width, i.height).data] }; },
}; };
const box = (page, sel) => page.evaluate(sel => { const e = typeof sel === 'string' ? document.querySelector(sel) : sel; if (!e) return null; const r = e.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height, l: r.left, t: r.top, r: r.right, b: r.bottom }; }, sel);
const shot64 = async (page, b) => (await page.screenshot({ scale: 'css', clip: { x: Math.max(0, b.x), y: Math.max(0, b.y), width: Math.max(1, b.w), height: Math.max(1, b.h) } })).toString('base64');
// Worst-case contrast of the text in `sel` against the pixels behind it: hide the text, shoot its box, compare with the darkest and lightest backdrop pixel.
async function textContrast(page, sel) {
  const items = await page.evaluate(sel => [...document.querySelectorAll(sel)].filter(e => e.getClientRects().length && e.textContent.trim()).map((e, i) => { e.dataset.tc = i; const r = e.getBoundingClientRect(); return { i, x: r.left, y: r.top, w: r.width, h: r.height, ink: __c.ink(e), t: e.textContent.trim().slice(0, 24) }; }), sel);
  const out = [];
  for (const it of items) {
    await page.evaluate(i => { const e = document.querySelector(`[data-tc="${i}"]`); e.dataset.tcColor = e.style.color; e.style.setProperty('color', 'transparent', 'important'); e.querySelectorAll('*').forEach(k => k.style.setProperty('color', 'transparent', 'important')); }, it.i);
    const b64 = await shot64(page, it);
    await page.evaluate(i => { const e = document.querySelector(`[data-tc="${i}"]`); e.style.color = e.dataset.tcColor; e.querySelectorAll('*').forEach(k => k.style.removeProperty('color')); delete e.dataset.tc; }, it.i);
    const worst = await page.evaluate(async ([b64, ink]) => { const { d } = await __c.px(b64); let lo = 1e9, hi = -1; const P = [];
      for (let k = 0; k < d.length; k += 4) { const c = { r: d[k], g: d[k + 1], b: d[k + 2], a: 1 }; P.push(c); }
      // ignore the most extreme 3% of backdrop pixels (anti-aliasing at edges)
      P.sort((a, b) => __c.lum(a) - __c.lum(b)); const a = P[Math.floor(P.length * .03)], z = P[Math.floor(P.length * .97)];
      return Math.min(__c.ratio(__c.over(ink, a), a), __c.ratio(__c.over(ink, z), z)); }, [b64, it.ink]);
    out.push({ t: it.t, ratio: +worst.toFixed(2) });
  }
  return out;
}

async function focusRing(page, vp, specs) {
  for (const id of ['mood', 'titan']) {
    const o = await openViaCard(page, id, specs[id]);
    const f = await page.evaluate(() => { const a = document.activeElement, c = document.querySelector('#spec .close'), cs = getComputedStyle(c);
      return { onClose: a === c, inPanel: !!a.closest('#spec .panel'), named: !!(a.getAttribute('aria-labelledby') || a.getAttribute('aria-label') || a.closest('[aria-labelledby]')),
        // a painted ring: an outline on whatever has focus, or the game stage's focus ring
        fv: [...document.querySelectorAll('#spec .panel, #spec .panel *')].filter(e => { const cs = getComputedStyle(e); return e.matches(':focus-visible') && cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) > 0 || e.matches('.stage') && /rgb\(15, 143, 128\)/.test(cs.boxShadow); }).map(e => e.className || e.tagName), closeOutline: cs.outlineStyle + ' ' + cs.outlineWidth }; });
    check(`${vp}: pointer open of ${id}: focus in the dialog, no focus ring anywhere, close button not focused`, o.ok && f.inPanel && f.named && !f.onClose && f.fv.length === 0 && /none|^\S+ 0px/.test(f.closeOutline), JSON.stringify({ open: o, ...f }));
    await closeEsc(page);
  }
  await page.evaluate(() => document.querySelector('[data-spec="mood"]').focus()); await page.keyboard.press('Enter'); await wait(450);
  const k = await page.evaluate(() => { const a = document.activeElement, cs = getComputedStyle(a); return { fv: a.matches(':focus-visible'), inPanel: !!a.closest('#spec .panel'), ring: cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) >= 2, el: a.className || a.tagName }; });
  check(`${vp}: keyboard open shows a visible focus ring inside the dialog`, k.fv && k.inPanel && k.ring, JSON.stringify(k));
  await closeEsc(page);
}

// The made line is the signature moment: every source shows an icon and what it became, and the lead sentence is ink, heavier than body text, on its own tint.
async function madeLine(page, vp, specs) {
  for (const id of Object.keys(specs)) {
    await page.evaluate(id => openSpec(id), id); await wait(350);
    const m = await page.evaluate(id => { const made = document.getElementById('spec-made'), lead = made.querySelector(':scope > span:first-child'), lcs = getComputedStyle(lead), mbg = __c.rgb(getComputedStyle(made).backgroundColor), pbg = __c.rgb(getComputedStyle(document.querySelector('#spec .main')).backgroundColor) || { r: 255, g: 255, b: 255, a: 1 };
      const panelBg = pbg.a ? pbg : __c.rgb(getComputedStyle(document.querySelector('#spec .panel')).backgroundColor);
      const chips = [...made.querySelectorAll('.chip')].map((c, i) => { const ic = c.querySelector('.src-ic'), r = ic && ic.getBoundingClientRect(), bc = c.querySelector('.became'), br = bc && bc.getBoundingClientRect();
        return { i, became: bc ? bc.textContent.trim() : null, want: (SPECS[id].from[i] || {}).became, icon: !!r && r.width >= 24 && r.height >= 24, shown: !!br && br.width > 20 && br.height > 8 }; });
      return { chips, weight: +lcs.fontWeight, size: parseFloat(lcs.fontSize), ratio: +__c.ratio(__c.over(__c.ink(lead), mbg), mbg).toFixed(2), bgDiff: Math.abs(mbg.r - panelBg.r) + Math.abs(mbg.g - panelBg.g) + Math.abs(mbg.b - panelBg.b) }; }, id);
    const bad = m.chips.filter(c => !c.want || c.became !== c.want || !c.icon || !c.shown);
    check(`${vp}: ${id} every source shows an icon and what it became (${m.chips.length})`, m.chips.length === specs[id].from.length && bad.length === 0, JSON.stringify(bad));
    check(`${vp}: ${id} made lead is ink, weight ≥600, ≥15px, contrast ≥7 on a tint unlike the page`, m.weight >= 600 && m.size >= 15 && m.ratio >= 7 && m.bgDiff >= 12, JSON.stringify({ ...m, chips: undefined }));
    await closeEsc(page);
  }
}

// Where next fits its rows (no big empty panel on desktop), and each row says why in one line.
// Owner rule: a row may lead back to the specimen's own garden (a visit to its source), but no row's visible text names the garden you are in.
async function whereNextPanel(page, vp, specs) {
  for (const [id, sp] of Object.entries(specs)) {
    await page.evaluate(id => openSpec(id), id); await wait(350);
    const w = await page.evaluate(id => { const S = SPECS[id], aside = document.querySelector('#spec .next').getBoundingClientRect(), rows = [...document.querySelectorAll('#spec-next .nx')];
      const last = rows[rows.length - 1].getBoundingClientRect();
      return { empty: Math.round(aside.bottom - last.bottom), asideH: Math.round(aside.height), rows: rows.map((r, i) => { const y = r.querySelector('.why'), yr = y && y.getBoundingClientRect(), th = r.querySelector('.nx-th'), tr = th && th.getBoundingClientRect();
        return { i, text: r.innerText.replace(/\s+/g, ' '), title: (r.querySelector('b') || {}).textContent, why: y ? y.textContent.trim() : null, want: S.next[i].why, shown: !!yr && yr.height > 8 && yr.width > 40, thumb: !!tr && tr.width >= 32 && tr.height >= 32 }; }) }; }, id);
    const noWhy = w.rows.filter(r => !r.want || r.why !== r.want || !r.shown);
    check(`${vp}: ${id} every Where next row has a one-line why`, noWhy.length === 0, JSON.stringify(noWhy));
    const home = sp.next.filter(n => n.garden === sp.garden).length, named = w.rows.filter(r => r.text.toLowerCase().includes(sp.garden.toLowerCase()));
    const matches = w.rows.length === sp.next.length && w.rows.every((r, i) => r.title === sp.next[i].t);
    check(`${vp}: ${id} no Where next row's visible text names the garden you are in ("${sp.garden}"; ${home} row${home === 1 ? '' : 's'} may lead back to it)`, matches && named.length === 0, JSON.stringify({ matches, named: named.map(r => r.text) }));
    check(`${vp}: ${id} every Where next row has a thumbnail`, w.rows.every(r => r.thumb), JSON.stringify(w.rows.map(r => r.thumb)));
    if (vp === 'desktop') check(`${vp}: ${id} Where next panel fits its rows (empty space under the last row ≤ 40px)`, w.empty <= 40, JSON.stringify({ empty: w.empty, asideH: w.asideH }));
    await closeEsc(page);
  }
}

// Fly the lander in the page with a simple controller (hold when too fast), so a soft landing is a real landing.
const flySoft = page => page.evaluate(() => new Promise(done => { const cv = document.querySelector('#spec-body canvas'), root = document.querySelector('#spec-body .lander'); let held = false;
  const press = on => { if (on === held) return; held = on; on ? cv.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true })) : dispatchEvent(new PointerEvent('pointerup')); };
  (function tick() { if (root.dataset.state !== 'play') { press(false); return done(root.dataset.state); }
    const v = +root.querySelector('[data-v]').textContent, a = +root.querySelector('[data-a]').textContent, target = a > 25 ? 9 : a > 9 ? 5 : 2.1;
    if (v > target) press(true); else if (v < target - .5) press(false); requestAnimationFrame(tick); })(); }));
const waitState = async (page, re, ms = 20000) => { let st = ''; for (let t = 0; t < ms; t += 100) { st = await page.evaluate(() => document.querySelector('#spec-body .lander').dataset.state); if (re.test(st)) break; await wait(100); } return st; };
// Where the lander and the pad are drawn, from the game's own geometry (ground at 80% of the height, scale H/270 clamped to 1..1.6).
const craftAndPad = page => page.evaluate(() => { const cv = document.querySelector('#spec-body canvas'), c = cv.getBoundingClientRect(), W = cv.clientWidth, H = cv.clientHeight, gy = H * .8, s = Math.max(1, Math.min(1.6, H / 270)), m = document.querySelector('#spec-body .msg').getBoundingClientRect();
  return { craft: { l: c.left + W / 2 - 20 * s, r: c.left + W / 2 + 50 * s, t: c.top + gy - 42 * s, b: c.top + gy + 4 * s }, pad: { l: c.left + W / 2 - 64 * s, r: c.left + W / 2 + 64 * s, t: c.top + gy - 16 * s, b: c.top + gy + 3 * s }, msg: { l: m.left, r: m.right, t: m.top, b: m.bottom } }; });
// overlap, or closer than 12px: the card must leave clear air around the lander and the pad
const meets = (a, b, m = 12) => !(a.r + m <= b.l || a.l >= b.r + m || a.b + m <= b.t || a.t >= b.b + m);

async function titanPolish(page, vp) {
  await page.evaluate(() => openSpec('titan')); await wait(350); // after the open fade, still well under 3 m/s
  const tile = () => page.evaluate(() => { const g = document.querySelector('#spec-body .gauge.speed'), bg = __c.rgb(getComputedStyle(g).backgroundColor), mark = g.querySelector('.meter s'); return { v: +g.querySelector('[data-v]').textContent, bg, mark: mark ? (mark.textContent || getComputedStyle(mark, '::after').content).replace(/"/g, '') : '' }; });
  const safe = await tile(); const safeC = await textContrast(page, '#spec-body .gauge.speed .val b');
  await wait(1700);
  const fast = await tile(); const fastC = await textContrast(page, '#spec-body .gauge.speed .val b');
  const hud = await textContrast(page, '#spec-body .hud .lbl, #spec-body .hud .val b, #spec-body .hud .val i');
  check(`${vp}: titan HUD text has ≥4.5:1 contrast against its tile (pixels)`, hud.length >= 6 && hud.every(h => h.ratio >= 4.5), JSON.stringify(hud));
  check(`${vp}: descent tile is green while under 3 m/s and red once too fast, text readable in both`, safe.v < 3 && fast.v >= 3 && safe.bg.g > safe.bg.r + 20 && safe.bg.a >= .5 && fast.bg.r > fast.bg.g + 50 && fast.bg.a >= .5 && safeC[0].ratio >= 4.5 && fastC[0].ratio >= 4.5 && /3/.test(safe.mark), JSON.stringify({ safe, fast, safeC, fastC }));
  await closeEsc(page);

  // a real soft landing, then the result card must leave the lander and the pad in view
  await page.evaluate(() => openSpec('titan')); await wait(200);
  const landed = await flySoft(page); await wait(450);
  const g1 = await craftAndPad(page);
  check(`${vp}: titan soft landing with the controller lands`, landed === 'landed', landed);
  check(`${vp}: landed result card covers neither the lander nor the pad`, !meets(g1.msg, g1.craft) && !meets(g1.msg, g1.pad), JSON.stringify(g1));
  const best1 = await page.evaluate(() => { const b = document.querySelector('#spec-body [data-best]'), sub = document.querySelector('#spec-body [data-sub]').textContent; return { best: b && b.getClientRects().length ? b.textContent.trim() : '', speed: (sub.match(/([\d.]+)\s*m\/s/) || [])[1] }; });
  check(`${vp}: a best landing line shows this landing`, /^Best this visit: [\d.]+\s?m\/s/.test(best1.best) && best1.best.includes(best1.speed), JSON.stringify(best1));
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/${vp}-titan-landed.png` });
  await page.keyboard.press('r'); await wait(150);
  const r1 = await page.evaluate(() => ({ state: document.querySelector('#spec-body .lander').dataset.state, fuel: document.querySelector('#spec-body [data-f]').textContent }));
  check(`${vp}: R flies again with a full tank`, r1.state === 'play' && r1.fuel === '100', JSON.stringify(r1));
  if (SHOTS) { await wait(600); await page.screenshot({ path: `${SHOTS}/${vp}-titan-play.png` }); }
  const crashed = await waitState(page, /crashed|landed/); await wait(450);
  const g2 = await craftAndPad(page);
  check(`${vp}: crashed result card covers neither the lander nor the pad`, crashed === 'crashed' && !meets(g2.msg, g2.craft) && !meets(g2.msg, g2.pad), JSON.stringify({ crashed, ...g2 }));
  const best2 = await page.evaluate(() => document.querySelector('#spec-body [data-best]')?.textContent.trim() || '');
  const plain = t => t.replace(/ · new best$/, '');
  check(`${vp}: the best landing is remembered across flights`, best2 !== '' && plain(best2) === plain(best1.best), `${best1.best} / ${best2}`);
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/${vp}-titan-crash.png` });
  await page.keyboard.press('Enter'); await wait(150);
  const r2 = await page.evaluate(() => document.querySelector('#spec-body .lander').dataset.state);
  check(`${vp}: Enter flies again`, r2 === 'play', r2);
  await closeEsc(page);
}

// On a phone the game must not push Where next far down the sheet.
async function sheetReach(page, vp) {
  await page.evaluate(() => openSpec('titan')); await wait(400);
  const r = await page.evaluate(() => { const p = document.querySelector('#spec .panel'); p.scrollTop = 0; return { top: Math.round(document.querySelector('#spec .nx-head').getBoundingClientRect().top - p.getBoundingClientRect().top), vh: innerHeight }; });
  check(`${vp}: titan sheet: Where next starts within 1.5 screen heights (${r.top}px of ${1.5 * r.vh})`, r.top <= 1.5 * r.vh, JSON.stringify(r));
  await closeEsc(page);
}

// Running animations inside the open view's body, right after an action.
const bodyAnims = (page, sel) => page.evaluate(sel => [...document.querySelectorAll(sel)].reduce((n, e) => n + e.getAnimations().filter(a => a.playState === 'running').length, 0), sel);

async function recipePolish(page, vp) {
  await page.evaluate(() => openSpec('recipe')); await wait(400);
  const r = await page.evaluate(() => { const rec = document.querySelector('#spec-body .recipe'), rr = rec.getBoundingClientRect(), hero = rec.querySelector('.hero'), hr = hero && hero.getBoundingClientRect(), art = hero && hero.querySelector('svg, img'), ar = art && art.getBoundingClientRect();
    const nums = [...rec.querySelectorAll('.steps .n')].map(n => ({ t: n.textContent.trim(), fs: parseFloat(getComputedStyle(n).fontSize) }));
    const sv = rec.querySelector('[data-serves]'), btns = [...rec.querySelectorAll('[data-step]')].map(b => { const q = b.getBoundingClientRect(); return [Math.round(q.width), Math.round(q.height)]; });
    return { hero: !!hr && hr.height >= 120 && Math.abs(hr.top - rr.top) < 4 && !!ar && ar.width * ar.height >= .5 * hr.width * hr.height, nums, servesFs: parseFloat(getComputedStyle(sv).fontSize), btns }; });
  check(`${vp}: recipe opens on an illustrated header at least 120px tall`, r.hero, JSON.stringify(r));
  check(`${vp}: recipe steps have big numbers (1, 2, 3 at ≥28px)`, r.nums.length === 3 && r.nums.every((n, i) => n.t === String(i + 1) && n.fs >= 28), JSON.stringify(r.nums));
  check(`${vp}: recipe servings control is prominent (count ≥28px, buttons ≥44px)`, r.servesFs >= 28 && r.btns.length === 2 && r.btns.every(([w, h]) => w >= 44 && h >= 44), JSON.stringify(r));
  await page.locator('#spec-body button[data-step="1"]').click();
  const n = await bodyAnims(page, '#spec-body .amt');
  check(`${vp}: recipe quantities animate when the servings change`, n >= 3, String(n));
  await closeEsc(page);
}

// With reduced motion, the same actions change content with no animation.
async function reducedPolish(browser, vp) {
  const { ctx, page, errors } = await newPage(browser, vp, { reducedMotion: 'reduce' });
  await explore(page); await page.evaluate(HELP);
  await page.evaluate(() => openSpec('recipe')); await wait(300);
  const q0 = await page.evaluate(() => document.querySelector('#spec-body .amt').dataset.q);
  await page.locator('#spec-body button[data-step="1"]').click();
  const q1 = await page.evaluate(() => document.querySelector('#spec-body .amt').dataset.q), n = await bodyAnims(page, '#spec-body *');
  check(`${vp}: reduced motion: recipe amounts change with no animation`, q1 !== q0 && n === 0, JSON.stringify({ q0, q1, n }));
  await closeEsc(page);
  await reducedMore(page, vp);
  check(`${vp}: no errors in the reduced-motion polish pass`, errors.length === 0, errors.join(' | '));
  await ctx.close();
}
async function reducedMore(page, vp) {
  await page.evaluate(() => openSpec('kyoto')); await wait(300);
  await page.locator('#spec-body .toggle button[data-k="rain"]').click();
  const k = await page.evaluate(() => ({ swapped: document.querySelectorAll('#spec-body .stop.swapped').length, n: [...document.querySelectorAll('#spec-body *')].reduce((n, e) => n + e.getAnimations().filter(a => a.playState === 'running').length, 0) }));
  check(`${vp}: reduced motion: kyoto swaps to rain with no animation`, k.swapped >= 2 && k.n === 0, JSON.stringify(k));
  await closeEsc(page);
  await reducedMore2(page, vp);
}
async function reducedMore2(page, vp) {
  await page.evaluate(() => openSpec('savings')); await wait(300);
  const t0 = await page.evaluate(() => document.querySelector('#spec-body [data-total]').textContent);
  await page.locator('#spec-body input[data-years]').focus(); await page.keyboard.press('ArrowRight');
  const k = await page.evaluate(() => ({ t: document.querySelector('#spec-body [data-total]').textContent, n: [...document.querySelectorAll('#spec-body *')].reduce((n, e) => n + e.getAnimations().filter(a => a.playState === 'running').length, 0) }));
  check(`${vp}: reduced motion: the jar total changes with no animation`, k.t !== t0 && k.n === 0, JSON.stringify({ t0, ...k }));
  await closeEsc(page);
  await reducedMore3(page, vp);
}
async function reducedMore3(page, vp) {
  // the stream: items still arrive, but with no slide; Keep moves the item at once, with no flight
  await page.mouse.move(2, 2);
  await page.evaluate(() => openSpec('stream')); await wait(3300);
  const a = await streamState(page);
  let k = null;
  if (a && a.items.length) {
    await page.locator('#spec-body .st-item:not(.gone) .st-keep').first().click(); await wait(60);
    k = await page.evaluate(() => ({ fly: !!document.querySelector('.st-fly'), n: [...document.querySelectorAll('#spec-body *')].reduce((n, e) => n + e.getAnimations().filter(a => a.playState === 'running').length, 0) }));
  }
  const b = await streamState(page);
  check(`${vp}: reduced motion: stream items arrive, and Keep moves one into the garden at once with no flight or animation`, !!a && a.arrived >= 1 && !!k && !k.fly && k.n === 0 && b.count === a.count + 1 && b.things[0] === a.items[0].t, JSON.stringify({ a: a && { arrived: a.arrived, count: a.count }, k, b: b && { count: b.count, first: b.things[0] } }));
  await closeEsc(page);
  await reducedAgent(page, vp);
}
async function reducedAgent(page, vp) {
  // the agent: the finished run shows at once, every step listed, nothing animating
  await page.evaluate(() => openSpec('agent')); await wait(250);
  const g = await agentState(page), n = await bodyAnims(page, '#spec-body *');
  check(`${vp}: reduced motion: the agent run shows finished at once (all steps, the note in the garden, no animation)`, !!g && g.done && g.steps === 8 && g.tools.map(t => t.name).join() === AG_TOOLS.join() && g.count === g.start + 4 && n === 0, JSON.stringify({ g, n }));
  if (g && g.again) { await page.locator('#spec-body .ag-again').click(); await wait(100); }
  const g2 = await agentState(page);
  check(`${vp}: reduced motion: Run again shows the finished run again at once`, !!g2 && g2.done && g2.steps === 8 && g2.count === g2.start + 4 && (await bodyAnims(page, '#spec-body *')) === 0, JSON.stringify(g2));
  await closeEsc(page);
}

async function kyotoPolish(page, vp) {
  await page.evaluate(() => openSpec('kyoto')); await wait(400);
  const read = () => page.evaluate(() => { const plan = document.querySelector('#spec-body .plan'), ol = plan.querySelector('ol'), sp = getComputedStyle(ol, '::before'), olr = ol.getBoundingClientRect();
    const wx = plan.querySelector('.wx'), th = plan.querySelector('.toggle .thumb');
    return { spine: { w: parseFloat(sp.width), h: parseFloat(sp.height), olH: olr.height, bg: sp.backgroundColor }, stops: [...ol.querySelectorAll('li')].map(li => { const d = li.querySelector('.dot'), r = d && d.getBoundingClientRect(); return { time: (li.querySelector('.time') || {}).textContent, dot: !!r && r.width >= 24 && r.height >= 24 && d.textContent.trim().length > 0 }; }),
      wx: wx ? wx.textContent.replace(/\s+/g, ' ').trim() : '', thumb: th ? th.getBoundingClientRect().left : null, names: [...ol.querySelectorAll('.stop b')].map(b => b.textContent) }; });
  const a = await read();
  check(`${vp}: kyoto timeline has a spine down the stops (≥2px wide, ≥70% of the list)`, a.spine.w >= 2 && a.spine.h >= .7 * a.spine.olH, JSON.stringify(a.spine));
  check(`${vp}: kyoto every stop has a time and an icon marker on the spine`, a.stops.length >= 5 && a.stops.every(x => /^\d{1,2}:\d{2}$/.test((x.time || '').trim()) && x.dot), JSON.stringify(a.stops));
  await page.locator('#spec-body .toggle button[data-k="rain"]').click(); await wait(40);
  const n = await bodyAnims(page, '#spec-body .stop.swapped');
  // the swap is a short fade and slide: no 3D flip, at most 8px of travel, at most 250 ms each
  const kf = await page.evaluate(() => [...document.querySelectorAll('#spec-body li *')].flatMap(e => e.getAnimations()).map(a => { const t = a.effect.getTiming(), frames = a.effect.getKeyframes().map(k => k.transform || 'none');
    const travel = Math.max(0, ...frames.map(f => { const m = f.match(/translate[XY]?\(([^)]+)\)/); return m ? Math.max(...m[1].split(',').map(v => Math.abs(parseFloat(v)) || 0)) : 0; }));
    return { d: t.duration, flip: frames.some(f => /rotate|perspective|matrix3d/.test(f)), travel, scale: frames.some(f => /scale/.test(f)) }; }));
  check(`${vp}: kyoto swap is a short fade/slide (no flip, ≤8px, ≤250 ms; ${kf.length} animations)`, kf.length >= 2 && kf.every(k => !k.flip && !k.scale && k.travel <= 8 && k.d <= 250), JSON.stringify(kf));
  await wait(600); const b = await read();
  check(`${vp}: kyoto weather header shows the day's weather and changes with the toggle`, /\d+°/.test(a.wx) && /\d+°|%/.test(b.wx) && a.wx !== b.wx, `${a.wx} / ${b.wx}`);
  check(`${vp}: kyoto Rain swap animates the swapped stops and slides the toggle`, n >= 2 && a.thumb !== null && Math.abs(b.thumb - a.thumb) > 20 && b.names.join() !== a.names.join(), JSON.stringify({ n, t0: a.thumb, t1: b.thumb }));
  await closeEsc(page);
}

async function moodPolish(page, vp) {
  await page.evaluate(() => openSpec('mood')); await wait(400);
  await page.evaluate(() => Promise.all([...document.querySelectorAll('#spec-body img')].map(i => i.complete ? 1 : new Promise(r => { i.onload = i.onerror = r; }))));
  const m = await page.evaluate(() => { const figs = [...document.querySelectorAll('#spec-body .mood figure')].map(f => { const r = f.getBoundingClientRect(), c = f.querySelector('figcaption'); return { w: Math.round(r.width), h: Math.round(r.height), cap: c ? c.textContent.trim() : '', img: !!f.querySelector('img'), src: f.dataset.src || '' }; });
    const hex = c => '#' + [c.r, c.g, c.b].map(v => v.toString(16).padStart(2, '0')).join('').toUpperCase();
    const sws = [...document.querySelectorAll('#spec-body .mood .sw')].map(b => ({ label: b.textContent.replace(/\s+/g, ' ').trim(), hex: hex(__c.rgb(getComputedStyle(b.querySelector('.chipc')).backgroundColor)), src: b.dataset.src, tag: b.tagName }));
    return { figs, sws }; });
  const f0 = m.figs[0] || {};
  check(`${vp}: moodboard is an even grid (≥4 tiles, same size) with a caption on every tile`, m.figs.length >= 4 && m.figs.every(f => Math.abs(f.w - f0.w) <= 1 && Math.abs(f.h - f0.h) <= 1 && f.cap.length > 3), JSON.stringify(m.figs));
  check(`${vp}: moodboard swatches are buttons labelled with their hex and the image they came from`, m.sws.length >= 5 && m.sws.every(x => x.tag === 'BUTTON' && x.label.includes(x.hex) && m.figs.some(f => f.img && f.src === x.src && x.label.includes('from'))), JSON.stringify(m.sws));
  // each swatch colour is really in its source image: some pixel within 24 (RGB distance) of it
  const far = [];
  await page.evaluate(() => document.querySelectorAll('#spec-body .mood figcaption').forEach(c => c.style.visibility = 'hidden')); // sample the picture, not its caption
  for (const x of m.sws) {
    const b = await box(page, `#spec-body .mood figure[data-src="${x.src}"] img`); if (!b) { far.push(x.hex + ' no image'); continue; }
    const d = await page.evaluate(async ([b64, hex]) => { const { d } = await __c.px(b64), t = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16)); let best = 1e9;
      for (let k = 0; k < d.length; k += 4) best = Math.min(best, Math.hypot(d[k] - t[0], d[k + 1] - t[1], d[k + 2] - t[2])); return Math.round(best); }, [await shot64(page, b), x.hex]);
    if (d > 24) far.push(`${x.hex} ${d}`);
  }
  await page.evaluate(() => document.querySelectorAll('#spec-body .mood figcaption').forEach(c => c.style.visibility = ''));
  check(`${vp}: every swatch colour appears in the image it is labelled from (pixels)`, m.sws.length >= 5 && far.length === 0, far.join(', '));
  const k = m.sws.findIndex(x => x.src !== m.sws[0].src) > 0 ? m.sws.length - 1 : 0;
  await page.locator('#spec-body .mood .sw').nth(k).click(); await wait(450);
  const h = await page.evaluate(k => { const b = document.querySelectorAll('#spec-body .mood .sw')[k], src = b.dataset.src; return { pressed: b.getAttribute('aria-pressed'),
    figs: [...document.querySelectorAll('#spec-body .mood figure')].map(f => ({ src: f.dataset.src, op: +getComputedStyle(f).opacity })), live: (document.querySelector('#spec-body .mood [aria-live]') || {}).textContent || '', src, hex: b.textContent }; }, k);
  check(`${vp}: tapping a swatch highlights its image, dims the rest and says it copied the hex`, h.pressed === 'true' && h.figs.filter(f => f.src === h.src).every(f => f.op > .95) && h.figs.filter(f => f.src !== h.src).every(f => f.op < .6) && /#[0-9A-F]{6}/.test(h.live) && h.hex.includes(h.live.match(/#[0-9A-F]{6}/)[0]), JSON.stringify(h));
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/${vp}-mood-swatch.png` });
  await closeEsc(page);
}

async function savingsPolish(page, vp) {
  await page.evaluate(() => openSpec('savings')); await wait(400);
  const read = () => page.evaluate(() => { const j = document.querySelector('#spec-body .jar'), plot = j.querySelector('.plot') || j.querySelector('svg'), pr = plot.getBoundingClientRect(), t = s => (j.querySelector(s) || {}).textContent || '';
    const lab = s => { const e = j.querySelector(s); if (!e) return null; const r = e.getBoundingClientRect(); return { t: e.textContent.replace(/\s+/g, ' ').trim(), r: r.right, l: r.left, top: r.top, b: r.bottom }; };
    const ticks = s => [...j.querySelectorAll(s)].map(e => ({ t: e.textContent.trim(), fs: parseFloat(getComputedStyle(e).fontSize) }));
    const ins = [...j.querySelectorAll('input[type=range]')].map(i => ({ h: i.getBoundingClientRect().height, ap: getComputedStyle(i).appearance }));
    return { total: t('[data-total]').trim(), put: t('[data-put-total]').trim(), note: t('.note'), grow: lab('.end-grow'), putL: lab('.end-put'), plot: { l: pr.left, r: pr.right, t: pr.top, b: pr.bottom }, yt: ticks('.yt'), xt: ticks('.xt'), ins }; });
  const a = await read();
  check(`${vp}: savings lines are labelled at their ends with the end values`, !!a.grow && !!a.putL && /In the jar/.test(a.grow.t) && a.grow.t.includes(a.total) && /You put in/.test(a.putL.t) && a.putL.t.includes(a.put) && a.grow.r >= a.plot.r - 4 - 160 && a.putL.r >= a.plot.r - 4 - 160 && (a.grow.b <= a.putL.top + 1 || a.putL.b <= a.grow.top + 1), JSON.stringify(a));
  check(`${vp}: savings axes have ticks: ≥3 £ values and ≥3 years, ≥11px`, a.yt.length >= 3 && a.yt.every(x => /^£[\d,]+$/.test(x.t) && x.fs >= 11) && a.xt.length >= 3 && a.xt.every(x => x.fs >= 11) && a.xt.some(x => /\d/.test(x.t)), JSON.stringify({ yt: a.yt, xt: a.xt }));
  check(`${vp}: savings sliders are thick, custom-drawn controls (≥24px tall)`, a.ins.length === 2 && a.ins.every(i => i.h >= 24 && i.ap === 'none'), JSON.stringify(a.ins));
  check(`${vp}: savings still in £ at 4%`, /^£/.test(a.total) && /4%/.test(a.note), `${a.total} / ${a.note}`);
  await page.locator('#spec-body input[data-years]').focus(); await page.keyboard.press('ArrowRight');
  const n = await bodyAnims(page, '#spec-body [data-total]');
  const b = await read();
  check(`${vp}: the jar total animates when it changes, and the end labels follow`, n >= 1 && b.total !== a.total && b.grow.t.includes(b.total), JSON.stringify({ n, a: a.total, b: b.total, g: b.grow && b.grow.t }));
  // every allowed slider pair draws finite coordinates, and the end value fits under the top tick
  const sweep = await page.evaluate(() => { const j = document.querySelector('#spec-body .jar'), mo = j.querySelector('[data-monthly]'), yr = j.querySelector('[data-years]'), bad = [], num = s => +String(s).replace(/[^\d.]/g, '');
    let pairs = 0;
    for (let m = +mo.min; m <= +mo.max; m += +mo.step) for (let y = +yr.min; y <= +yr.max; y += +yr.step) {
      mo.value = m; yr.value = y; mo.dispatchEvent(new Event('input')); pairs++;
      const attrs = [...j.querySelectorAll('svg, svg *')].flatMap(e => [...e.attributes].map(a => a.value)), styles = [...j.querySelectorAll('[style]')].map(e => e.getAttribute('style'));
      const ticks = [...j.querySelectorAll('.yt')].map(e => num(e.textContent)), total = num(j.querySelector('[data-total]').textContent), top = Math.max(...ticks);
      const why = [];
      if ([...attrs, ...styles].some(v => /NaN|undefined|Infinity/.test(v))) why.push('non-finite coordinate');
      if (!(ticks.length >= 3 && new Set(ticks).size === ticks.length && Number.isFinite(top) && top > 0)) why.push('ticks ' + ticks.join('/'));
      if (!(total <= top)) why.push(`total ${total} over top tick ${top}`);
      if (why.length) bad.push(`£${m} × ${y}y: ${why.join(', ')}`);
    }
    mo.value = 10; yr.value = 10; mo.dispatchEvent(new Event('input'));
    return { pairs, bad }; });
  check(`${vp}: every slider pair (${sweep.pairs}) draws finite coordinates with the end value under the top tick`, sweep.pairs === 900 && sweep.bad.length === 0, `${sweep.bad.length} bad: ${sweep.bad.slice(0, 5).join(' | ')}`);
  await closeEsc(page);
}

async function paperPolish(page, vp) {
  await page.evaluate(() => openSpec('paper')); await wait(400);
  await page.evaluate(() => Promise.all([...document.querySelectorAll('#spec-body img')].map(i => i.complete ? 1 : new Promise(r => { i.onload = i.onerror = r; }))));
  const p = await page.evaluate(() => { const P = document.querySelector('#spec-body .paper'), pr = P.getBoundingClientRect(), lead = P.querySelector('.lead'), lr = lead && lead.getBoundingClientRect(), li = lead && lead.querySelector('img'), lh = lead && lead.querySelector('h4');
    const sun = new Date(); sun.setDate(sun.getDate() - sun.getDay()); const nxt = new Date(sun); nxt.setDate(sun.getDate() + 7);
    const fmt = d => d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });
    return { pw: pr.width, lead: lr ? { w: lr.width, imgH: li ? li.getBoundingClientRect().height : 0, imgOk: !!li && li.naturalWidth > 0, h: lh ? parseFloat(getComputedStyle(lh).fontSize) : 0 } : null,
      stories: [...P.querySelectorAll('.stories article')].map(a => { const r = a.getBoundingClientRect(), im = a.querySelector('img, svg'); return { l: Math.round(r.left), h: Math.round(r.height), art: !!im && (im.tagName === 'svg' || im.naturalWidth > 0) && im.getBoundingClientRect().height >= 60 }; }),
      mast: P.querySelector('.mast').textContent.replace(/\s+/g, ' '), next: (P.querySelector('.next-issue') || {}).textContent || '', want: fmt(sun), wantNext: fmt(nxt), year: String(sun.getFullYear()) }; });
  check(`${vp}: paper has a full-width lead story with a big picture and headline`, !!p.lead && p.lead.w >= .9 * p.pw && p.lead.imgOk && p.lead.imgH >= 160 && p.lead.h >= 26, JSON.stringify(p.lead));
  const hs = p.stories.map(x => x.h), cols = new Set(p.stories.map(x => x.l)).size;
  check(`${vp}: paper has 3 more stories, each with a picture${vp === 'desktop' ? ', side by side in balanced columns' : ''}`, p.stories.length === 3 && p.stories.every(x => x.art) && (vp !== 'desktop' || (cols === 3 && Math.max(...hs) - Math.min(...hs) <= .25 * Math.max(...hs))), JSON.stringify(p.stories));
  check(`${vp}: paper masthead carries this Sunday's date and a next-issue cue names next Sunday`, p.mast.includes(p.want) && p.mast.includes(p.year) && /Next issue/.test(p.next) && p.next.includes(p.wantNext), JSON.stringify({ mast: p.mast, next: p.next, want: p.want, wantNext: p.wantNext }));
  await closeEsc(page);
}

async function moonPolish(page, vp) {
  await page.evaluate(() => openSpec('moon')); await wait(450);
  const m = await page.evaluate(() => { const syn = 29.530588853, ref = Date.UTC(2000, 0, 6, 18, 14) / 864e5, age = (((Date.now() / 864e5 - ref) % syn) + syn) % syn, lit = Math.round((1 - Math.cos(2 * Math.PI * age / syn)) / 2 * 100);
    const d = document.querySelector('#spec-body .dash'), sv = d.querySelector('.moonsvg'), arc = d.querySelector('.phasearc');
    const tiles = [...d.querySelectorAll('.tile:not(.big)')].map(t => { const g = t.querySelector('svg'), r = g && g.getBoundingClientRect(); return !!r && r.width >= 20 && r.height >= 12; });
    return { lit, frac: age / syn, shownLit: +((d.querySelector('.big .s') || {}).textContent || '').replace(/\D/g, ''), svg: !!sv, arc: arc ? { frac: +arc.dataset.frac, dot: !!arc.querySelector('.now'), x: arc.querySelector('.now') ? (+arc.querySelector('.now').getAttribute('cx') - 12) / 176 : -1 } : null, tiles, cd: (d.querySelector('.countdown') || {}).textContent || '' }; });
  check(`${vp}: moon phase is real: the tile says the true lit percentage`, m.shownLit === m.lit, JSON.stringify(m));
  // the arc runs new (left) → full (top) → new (right): today's dot sits at x = (1 − cos πf) / 2 of its width
  check(`${vp}: moon has a phase arc with today's place on the cycle`, !!m.arc && m.arc.dot && Math.abs(m.arc.frac - m.frac) < .01 && Math.abs(m.arc.x - (1 - Math.cos(Math.PI * m.frac)) / 2) < .03, JSON.stringify(m.arc));
  let litPx = null;
  if (m.svg) { const b = await box(page, '#spec-body .moonsvg');
    litPx = await page.evaluate(async b64 => { const { w, h, d } = await __c.px(b64), cx = w / 2, cy = h / 2, R = Math.min(w, h) / 2 - 2; let n = 0, on = 0;
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { if (Math.hypot(x + .5 - cx, y + .5 - cy) > R) continue; n++; const k = (y * w + x) * 4; if (__c.lum({ r: d[k], g: d[k + 1], b: d[k + 2] }) > .35) on++; }
      return Math.round(on / n * 100); }, await shot64(page, b)); }
  check(`${vp}: the drawn moon is lit by the real fraction (${litPx}% of the disc vs ${m.lit}%)`, litPx !== null && Math.abs(litPx - m.lit) <= 12, String(litPx));
  check(`${vp}: every small moon tile has its own icon or sparkline`, m.tiles.length === 4 && m.tiles.every(Boolean), JSON.stringify(m.tiles));
  await wait(1200); const cd2 = await page.evaluate(() => (document.querySelector('#spec-body .countdown') || {}).textContent || '');
  check(`${vp}: moon has a live countdown that ticks`, /\d+h \d{2}m \d{2}s/.test(m.cd) && cd2 !== m.cd && /\d+h \d{2}m \d{2}s/.test(cd2), `${m.cd} / ${cd2}`);
  // only the phase (and the full-moon date worked out from it) is real; Saturn, the sky and the space station pass are made up, and say so where you can see it
  const eg = await page.evaluate(() => [...document.querySelectorAll('#spec-body .dash .tile')].map(t => { const tag = t.querySelector('.eg'), r = tag && tag.getBoundingClientRect(), cs = tag && getComputedStyle(tag);
    return { k: t.querySelector('.k').firstChild.textContent.trim(), tag: !!r && r.width > 10 && r.height > 8 && cs.visibility !== 'hidden' && +cs.opacity > .5 && /^example$/i.test(tag.textContent.trim()) }; }));
  const MADEUP = ['Saturn', 'Sky', 'Space station'];
  check(`${vp}: moon's made-up tiles (${MADEUP.join(', ')}) carry a visible "example" tag; the real phase and full moon do not`, eg.length === 5 && eg.every(t => t.tag === MADEUP.includes(t.k)), JSON.stringify(eg));
  await closeEsc(page);
  // nothing on the page claims to show the real sky
  const claims = [];
  for (const id of await page.evaluate(() => Object.keys(SPECS))) { await page.evaluate(id => openSpec(id), id); await wait(150);
    if (/real sky/i.test(await page.evaluate(() => document.getElementById('spec').innerText))) claims.push(id); await closeEsc(page); }
  if (/real sky/i.test(await page.evaluate(() => document.body.innerText))) claims.push('page');
  check(`${vp}: no rendered text says "real sky"`, claims.length === 0, claims.join(', '));
}

// The opening: gardens show through within ~1 s, and every line of the card stays readable (pixels).
async function openingPolish(browser, vp) {
  const { ctx, page, errors } = await newPage(browser, vp); // newPage already waited 300 ms after load
  // when each card on screen finishes rising in: its animation delay plus duration
  const op = await page.evaluate(() => { const xs = [...document.querySelectorAll('.thing.enter')].filter(t => { const r = t.getBoundingClientRect(); return r.bottom > 0 && r.top < innerHeight && r.right > 0 && r.left < innerWidth; })
      .map(t => { const cs = getComputedStyle(t); return parseFloat(cs.animationDelay) + parseFloat(cs.animationDuration); }).sort((a, b) => a - b); return { n: xs.length, median: xs[Math.floor(xs.length / 2)], last: xs[xs.length - 1] }; });
  check(`${vp}: gardens around the opening card have risen in by 1.2 s (median ${op.median}s, last ${op.last}s)`, op.n >= 3 && op.median <= 1.2 && op.last <= 1.6, JSON.stringify(op));
  await wait(1200); await page.evaluate(HELP);
  const tc = await textContrast(page, '#card .mark, #card h1, #card .lede, #card .reassure, #card .explore');
  check(`${vp}: every line on the opening card has ≥4.5:1 contrast against what is behind it (pixels)`, tc.length >= 5 && tc.every(x => x.ratio >= 4.5), JSON.stringify(tc));
  if (vp !== 'desktop') {
    await explore(page); await page.evaluate(() => { px -= 120; py -= 700; apply(); }); await wait(400);
    const b = await page.evaluate(() => { const p = document.getElementById('pill'), bar = document.getElementById('pillbar'), pr = p.getBoundingClientRect(), br = bar.getBoundingClientRect(), bg = __c.rgb(getComputedStyle(p).backgroundColor), fg = __c.rgb(getComputedStyle(p).color);
      return { bar: getComputedStyle(bar).opacity, covers: br.top <= pr.top - 16 && br.bottom >= pr.bottom && br.left <= pr.left && br.right >= pr.right, ratio: +__c.ratio(bg, fg).toFixed(2), paper: +__c.ratio(bg, { r: 248, g: 245, b: 236, a: 1 }).toFixed(2) }; });
    check(`${vp}: the sticky Reserve button keeps its paper backing and reads clearly`, b.bar === '1' && b.covers && b.ratio >= 4.5 && b.paper >= 4.5, JSON.stringify(b));
  }
  check(`${vp}: no errors in the opening pass`, errors.length === 0, errors.join(' | '));
  await ctx.close();
}

// Specimen cards stand out from ordinary ones: a preview strip on top and a clearer badge.
async function specCards(page, vp) {
  const c = await page.evaluate(() => { const plain = document.querySelector('.thing:not(.spec):not(.live)');
    return { plainPeek: !!plain.querySelector('.peek'), cards: [...document.querySelectorAll('[data-spec]')].map(el => { const pk = el.querySelector('.peek'), pr = pk && pk.getBoundingClientRect(), cr = el.getBoundingClientRect(), m = el.querySelector('.open-mark'), mr = m.getBoundingClientRect(), mb = getComputedStyle(m, '::before'), ms = getComputedStyle(m);
      return { id: el.dataset.spec, peek: !!pr && pk.offsetHeight >= 44 && pr.width >= .9 * cr.width && (getComputedStyle(pk).backgroundImage !== 'none' || !!pk.querySelector('svg, img')), top: !!pr && pr.top - cr.top < 2, badgeH: m.offsetHeight /* layout px: the canvas itself is zoomed */, glyph: mb.content !== 'none' && parseFloat(mb.width) >= 10, ratio: +__c.ratio(__c.rgb(ms.backgroundColor), __c.rgb(ms.color)).toFixed(2) }; }) }; });
  const bad = c.cards.filter(x => !x.peek || !x.top || x.badgeH < 22 || !x.glyph || x.ratio < 4.5);
  check(`${vp}: every specimen card has a preview strip on top and a clear Grdn badge; ordinary cards do not`, c.cards.length === 9 && bad.length === 0 && !c.plainPeek, JSON.stringify(bad.length ? bad : c));
}

// A specimen's timers and window listeners stop when its view closes, and at once when another specimen replaces it.
// Test hook: wrap setInterval/clearInterval and window add/removeEventListener, and note what each openSpec call starts.
async function specCleanup(page, vp, specs) {
  await page.evaluate(() => { if (window.__trk) return; const T = window.__trk = { on: false, live: new Set(), ls: [], mine: { iv: [], ls: [] } };
    const si = window.setInterval, ci = window.clearInterval, ae = window.addEventListener, re = window.removeEventListener, cap = o => !!(o === true || (o && o.capture));
    window.setInterval = (...a) => { const id = si.apply(window, a); if (T.on) { T.live.add(id); T.mine.iv.push(id); } return id; };
    window.clearInterval = id => { T.live.delete(id); return ci.call(window, id); };
    window.addEventListener = (t, f, o) => { if (T.on) { const l = [t, f, cap(o)]; T.ls.push(l); T.mine.ls.push(l); } return ae.call(window, t, f, o); };
    window.removeEventListener = (t, f, o) => { T.ls = T.ls.filter(x => !(x[0] === t && x[1] === f && x[2] === cap(o))); return re.call(window, t, f, o); };
    T.open = id => { T.mine = { iv: [], ls: [] }; T.on = true; try { openSpec(id); } finally { T.on = false; } return { iv: T.mine.iv.length, ls: T.mine.ls.length }; };
    T.alive = (m = T.mine) => m.iv.filter(id => T.live.has(id)).length + m.ls.filter(l => T.ls.includes(l)).length; });
  const ids = Object.keys(specs), started = {};
  for (const [k, id] of ids.entries()) {
    started[id] = await page.evaluate(id => __trk.open(id), id); await wait(400);
    await closeEsc(page);
    const closed = await page.evaluate(() => __trk.alive());
    const other = ids[(k + 1) % ids.length];
    await page.evaluate(id => __trk.open(id), id); await wait(300);
    const swapped = await page.evaluate(other => { const m = __trk.mine; openSpec(other); return __trk.alive(m); }, other); // synchronously, right after the swap
    await closeEsc(page);
    check(`${vp}: ${id} stops its timers and window listeners on close and when ${other} replaces it (started ${JSON.stringify(started[id])})`, closed === 0 && swapped === 0, JSON.stringify({ closed, swapped }));
  }
  check(`${vp}: the moon and Titan register something to clean up (the hook sees them)`, started.moon && started.moon.iv >= 1 && started.titan && started.titan.ls >= 1, JSON.stringify(started));
  check(`${vp}: the stream and the agent run on a timer the hook sees (and stops)`, started.stream && started.stream.iv >= 1 && started.agent && started.agent.iv >= 1, JSON.stringify({ stream: started.stream, agent: started.agent }));
  // the moon's countdown no longer ticks once its view is closed
  await page.evaluate(() => openSpec('moon')); await wait(400); await closeEsc(page);
  const c0 = await page.evaluate(() => document.querySelector('#spec-body .countdown')?.textContent ?? null); await wait(2500);
  const c1 = await page.evaluate(() => document.querySelector('#spec-body .countdown')?.textContent ?? null);
  check(`${vp}: the moon countdown stays still for 2.5 s after close`, c0 === c1, `${c0} / ${c1}`);
}

async function polish(page, vp, specs) {
  await page.evaluate(HELP);
  await specCleanup(page, vp, specs);
  await focusRing(page, vp, specs);
  await madeLine(page, vp, specs);
  await whereNextPanel(page, vp, specs);
  await titanPolish(page, vp);
  if (vp !== 'desktop') await sheetReach(page, vp);
  await recipePolish(page, vp);
  await kyotoPolish(page, vp);
  await moodPolish(page, vp);
  await savingsPolish(page, vp);
  await paperPolish(page, vp);
  await moonPolish(page, vp);
  await specCards(page, vp);
}

// Every picture loads: each specimen's images while that specimen is open (waiting up to 10 s each, then naturalWidth > 0),
// and every image URL the canvas uses (card <img>s, which load lazily, and CSS background-image URLs on cards and preview strips) answers 200.
async function imagesLoad(page, vp, specs) {
  for (const id of Object.keys(specs)) {
    await page.evaluate(id => openSpec(id), id);
    const r = await page.evaluate(() => Promise.all([...document.querySelectorAll('#spec img')].map(i => new Promise(done => {
      const fin = () => done({ src: i.currentSrc || i.src, ok: i.naturalWidth > 0, w: i.naturalWidth });
      if (i.complete) return fin(); const t = setTimeout(() => done({ src: i.src, ok: false, w: 'timeout' }), 10000);
      i.addEventListener('load', () => { clearTimeout(t); fin(); }, { once: true }); i.addEventListener('error', () => { clearTimeout(t); fin(); }, { once: true }); }))));
    const bad = r.filter(x => !x.ok);
    check(`${vp}: ${id} every image loads while it is open (${r.length})`, bad.length === 0, bad.map(x => `${x.src} (${x.w})`).join(', '));
    await closeEsc(page);
  }
  const urls = await page.evaluate(() => { const out = new Set();
    for (const el of document.querySelectorAll('#world *, #spec *')) for (const m of getComputedStyle(el).backgroundImage.matchAll(/url\("?([^")]+)"?\)/g)) out.add(new URL(m[1], location.href).href);
    const bg = out.size; document.querySelectorAll('#world img').forEach(i => out.add(new URL(i.getAttribute('src') || i.dataset.src, location.href).href)); /* canvas pictures wait in data-src until they near the view */ return { all: [...out], bg }; });
  const failed = [];
  for (const u of urls.all) { const res = await page.request.get(u).catch(e => ({ status: () => String(e.message).slice(0, 60) })); if (res.status() !== 200) failed.push(`${u} → ${res.status()}`); }
  check(`${vp}: every canvas image and CSS background URL answers 200 (${urls.all.length}, ${urls.bg} backgrounds)`, urls.bg >= 1 && urls.all.length > urls.bg && failed.length === 0, failed.join(', '));
}

// ---------- audit fixes (2026-10-28): measured checks for the antiwebslop audit items ----------
VIEWPORTS.tablet = { viewport: { width: 768, height: 1024 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 };
VIEWPORTS.laptop = { viewport: { width: 1024, height: 768 } };
VIEWPORTS.mid = { viewport: { width: 880, height: 800 } };

// The specimen view between phone and desktop: a wide main column, nothing wider than the screen, paper text in real lines.
async function tabletDialog(browser) {
  for (const vp of ['tablet', 'mid', 'laptop']) {
    const { ctx, page, errors } = await newPage(browser, vp);
    await explore(page);
    for (const id of await page.evaluate(() => Object.keys(SPECS))) {
      await page.evaluate(id => openSpec(id), id); await wait(400);
      const r = await page.evaluate(() => { const P = document.querySelector('#spec .panel'), p = P.getBoundingClientRect(), m = document.querySelector('#spec .main'), mr = m.getBoundingClientRect(), n = document.querySelector('#spec .next').getBoundingClientRect();
        const wide = [...P.querySelectorAll('*')].filter(e => { const b = e.getBoundingClientRect(); return b.width && (b.right > p.right + 1 || b.left < p.left - 1) && !e.closest('.stage'); }).map(e => e.className || e.tagName).slice(0, 4);
        return { vw: innerWidth, panel: Math.round(p.width), main: Math.round(mr.width), next: Math.round(n.width), docOver: document.documentElement.scrollWidth - innerWidth, panelOver: P.scrollWidth - P.clientWidth, mainOver: m.scrollWidth - m.clientWidth, wide }; });
      check(`${vp}: ${id} view main column is wide (≥560px or the full panel)`, r.main >= 560 || r.main >= r.panel - 2, JSON.stringify(r));
      check(`${vp}: ${id} view has no horizontal overflow`, r.docOver <= 0 && r.panelOver <= 1 && r.mainOver <= 1 && r.wide.length === 0, JSON.stringify(r));
      check(`${vp}: ${id} Where next is at least 260px wide`, r.next >= 260, JSON.stringify(r));
      if (id === 'paper') {
        // words per line in each paper paragraph and headline: a line box count from the element's height and line height
        const lines = await page.evaluate(() => [...document.querySelectorAll('#spec-body .paper article p, #spec-body .paper article h4, #spec-body .paper .dateline span')].filter(e => e.getClientRects().length).map(e => {
          const cs = getComputedStyle(e), lh = parseFloat(cs.lineHeight) || parseFloat(cs.fontSize) * 1.2, n = Math.max(1, Math.round(e.getBoundingClientRect().height / lh)), words = e.textContent.trim().split(/\s+/).length;
          return { t: e.textContent.trim().slice(0, 20), tag: e.tagName, lines: n, perLine: +(words / n).toFixed(1), words }; }));
        const bad = lines.filter(l => l.tag === 'SPAN' ? l.lines > 1 : l.tag === 'P' ? l.perLine < 4 : l.words > 3 && l.perLine < 2.5);
        check(`${vp}: paper text reads in real lines (paragraphs ≥4 words a line, headlines ≥2.5, dateline on one line)`, lines.length >= 8 && bad.length === 0, JSON.stringify(bad.length ? bad : lines.slice(0, 3)));
      }
      if (SHOTS && ['paper', 'titan', 'kyoto'].includes(id)) await page.screenshot({ path: `${SHOTS}/${vp}-${id}.png` });
      await closeEsc(page);
    }
    check(`${vp}: no errors in the tablet dialog pass`, errors.length === 0, errors.join(' | '));
    await ctx.close();
  }
}

// Keyboard order: the first Tab lands in the opening card, never in the canvas behind it; after Explore the canvas is reachable.
async function tabOrder(browser) {
  for (const vp of ['desktop', 'phone']) {
    const { ctx, page, errors } = await newPage(browser, vp);
    const where = () => page.evaluate(() => { const a = document.activeElement; return { inCard: !!a.closest('#card'), inView: !!a.closest('#view'), pill: a.id === 'pill', tag: a.tagName, label: (a.getAttribute('aria-label') || a.textContent || '').trim().slice(0, 24) }; });
    await page.keyboard.press('Tab'); const first = await where();
    check(`${vp}: the first Tab from load lands in the opening card's email field`, first.inCard && first.tag === 'INPUT', JSON.stringify(first));
    const seen = [first]; for (let k = 0; k < 8; k++) { await page.keyboard.press('Tab'); seen.push(await where()); }
    const stray = seen.filter(s => s.inView || s.pill);
    check(`${vp}: while the opening card shows, Tab never reaches the canvas or the hidden pill (9 presses)`, stray.length === 0, JSON.stringify(stray));
    const covered = await page.evaluate(() => [...document.querySelectorAll('#world a[href], #world button, #world [tabindex], #world input, #pill')].filter(e => e.tabIndex >= 0 && !e.closest('[inert]') && !e.inert).length);
    check(`${vp}: no canvas control or the pill is tabbable behind the opening card`, covered === 0, String(covered));
    await page.click('#explore'); await wait(700);
    const out = []; for (let k = 0; k < 6; k++) { await page.keyboard.press('Tab'); out.push(await where()); }
    check(`${vp}: after Explore, Tab reaches the canvas and not the hidden card`, out.some(s => s.inView) && !out.some(s => s.inCard), JSON.stringify(out));
    const specs = await page.evaluate(() => [...document.querySelectorAll('[data-spec]')].every(c => c.tabIndex === 0));
    check(`${vp}: after Explore every specimen card is tabbable`, specs);
    // back to the card with the pill: the canvas leaves the tab order again and focus goes to the email field
    await page.evaluate(() => document.getElementById('pill').click()); await wait(500);
    const back = await where(), covered2 = await page.evaluate(() => [...document.querySelectorAll('#world a[href], #world button, #world [tabindex], #world input')].filter(e => e.tabIndex >= 0 && !e.closest('[inert]')).length);
    check(`${vp}: Reserve pill brings the card back with focus in the email field and the canvas out of the tab order`, back.inCard && back.tag === 'INPUT' && covered2 === 0, JSON.stringify({ back, covered2 }));
    check(`${vp}: no errors in the tab order pass`, errors.length === 0, errors.join(' | '));
    await ctx.close();
  }
}

// The email field's focus state: at least a 2px-thick ring of pixels whose colour changes by ≥3:1 against the unfocused field (WCAG 2.4.13).
async function emailFocus(browser) {
  for (const vp of ['desktop', 'phone']) {
    const { ctx, page, errors } = await newPage(browser, vp); await wait(1000); await page.evaluate(HELP);
    await page.addStyleTag({ content: '#f input { caret-color: transparent !important; }' });
    const b = await box(page, '#f input[type=email]'), clip = { x: b.x - 8, y: b.y - 8, w: b.w + 16, h: b.h + 16 };
    const before = await shot64(page, clip);
    await page.keyboard.press('Tab'); await wait(400);
    const focused = await page.evaluate(() => document.activeElement.matches('#f input[type=email]'));
    const after = await shot64(page, clip);
    const n = await page.evaluate(async ([a, z]) => { const A = await __c.px(a), Z = await __c.px(z); let n = 0;
      for (let k = 0; k < A.d.length; k += 4) { const p = { r: A.d[k], g: A.d[k + 1], b: A.d[k + 2] }, q = { r: Z.d[k], g: Z.d[k + 1], b: Z.d[k + 2] }; if (__c.ratio(p, q) >= 3) n++; } return n; }, [before, after]);
    const need = Math.round(2 * (b.w + b.h) * 2);
    check(`${vp}: the email field's focus ring changes ≥3:1 over at least a 2px ring (${n} of ${need} px)`, focused && n >= need, JSON.stringify({ focused, n, need }));
    check(`${vp}: no errors in the email focus pass`, errors.length === 0, errors.join(' | '));
    await ctx.close();
  }
}

// The opening entrance: the card and everything in it is fully in within 400 ms (delay + duration of every animation on it); reduced motion has none.
async function entrance(browser) {
  for (const vp of ['desktop', 'phone']) {
    for (const rm of [false, true]) {
      const { ctx, page, errors } = await newPage(browser, vp, rm ? { reducedMotion: 'reduce' } : {});
      const e = await page.evaluate(() => { const secs = v => v.split(',').map(x => parseFloat(x) * (/ms/.test(x) ? .001 : 1));
        return [document.getElementById('card'), ...document.querySelectorAll('#card *')].filter(el => getComputedStyle(el).animationName !== 'none').map(el => { const cs = getComputedStyle(el), d = secs(cs.animationDelay), u = secs(cs.animationDuration);
          return { el: el.id || el.className || el.tagName, end: Math.round(Math.max(...u.map((x, i) => x + (d[i % d.length] || 0))) * 1000) }; }).filter(x => x.end > 0); });
      const last = Math.max(0, ...e.map(x => x.end));
      if (rm) check(`${vp}: reduced motion: the opening card has no entrance animation`, e.length === 0, JSON.stringify(e));
      else check(`${vp}: the opening card and its lines are fully in within 400 ms (last ends at ${last} ms, ${e.length} animated)`, e.length >= 5 && last <= 400, JSON.stringify(e));
      check(`${vp}${rm ? ' (reduced)' : ''}: no errors in the entrance pass`, errors.length === 0, errors.join(' | '));
      await ctx.close();
    }
  }
}

// No line on the opening card ends on one word alone (phones). Owner copy is unchanged; only wrapping may change.
const OPENING_LINES = ['#card h1', '#card .lede', '#card .reassure', '#card .explore'];
async function widows(page, vp) {
  const r = await page.evaluate(sels => sels.map(sel => { const el = document.querySelector(sel); if (!el || !el.getClientRects().length) return { sel, missing: true };
    const tops = [], walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    for (let tn; (tn = walker.nextNode());) { const re = /[^\s ]+/g; let m; while ((m = re.exec(tn.textContent))) { const rg = document.createRange(); rg.setStart(tn, m.index); rg.setEnd(tn, m.index + m[0].length); tops.push(Math.round(rg.getBoundingClientRect().top)); } }
    const lines = [...new Set(tops)].sort((a, b) => a - b), last = lines[lines.length - 1];
    return { sel, lines: lines.length, last: tops.filter(t => Math.abs(t - last) <= 2).length }; }), OPENING_LINES);
  const bad = r.filter(x => x.missing || (x.lines > 1 && x.last < 2));
  check(`${vp}: no opening card line ends on a lone word (${r.map(x => x.lines).join('/')} lines)`, bad.length === 0, JSON.stringify(bad));
}
async function widowPass(browser) {
  for (const vp of ['phone', 'small']) { const { ctx, page, errors } = await newPage(browser, vp); await wait(1000); await widows(page, vp); await ctx.close(); }
}

// Tap targets on phones: Explore, the email field, Reserve and the pill are at least 44px tall.
async function tapTargets(browser) {
  for (const vp of ['phone', 'small']) {
    const { ctx, page, errors } = await newPage(browser, vp); await wait(1000);
    const a = await page.evaluate(() => ['#explore', '#f input[type=email]', '#f button'].map(s => { const r = document.querySelector(s).getBoundingClientRect(); return { s, w: Math.round(r.width), h: Math.round(r.height) }; }));
    await explore(page);
    const p = await page.evaluate(() => { const r = document.getElementById('pill').getBoundingClientRect(); return { s: '#pill', w: Math.round(r.width), h: Math.round(r.height) }; });
    const all = [...a, p], bad = all.filter(x => x.h < 44 || x.w < 44);
    check(`${vp}: Explore, the email field, Reserve and the pill are ≥44px tap targets`, bad.length === 0, JSON.stringify(all));
    check(`${vp}: no errors in the tap target pass`, errors.length === 0, errors.join(' | '));
    await ctx.close();
  }
}

// Small grey text (meta, counts, captions, bylines, why lines) reaches 4.5:1 against its real background, by computed colours,
// over the whole canvas and inside every specimen view. "Grey" is any text colour whose channels sit within 60 of each other (the ink family, and white).
// Text over a picture or a gradient is skipped here (the pixel checks above cover the opening card and the HUD).
const scanGrey = (page, root) => page.evaluate(root => {
  const bgOf = el => { const layers = []; for (let e = el; e; e = e.parentElement) { const cs = getComputedStyle(e); if (e.id !== 'view' && cs.backgroundImage !== 'none') return null; const c = __c.rgb(cs.backgroundColor); if (c && c.a > 0) { layers.push(c); if (c.a >= 1) break; } }
    let bg = { r: 255, g: 255, b: 255, a: 1 }; for (let i = layers.length - 1; i >= 0; i--) bg = __c.over(layers[i], bg); return bg; };
  const out = [];
  for (const el of document.querySelectorAll(`${root}, ${root} *`)) {
    if (el.closest('svg, .heart, .kept.bump, [aria-hidden="true"]:not(.nx-th)')) continue;
    if (![...el.childNodes].some(n => n.nodeType === 3 && n.textContent.trim())) continue;
    const cs = getComputedStyle(el); if (!el.getClientRects().length || cs.visibility === 'hidden') continue;
    const ink = __c.ink(el); if (ink.a < .05) continue;
    const spread = Math.max(ink.r, ink.g, ink.b) - Math.min(ink.r, ink.g, ink.b); if (spread > 60 && !el.matches('.live .tag')) continue;
    const bg = bgOf(el); if (!bg) continue;
    const fs = parseFloat(cs.fontSize), large = fs >= 24 || (fs >= 18.66 && +cs.fontWeight >= 700), need = large ? 3 : 4.5, ratio = __c.ratio(__c.over(ink, bg), bg);
    if (ratio < need) out.push({ t: el.textContent.trim().slice(0, 22), cls: el.className, fs, ratio: +ratio.toFixed(2) });
  }
  return out; }, root);
async function greyContrast(browser) {
  const { ctx, page, errors } = await newPage(browser, 'desktop'); await explore(page); await wait(1000); await page.evaluate(HELP);
  const canvas = await scanGrey(page, '#world');
  const uniq = a => [...new Map(a.map(x => [x.cls + '|' + x.ratio, x])).values()];
  check(`desktop: small grey text on the canvas reaches 4.5:1 against its background (computed colours)`, canvas.length === 0, `${canvas.length} low: ${JSON.stringify(uniq(canvas).slice(0, 6))}`);
  for (const id of await page.evaluate(() => Object.keys(SPECS))) {
    await page.evaluate(id => openSpec(id), id); await wait(450);
    const low = await scanGrey(page, '#spec .panel');
    check(`desktop: ${id} view's small grey text reaches 4.5:1 (computed colours)`, low.length === 0, `${low.length} low: ${JSON.stringify(uniq(low).slice(0, 6))}`);
    await closeEsc(page);
  }
  check('desktop: no errors in the grey contrast pass', errors.length === 0, errors.join(' | '));
  await ctx.close();
}

// Video cards show a real frame, and no rendered text uses internal words (node, Veo) a newcomer can't parse.
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..');
async function videosAndWords(browser) {
  const { ctx, page, errors } = await newPage(browser, 'desktop'); await explore(page);
  // each video's garden is brought into view first: canvas pictures load only near the view
  for (const g of await page.evaluate(() => [...new Set([...document.querySelectorAll('.thing.video')].map(c => c.closest('.garden').querySelector('h2').textContent))])) { await page.evaluate(g => goGarden(g), g); await wait(900); }
  const v = await page.evaluate(() => Promise.all([...document.querySelectorAll('.thing.video')].map(async c => { const img = c.querySelector('.thumb img'), svg = c.querySelector('.thumb svg');
    if (img) { if (!img.complete || !img.getAttribute('src')) await new Promise(r => { img.onload = img.onerror = r; setTimeout(r, 8000); }); }
    return { t: c.querySelector('.t').textContent, img: img ? img.getAttribute('src') : null, ok: img ? img.naturalWidth > 0 : !!svg && svg.querySelectorAll('path, line, rect, circle, polyline, polygon').length >= 5 }; })));
  const missing = v.filter(x => !x.ok || (x.img && !fs.existsSync(path.join(ROOT, 'web', x.img.replace(/^.*\/web\//, '')))));
  check(`desktop: every video card shows a real frame (${v.length})`, v.length >= 3 && missing.length === 0, JSON.stringify(missing.length ? missing : v));
  const texts = [await page.evaluate(() => document.body.innerText)];
  for (const id of await page.evaluate(() => Object.keys(SPECS))) { await page.evaluate(id => openSpec(id), id); await wait(150); texts.push(await page.evaluate(() => document.getElementById('spec').innerText)); await closeEsc(page); }
  const hits = texts.flatMap(t => t.match(/[^\n]*(\bnode\b|Veo)[^\n]*/gi) || []);
  check('desktop: no rendered text says "node" or "Veo"', hits.length === 0, hits.slice(0, 4).join(' | '));
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8'), refs = [...new Set([...html.matchAll(/(?:grdn-site\.vercel\.app\/web\/|['"])(\w[\w.-]*\.(?:png|jpe?g|webp|gif|svg))['"]/g)].map(m => m[1]))]; // names in the page source, absolute or bare (IMG() adds the base)
  const absent = refs.filter(f => !fs.existsSync(path.join(ROOT, 'web', f)));
  check(`every web/ image the page names exists in web/ (${refs.length})`, refs.length > 20 && absent.length === 0, absent.join(', '));
  check('desktop: no errors in the video pass', errors.length === 0, errors.join(' | '));
  await ctx.close();
}

// Sharing basics: description, Open Graph and Twitter tags with absolute https images, theme colour, favicon, and the title without an em dash.
async function sharing(browser) {
  const { ctx, page, errors } = await newPage(browser, 'desktop');
  const h = await page.evaluate(() => { const m = q => document.querySelector(q)?.getAttribute('content') || ''; const icon = document.querySelector('link[rel~="icon"]');
    return { title: document.title, desc: m('meta[name="description"]'), ogTitle: m('meta[property="og:title"]'), ogDesc: m('meta[property="og:description"]'), ogImage: m('meta[property="og:image"]'), ogType: m('meta[property="og:type"]'),
      ogW: m('meta[property="og:image:width"]'), ogH: m('meta[property="og:image:height"]'), tw: m('meta[name="twitter:card"]'), twTitle: m('meta[name="twitter:title"]'), twDesc: m('meta[name="twitter:description"]'), twImage: m('meta[name="twitter:image"]'),
      theme: m('meta[name="theme-color"]'), icon: icon ? icon.getAttribute('href') : '' }; });
  check('title is "Grdn: everything worth a revisit" (no em dash)', h.title === 'Grdn: everything worth a revisit' && !/—/.test(h.title), h.title);
  check('meta description, og:title, og:description, og:type and the twitter card are present', h.desc.length >= 40 && h.ogTitle && h.ogDesc.length >= 40 && h.ogType === 'website' && h.tw === 'summary_large_image' && h.twTitle && h.twDesc, JSON.stringify(h));
  const abs = u => /^https:\/\/[^/]+\/.+/.test(u);
  check('og:image and twitter:image are absolute https URLs', abs(h.ogImage) && abs(h.twImage), `${h.ogImage} / ${h.twImage}`);
  const local = h.ogImage.match(/^https:\/\/grdn-site\.vercel\.app\/web\/([\w.-]+\.png)$/), file = local && path.join(ROOT, 'web', local[1]);
  let dims = null; if (file && fs.existsSync(file)) { const b = fs.readFileSync(file); dims = b.slice(1, 4).toString() === 'PNG' ? [b.readUInt32BE(16), b.readUInt32BE(20)] : null; }
  check('the og image is a 1200×630 PNG in web/ and the tags say so', !!dims && dims[0] === 1200 && dims[1] === 630 && h.ogW === '1200' && h.ogH === '630', JSON.stringify({ og: h.ogImage, dims, w: h.ogW, h: h.ogH }));
  check('theme-color and a favicon (inline SVG or absolute https) are set', /^#[0-9a-f]{6}$/i.test(h.theme) && (/^data:image\/svg\+xml/.test(h.icon) || abs(h.icon)), JSON.stringify({ theme: h.theme, icon: h.icon.slice(0, 40) }));
  check('no errors in the sharing pass', errors.length === 0, errors.join(' | '));
  await ctx.close();
}

// Small motion: the dot grid moves and scales with the canvas, and nothing uses `transition: all`.
async function groundAndTransitions(browser) {
  const { ctx, page, errors } = await newPage(browser, 'desktop'); await explore(page);
  const read = () => page.evaluate(() => { const cs = getComputedStyle(document.getElementById('view')); return { pos: cs.backgroundPosition, size: cs.backgroundSize, px, py, z }; });
  const a = await read();
  await page.mouse.move(700, 300); await page.mouse.down(); await page.mouse.move(760, 340, { steps: 4 }); await page.mouse.move(837, 361, { steps: 4 }); await page.mouse.up(); await wait(900);
  const b = await read();
  const want = s => { const t = 28 * s.z, m = v => ((v % t) + t) % t; return [m(s.px), m(s.py)]; }, got = s => s.pos.split(/\s+/).map(parseFloat);
  const near = (s) => { const [wx, wy] = want(s), [gx, gy] = got(s), t = 28 * s.z, d = (p, q) => Math.min(Math.abs(p - q), t - Math.abs(p - q)); return d(wx, gx) < 1 && d(wy, gy) < 1; };
  check('desktop: the dot grid moves with the canvas when it is dragged', a.pos !== b.pos && b.px !== a.px && near(b), JSON.stringify({ a, b, want: want(b) }));
  await page.evaluate(() => zoomAt(z * 1.25, innerWidth / 2, innerHeight / 2)); await wait(50);
  const c = await read();
  check('desktop: the dot grid scales with the canvas zoom', Math.abs(parseFloat(c.size) - 28 * c.z) < .5 && c.z !== b.z && near(c), JSON.stringify({ b, c }));
  const all = await page.evaluate(() => { const css = [...document.styleSheets].flatMap(s => { try { return [...s.cssRules].map(r => r.cssText); } catch { return []; } }).filter(t => /transition(-property)?\s*:\s*all\b/.test(t));
    const els = [...document.querySelectorAll('*')].filter(e => { const cs = getComputedStyle(e); return /\ball\b/.test(cs.transitionProperty) && cs.transitionDuration.split(',').some(d => parseFloat(d) > 0); }).map(e => e.id || e.className || e.tagName);
    return { css, els }; });
  check('no rule or element uses `transition: all`', all.css.length === 0 && all.els.length === 0, JSON.stringify(all));
  check('desktop: no errors in the ground pass', errors.length === 0, errors.join(' | '));
  await ctx.close();
}

// The reassure line sits centred under the form on every viewport.
async function reassureCentred(browser) {
  for (const vp of ['desktop', 'phone', 'small', 'tablet', 'mid', 'laptop']) {
    const { ctx, page, errors } = await newPage(browser, vp); await wait(500);
    const r = await page.evaluate(() => { const el = document.getElementById('reassure'), f = document.getElementById('f').getBoundingClientRect();
      const rg = document.createRange(); rg.selectNodeContents(el); const lines = [...rg.getClientRects()].filter(b => b.width > 0);
      const fc = f.left + f.width / 2, off = lines.map(b => Math.round(Math.abs(b.left + b.width / 2 - fc) * 10) / 10);
      return { align: getComputedStyle(el).textAlign, off, lines: lines.length }; });
    check(`${vp}: reassure line is centred under the form (text-align center, each line within 2px of the form's centre)`, r.align === 'center' && r.lines > 0 && r.off.every(o => o <= 2), JSON.stringify(r));
    check(`${vp}: no errors in the reassure pass`, errors.length === 0, errors.join(' | '));
    await ctx.close();
  }
}

// A point on empty canvas, away from the card, any specimen and the screen edges.
const emptyPoint = page => page.evaluate(() => { const c = document.getElementById('card').getBoundingClientRect();
  for (let y = 30; y < innerHeight - 120; y += 17) for (let x = 12; x < innerWidth - 12; x += 17) {
    if (x > c.left - 8 && x < c.right + 8 && y > c.top - 8 && y < c.bottom + 8) continue;
    const h = document.elementFromPoint(x, y); if (h && (h.id === 'view' || h.id === 'world' || h.classList.contains('garden'))) return { x, y }; }
  return null; });
const cardState = page => page.evaluate(() => ({ away: document.getElementById('card').classList.contains('away'), pill: document.getElementById('pill').classList.contains('show'), open: !document.getElementById('spec').hidden, url: location.href }));

// A tap or click outside the opening card starts wander mode, the same as Explore; taps inside the card, drags and keys do not; the first tap opens nothing.
async function tapOut(browser) {
  for (const vp of ['desktop', 'phone']) {
    const { ctx, page, errors } = await newPage(browser, vp); await wait(600);
    const c = await page.evaluate(() => { const r = document.getElementById('card').getBoundingClientRect(), h = document.querySelector('#card h1').getBoundingClientRect(); return { h1: { x: h.left + 10, y: h.top + h.height / 2 }, pad: { x: r.left + 12, y: r.top + 12 } }; });
    await page.mouse.click(c.h1.x, c.h1.y); await page.mouse.click(c.pad.x, c.pad.y); await page.click('#f input[type=email]'); await wait(300);
    const inside = await cardState(page);
    check(`${vp}: clicks inside the card (headline, padding, email field) keep the card`, !inside.away && !inside.pill, JSON.stringify(inside));
    await page.keyboard.press('Escape'); await page.keyboard.press('Tab'); await page.keyboard.press('Shift+Tab'); await wait(200);
    const keys = await cardState(page);
    check(`${vp}: keys do not dismiss the card`, !keys.away, JSON.stringify(keys));
    const p = await emptyPoint(page);
    const pxBefore = await page.evaluate(() => px);
    await page.mouse.move(p.x, p.y); await page.mouse.down(); await page.mouse.move(p.x + 30, p.y + 20, { steps: 5 }); await page.mouse.move(p.x + 60, p.y + 40, { steps: 5 }); await page.mouse.up(); await wait(300);
    const dragged = await cardState(page), pxAfter = await page.evaluate(() => px);
    check(`${vp}: a drag on the canvas pans and keeps the card`, !dragged.away && pxAfter !== pxBefore, JSON.stringify({ ...dragged, pxBefore, pxAfter }));
    const p2 = await emptyPoint(page);
    if (vp === 'phone') await page.touchscreen.tap(p2.x, p2.y); else await page.mouse.click(p2.x, p2.y);
    await wait(700);
    const out = await cardState(page);
    check(`${vp}: a ${vp === 'phone' ? 'tap' : 'click'} on empty canvas dismisses the card and shows the pill`, out.away && out.pill && !out.open, JSON.stringify(out));
    check(`${vp}: after tap-out the canvas is in the tab order and the card is not`, await page.evaluate(() => document.getElementById('card').inert && !document.getElementById('pill').inert && [...document.querySelectorAll('[data-spec]')].every(c => c.tabIndex === 0)));
    // the first tap on a specimen only dismisses the card; it opens nothing
    await page.evaluate(() => document.getElementById('pill').click()); await wait(700);
    const findSpec = () => page.evaluate(() => { const c = document.getElementById('card').getBoundingClientRect();
      for (let y = 30; y < innerHeight - 120; y += 13) for (let x = 12; x < innerWidth - 12; x += 13) {
        if (x > c.left - 8 && x < c.right + 8 && y > c.top - 8 && y < c.bottom + 8) continue;
        const h = document.elementFromPoint(x, y), t = h && h.closest('.thing.spec'); if (t && !h.closest('button, a, path, [data-pal]')) return { x, y, id: t.dataset.spec }; }
      return null; });
    let s = await findSpec();
    // a phone card covers most of the screen: pan a specimen's garden into view (the card stays up) until one sits beside the card
    for (const g of s ? [] : await page.evaluate(() => [...new Set(Object.values(SPECS).map(x => x.garden))])) { await page.evaluate(g => goGarden(g), g); await wait(900); s = await findSpec(); if (s) break; }
    if (s) { await page.mouse.click(s.x, s.y); await wait(700); const t = await cardState(page);
      check(`${vp}: the first tap on a specimen behind the card dismisses the card and does not open it`, t.away && !t.open, JSON.stringify({ ...t, s }));
      await page.mouse.click(s.x, s.y); await wait(700);
      check(`${vp}: after dismissal a tap on a specimen opens it as before`, await isOpen(page), JSON.stringify(s));
      await closeEsc(page);
    } else check(`${vp}: found a specimen beside the card to tap`, false);
    await page.evaluate(() => document.getElementById('pill').click()); await wait(700);
    const findLink = () => page.evaluate(() => { const c = document.getElementById('card').getBoundingClientRect();
      for (let y = 30; y < innerHeight - 120; y += 7) for (let x = 12; x < innerWidth - 12; x += 7) {
        if (x > c.left - 8 && x < c.right + 8 && y > c.top - 8 && y < c.bottom + 8) continue;
        const h = document.elementFromPoint(x, y); if (h && h.closest('#world a[href]')) return { x, y }; }
      return null; });
    let a = await findLink();
    for (const g of a ? [] : await page.evaluate(() => [...new Set(G.map(g => g.name))])) { await page.evaluate(g => goGarden(g), g); await wait(900); a = await findLink(); if (a) break; }
    check(`${vp}: found a link beside the card to tap`, !!a);
    if (a) { const before = page.url(), pages = ctx.pages().length;
      await page.mouse.click(a.x, a.y); await wait(500); const t = await cardState(page);
      check(`${vp}: the first tap on a link behind the card dismisses the card and does not follow the link`, t.away && page.url() === before && ctx.pages().length === pages, JSON.stringify({ ...t, pages: ctx.pages().length }));
    }
    check(`${vp}: no errors in the tap-out pass`, errors.length === 0, errors.join(' | '));
    await ctx.close();
  }
}

// The card shrinks into the pill when it goes away and grows back out of it; reduced motion swaps with no transform.
async function morph(browser) {
  for (const vp of ['desktop', 'phone']) {
    for (const rm of [false, true]) {
      const { ctx, page, errors } = await newPage(browser, vp, rm ? { reducedMotion: 'reduce' } : {}); await wait(600);
      const sample = (trigger) => page.evaluate(async trigger => {
        const card = document.getElementById('card'), pill = document.getElementById('pill'), ctr = el => { const r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width }; };
        const rest = ctr(card), restTf = getComputedStyle(card).transform;
        const t = document.getElementById(trigger); if (trigger === 'explore') t.click(); else t.click();
        await new Promise(r => setTimeout(r, 170));
        const mid = ctr(card), midTf = getComputedStyle(card).transform, anims = card.getAnimations().filter(a => a.playState === 'running').length, midOp = +getComputedStyle(card).opacity;
        await new Promise(r => setTimeout(r, 650));
        return { rest, mid, restTf, midTf, anims, midOp, endOp: +getComputedStyle(card).opacity, endTf: getComputedStyle(card).transform, pillOp: +getComputedStyle(pill).opacity, pillShow: pill.classList.contains('show'), pc: ctr(pill) };
      }, trigger);
      const go = await sample('explore');
      const d = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
      if (!rm) {
        check(`${vp}: Explore: mid-animation the card's centre has moved toward the pill and it is shrinking`, go.anims > 0 && d(go.mid, go.pc) < d(go.rest, go.pc) - 20 && go.mid.w < go.rest.w, JSON.stringify(go));
        check(`${vp}: Explore: the card ends hidden and the pill shows`, go.endOp === 0 && go.pillShow && go.pillOp === 1, JSON.stringify(go));
        const back = await sample('pill');
        check(`${vp}: pill: mid-animation the card is growing back from the pill toward its place`, back.anims > 0 && d(back.mid, back.pc) < d(back.mid, back.rest) + 400 && back.mid.y > back.rest.y + 2 && back.mid.w < back.rest.w, JSON.stringify(back));
        check(`${vp}: pill: the card ends in place and fully shown, the pill hidden`, back.endOp === 1 && back.endTf === back.restTf && !back.pillShow, JSON.stringify(back));
      } else {
        check(`${vp} (reduced): Explore uses no transform and no animation; the card ends hidden and the pill shows`, go.anims === 0 && go.midTf === go.restTf && go.endTf === go.restTf && go.endOp === 0 && go.pillShow, JSON.stringify(go));
        const back = await sample('pill');
        check(`${vp} (reduced): the pill brings the card back with no transform`, back.anims === 0 && back.midTf === back.restTf && back.endOp === 1 && !back.pillShow, JSON.stringify(back));
      }
      check(`${vp}${rm ? ' (reduced)' : ''}: no errors in the morph pass`, errors.length === 0, errors.join(' | '));
      await ctx.close();
    }
  }
}

// Some canvas cards were made or kept by a person's agent, and say so ("made by Arjun’s agent"); Grdn-made specimen cards still say Grdn.
async function agentMade(browser) {
  const { ctx, page, errors } = await newPage(browser, 'desktop'); await explore(page);
  const r = await page.evaluate(() => { const RE = /^(made|kept) by [A-Z][\w ]*’s agent\b/;
    const cards = [...document.querySelectorAll('#world .thing')].map(t => { const m = t.querySelector('.meta > span:first-child'), g = t.closest('.garden').querySelector('h2').textContent.trim();
      return { g, spec: t.dataset.spec || '', meta: m ? m.textContent.trim() : '', glyph: !!m && m.classList.contains('by-agent') && getComputedStyle(m, '::before').content !== 'none', shown: !!m && m.getBoundingClientRect().width > 20 }; });
    const agent = cards.filter(c => RE.test(c.meta));
    return { agent, gardens: [...new Set(agent.map(c => c.g))], specs: cards.filter(c => c.spec && c.spec !== 'agent' && /agent/i.test(c.meta)), specMade: cards.filter(c => c.spec && /^made with Grdn/.test(c.meta)).length }; });
  check(`desktop: at least 4 canvas cards in at least 3 gardens say a person's agent made or kept them (${r.agent.length} in ${r.gardens.length})`, r.agent.length >= 4 && r.gardens.length >= 3 && r.agent.every(c => c.glyph && c.shown), JSON.stringify(r.agent));
  check(`desktop: Grdn-made specimen cards still say Grdn, not an agent`, r.specs.length === 0 && r.specMade >= 5, JSON.stringify(r.specs));
  check('desktop: no errors in the agent-made pass', errors.length === 0, errors.join(' | '));
  await ctx.close();
}

// ---------- load speed (2026-10-29): small images, loaded only near the view; fonts that do not block the first paint ----------
// The file in web/ that an image URL names, whether the page uses the production base or its own /web/.
const webFile = u => { const m = String(u || '').match(/\/web\/([\w.-]+)$/); return m ? path.join(ROOT, 'web', m[1]) : null; };
// Image bytes the page asks for while it opens: everything requested up to network idle, then 1.5 s more of drift.
async function imageBytes(browser) {
  for (const [vp, cap] of [['phone', 600 * 1024], ['desktop', 1200 * 1024]]) {
    const ctx = await browser.newContext(VIEWPORTS[vp]); const page = await ctx.newPage(); const got = [];
    page.on('response', async res => { if (res.request().resourceType() !== 'image' || res.url().startsWith('data:')) return; const p = res.body().then(b => b.length).catch(() => 0); got.push({ u: res.url(), p }); });
    await page.goto(BASE, { waitUntil: 'networkidle' }); await wait(1500);
    const sizes = await Promise.all(got.map(async g => ({ u: g.u.replace(/^.*\/web\//, ''), n: await g.p })));
    const total = sizes.reduce((s, x) => s + x.n, 0), all = await page.evaluate(() => document.querySelectorAll('#world img').length);
    check(`${vp}: images asked for while the page opens weigh ≤ ${cap / 1024} KB (${(total / 1024).toFixed(0)} KB in ${sizes.length} of ${all} canvas images)`, total <= cap && sizes.length < all, JSON.stringify(sizes.sort((a, b) => b.n - a.n).slice(0, 8)));
    await ctx.close();
  }
}
// Every image the page can show: no file over 150 KB but og.png, and each one loads once its garden or specimen is shown.
async function imagesShown(browser) {
  const { ctx, page, errors } = await newPage(browser, 'desktop'); await explore(page);
  const gardens = await page.evaluate(() => G.filter(g => g.things.some(t => t.img)).map(g => g.name));
  const bad = [], files = new Set();
  const settle = sel => page.evaluate(sel => Promise.all([...document.querySelectorAll(sel)].map(i => new Promise(done => {
    const fin = () => done({ src: i.currentSrc || i.src || i.dataset.src || '', ok: i.naturalWidth > 0 });
    if (i.complete && i.src) return fin(); const t = setTimeout(fin, 6000);
    i.addEventListener('load', () => { clearTimeout(t); fin(); }, { once: true }); i.addEventListener('error', () => { clearTimeout(t); fin(); }, { once: true }); }))), sel);
  for (const g of gardens) {
    await page.evaluate(g => goGarden(g), g); await wait(900);
    const sel = await page.evaluate(g => { const el = [...document.querySelectorAll('#world .garden')].find(x => x.querySelector('h2').textContent === g); el.dataset.chk = 1; return '[data-chk] img'; }, g);
    for (const r of await settle(sel)) { files.add(r.src); if (!r.ok) bad.push(`${g}: ${r.src}`); }
    await page.evaluate(() => document.querySelector('[data-chk]').removeAttribute('data-chk'));
  }
  for (const id of await page.evaluate(() => Object.keys(SPECS))) {
    await page.evaluate(id => openSpec(id), id); await wait(300);
    for (const r of await settle('#spec img')) { files.add(r.src); if (!r.ok) bad.push(`${id}: ${r.src}`); }
    await closeEsc(page);
  }
  const bgs = await page.evaluate(() => { const out = new Set(); for (const el of document.querySelectorAll('#world *')) for (const m of getComputedStyle(el).backgroundImage.matchAll(/url\("?([^")]+)"?\)/g)) if (!m[1].startsWith('data:')) out.add(m[1]); return [...out]; });
  bgs.forEach(u => files.add(u));
  check(`desktop: every canvas and specimen image loads once its garden or specimen is shown (${files.size})`, files.size > 30 && bad.length === 0, bad.join(', '));
  const big = [...files].map(u => ({ u, f: webFile(u) })).map(x => ({ ...x, n: x.f && fs.existsSync(x.f) ? fs.statSync(x.f).size : -1 })).filter(x => x.n < 0 || x.n > 150 * 1024);
  check(`no image the page shows is over 150 KB or missing from web/ (${files.size})`, big.length === 0, JSON.stringify(big.map(x => `${x.u} ${x.n}`)));
  const og = fs.statSync(path.join(ROOT, 'web', 'og.png')).size;
  check(`og.png stays a PNG of ≤ 300 KB (${(og / 1024).toFixed(0)} KB)`, og <= 300 * 1024);
  check('desktop: no errors in the images-shown pass', errors.length === 0, errors.join(' | '));
  await ctx.close();
}
// Production keeps absolute image URLs (grdn.page proxies only /); this machine and the LAN use the page's own /web/.
async function assetBase(browser) {
  const ctx = await browser.newContext(VIEWPORTS.desktop), page = await ctx.newPage();
  await page.goto(BASE, { waitUntil: 'domcontentloaded' });
  const local = await page.evaluate(() => typeof IMG === 'function' ? IMG('x.webp') : '');
  await page.route('https://grdn.page/', r => r.fulfill({ status: 200, contentType: 'text/html', body: fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8') }));
  await page.route(/^https:\/\/grdn-site\.vercel\.app\//, r => r.fulfill({ status: 404, body: '' }));
  await page.goto('https://grdn.page/', { waitUntil: 'domcontentloaded' });
  const prod = await page.evaluate(() => ({ img: IMG('x.webp'), srcs: [...document.querySelectorAll('#world img')].map(i => i.getAttribute('src') || i.dataset.src) }));
  check('on localhost the images come from the page\'s own /web/', local === '/web/x.webp', local);
  check('on production every image URL is absolute https://grdn-site.vercel.app/web/…', prod.img === 'https://grdn-site.vercel.app/web/x.webp' && prod.srcs.length > 20 && prod.srcs.every(s => s.startsWith('https://grdn-site.vercel.app/web/')), JSON.stringify({ img: prod.img, bad: prod.srcs.filter(s => !s.startsWith('https://grdn-site.vercel.app/web/')).slice(0, 3) }));
  await ctx.close();
}
// The fonts never hold back the first paint: no blocking stylesheet in <head>, and with Google Fonts 3 s slow the headline still paints within 1 s.
async function fontsNonBlocking(browser) {
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8'), head = html.split('</head>')[0].replace(/<noscript>[\s\S]*?<\/noscript>/g, '');
  const blocking = [...head.matchAll(/<link\b[^>]*>/g)].map(m => m[0]).filter(l => /\srel=["']?stylesheet/.test(l) && !/media=["']?print/.test(l));
  check('no render-blocking stylesheet in <head> (only the inline CSS blocks)', blocking.length === 0, blocking.join(' | '));
  check('fonts.gstatic.com is preconnected with crossorigin, and the fonts keep display=swap', /<link[^>]+rel=["']?preconnect[^>]+fonts\.gstatic\.com[^>]+crossorigin/.test(head) && /fonts\.googleapis\.com\/css2[^"']*display=swap/.test(head));
  for (const vp of ['phone', 'desktop']) {
    const ctx = await browser.newContext(VIEWPORTS[vp]), page = await ctx.newPage();
    await page.route(/^https:\/\/fonts\.(googleapis|gstatic)\.com\//, async r => { await wait(3000); await r.continue().catch(() => {}); });
    const t0 = Date.now(); await page.goto(BASE, { waitUntil: 'commit' });
    let s = null; while (Date.now() - t0 < 1000) { s = await page.evaluate(() => { const h = document.querySelector('#card h1'); if (!h) return null; const r = h.getBoundingClientRect(); let o = 1; for (let e = h; e; e = e.parentElement) o *= +getComputedStyle(e).opacity;
      return { fcp: performance.getEntriesByType('paint').some(p => p.name === 'first-contentful-paint'), w: r.width, h: r.height, o, font: [...document.fonts].some(f => /Bricolage Grotesque/.test(f.family) && f.status === 'loaded') }; }).catch(() => null);
      if (s && s.fcp && s.w > 0 && s.o >= .99) break; await wait(50); }
    check(`${vp}: with Google Fonts 3 s slow, the headline is painted at full opacity within 1 s, in the fallback font`, !!s && s.fcp && s.w > 0 && s.h > 0 && s.o >= .99 && !s.font, JSON.stringify({ ...s, ms: Date.now() - t0 }));
    await ctx.close();
  }
}
async function loadSpeed(browser) { await assetBase(browser); await fontsNonBlocking(browser); await imageBytes(browser); await imagesShown(browser); }

async function audit(browser) {
  await agentMade(browser);
  await reassureCentred(browser);
  await tapOut(browser);
  await morph(browser);
  await tabletDialog(browser);
  await tabOrder(browser);
  await emailFocus(browser);
  await entrance(browser);
  await widowPass(browser);
  await tapTargets(browser);
  await greyContrast(browser);
  await videosAndWords(browser);
  await sharing(browser);
  await groundAndTransitions(browser);
  await loadSpeed(browser);
}

async function fullPass(browser, vp) {
  const { ctx, page, errors } = await newPage(browser, vp);
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/${vp}-opening.png` });
  await openingCard(page, vp);
  await explore(page);
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/${vp}-canvas.png` });
  await pillClear(page, vp);
  await keptCounts(page, vp);
  await badges(page, vp);
  const specs = await specInfo(page);
  await recipeSources(page, vp);
  check(`${vp}: recipe and savings specimens exist with 3 Where next rows each`, ['recipe', 'savings'].every(k => specs[k] && specs[k].next.length === 3 && specs[k].next.some(n => n.open) && specs[k].next.some(n => n.garden)));
  await everyCardOpens(page, vp, specs);
  await whereNext(page, vp, specs);
  if (specs.recipe && specs.savings) await recipeAndSavings(page, vp);
  await landerCheck(page, vp);
  await streamCheck(page, vp, vp === 'desktop');
  await agentCheck(page, vp);
  await frame(page, vp, specs);
  await keyboard(page, vp, specs);
  if (vp !== 'desktop') await sheet(page, vp, specs);
  await polish(page, vp, specs);
  await imagesLoad(page, vp, specs);
  check(`${vp}: no console or page errors through the full pass`, errors.length === 0, errors.join(' | '));
  await ctx.close();
  return specs;
}

(async () => {
  const browser = await chromium.launch();
  try {
    if (process.env.ONLY === 'polish') { // quick loop while building: only the polish checks
      for (const vp of ['desktop', 'phone']) { const { ctx, page, errors } = await newPage(browser, vp); await explore(page); const specs = await specInfo(page); await polish(page, vp, specs);
        check(`${vp}: no errors in the polish pass`, errors.length === 0, errors.join(' | ')); await ctx.close(); await reducedPolish(browser, vp); await openingPolish(browser, vp); }
      throw 'only';
    }
    if (process.env.ONLY === 'card') { await reassureCentred(browser); await tapOut(browser); await morph(browser); throw 'only'; }
    if (process.env.ONLY === 'pill') { for (let k = 0; k < 3; k++) { const { ctx, page } = await newPage(browser, 'desktop'); await explore(page); await pillClear(page, 'desktop'); await ctx.close(); } throw 'only'; }
    if (process.env.ONLY === 'agentmade') { await agentMade(browser); throw 'only'; }
    if (process.env.ONLY === 'speed') { await loadSpeed(browser); throw 'only'; }
    if (process.env.ONLY === 'audit') { await audit(browser); throw 'only'; }
    if (process.env.ONLY === 'new') { // quick loop while building the stream and agent specimens
      for (const vp of ['desktop', 'phone']) { const { ctx, page, errors } = await newPage(browser, vp); await explore(page); await streamCheck(page, vp, vp === 'desktop' && !process.env.SHORT); if (!process.env.NOAGENT) await agentCheck(page, vp);
        check(`${vp}: no errors in the new pass`, errors.length === 0, errors.join(' | ')); await ctx.close();
        const rm = await newPage(browser, vp, { reducedMotion: 'reduce' }); await explore(rm.page); await reducedMore3(rm.page, vp); check(`${vp}: no errors in the reduced new pass`, rm.errors.length === 0, rm.errors.join(' | ')); await rm.ctx.close(); }
      throw 'only';
    }
    const specs = await fullPass(browser, 'desktop');
    await fullPass(browser, 'phone');
    // small phone: sheet behaviour only
    { const { ctx, page, errors } = await newPage(browser, 'small'); await explore(page); await sheet(page, 'small', specs); await frame(page, 'small', specs);
      check('small: no errors', errors.length === 0, errors.join(' | ')); await ctx.close(); }
    await reducedPolish(browser, 'desktop'); await reducedPolish(browser, 'phone'); await openingPolish(browser, 'desktop'); await openingPolish(browser, 'phone');
    await motion(browser, 'desktop', specs);
    await motion(browser, 'phone', specs);
    await pulse(browser, 'desktop', true);
    await pulse(browser, 'phone', false);
    await audit(browser);
  } catch (e) { if (e !== 'only') { failed++; console.log('FAIL harness crashed :: ' + (e.stack || e)); } }
  await browser.close();
  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
})();
