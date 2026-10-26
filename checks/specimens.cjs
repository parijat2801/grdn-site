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
const wander = async page => { await page.click('#wander'); await wait(700); };
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
    return { h1: t('#card h1'), lede: t('#card .lede'), btn: t('#f button'), email: !!document.querySelector('#f input[type=email][required]'), reassure: t('#reassure'), wander: t('#wander'), ledeVisible: visible('#card .lede') };
  });
  check(`${vp}: headline unchanged`, c.h1 === 'Everything worth a revisit.', c.h1);
  const words = c.lede.split(/\s+/).filter(Boolean).length;
  check(`${vp}: definition line says keep, visit, makes (${words} words)`, c.ledeVisible && words <= 18 && /garden/i.test(c.lede) && /visit/i.test(c.lede) && /\bmakes?\b/i.test(c.lede) && /web/i.test(c.lede), c.lede);
  check(`${vp}: form unchanged`, c.email && c.btn === 'Reserve your grdn', c.btn);
  check(`${vp}: reassure line unchanged`, c.reassure === 'We’ll email you once, when your garden is ready.', c.reassure);
  check(`${vp}: Wander unchanged`, c.wander === 'Wander', c.wander);
}

async function everyCardOpens(page, vp, specs) {
  for (const [id, s] of Object.entries(specs)) {
    const o = await openViaCard(page, id, s);
    if (!o.ok) { check(`${vp}: card ${id} opens on click`, false, o.why); continue; }
    const v = await page.evaluate(() => ({ title: document.getElementById('spec-title').textContent, made: document.getElementById('spec-made').textContent, chips: document.querySelectorAll('#spec-made .chip').length }));
    check(`${vp}: card ${id} opens on click, title "${s.title}"`, v.title === s.title, v.title);
    check(`${vp}: ${id} made line names ${s.owner} with ${s.from.length} chips`, v.made.includes(s.owner) && v.made.includes(`from ${s.from.length} things`) && v.chips === s.from.length, `${v.made} / ${v.chips}`);
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
  await wander(page);
  await page.evaluate(g => goGarden(g), specs.titan.garden); await wait(900);
  const b = await page.locator('[data-spec="titan"]').boundingBox();
  await page.mouse.click(b.x + b.width / 2, b.y + b.height / 2);
  const f = await page.evaluate(() => { const p = document.querySelector('#spec .panel'); return p.getAnimations().some(a => { const k = a.effect.getKeyframes(); return k.length && k[0].transform && k[0].transform !== 'none'; }); });
  check(`${vp}: opening grows the view from the card (FLIP)`, f);
  await wait(500);
  await page.keyboard.press('Escape');
  const r = await page.evaluate(() => { const p = document.querySelector('#spec .panel'); return p.getAnimations().some(a => { const k = a.effect.getKeyframes(); return k.length && k[k.length - 1].transform && k[k.length - 1].transform !== 'none'; }); });
  check(`${vp}: closing shrinks the view back to the card`, r);
  await wait(500);
  check(`${vp}: closed after the reverse motion`, !(await isOpen(page)));
  check(`${vp}: no errors in the motion pass`, errors.length === 0, errors.join(' | '));
  await ctx.close();

  const rm = await newPage(browser, vp, { reducedMotion: 'reduce' });
  await wander(rm.page);
  await rm.page.evaluate(g => goGarden(g), specs.titan.garden); await wait(900);
  const b2 = await rm.page.locator('[data-spec="titan"]').boundingBox();
  await rm.page.mouse.click(b2.x + b2.width / 2, b2.y + b2.height / 2);
  const s = await rm.page.evaluate(() => { const p = document.querySelector('#spec .panel'); return { open: !document.getElementById('spec').hidden, anims: p.getAnimations().length, tf: getComputedStyle(p).transform }; });
  check(`${vp}: reduced motion opens instantly, no FLIP`, s.open && s.anims === 0 && s.tf === 'none', JSON.stringify(s));
  await rm.page.keyboard.press('Escape');
  check(`${vp}: reduced motion closes instantly`, !(await isOpen(rm.page)));
  await rm.ctx.close();
}

async function pulse(browser, vp, long) {
  const { ctx, page, errors } = await newPage(browser, vp);
  await wander(page);
  await wait(3300);
  const p1 = await page.evaluate(() => ({ n: +(document.body.dataset.pulses || 0), id: document.body.dataset.pulsed || '' }));
  const vis = p1.id && await page.evaluate(id => { const b = document.querySelector(`[data-spec="${id}"]`).getBoundingClientRect(); return b.left >= 0 && b.top >= 0 && b.right <= innerWidth && b.bottom <= innerHeight; }, p1.id);
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

async function fullPass(browser, vp) {
  const { ctx, page, errors } = await newPage(browser, vp);
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/${vp}-opening.png` });
  await openingCard(page, vp);
  await wander(page);
  const specs = await specInfo(page);
  check(`${vp}: recipe and savings specimens exist with 3 Where next rows each`, ['recipe', 'savings'].every(k => specs[k] && specs[k].next.length === 3 && specs[k].next.some(n => n.open) && specs[k].next.some(n => n.garden)));
  await everyCardOpens(page, vp, specs);
  await whereNext(page, vp, specs);
  if (specs.recipe && specs.savings) await recipeAndSavings(page, vp);
  await landerCheck(page, vp);
  await keyboard(page, vp, specs);
  if (vp !== 'desktop') await sheet(page, vp, specs);
  const broken = await page.evaluate(() => [...document.images].filter(i => i.complete && i.naturalWidth === 0).map(i => i.src));
  check(`${vp}: all images load`, broken.length === 0, broken.join(', '));
  check(`${vp}: no console or page errors through the full pass`, errors.length === 0, errors.join(' | '));
  await ctx.close();
  return specs;
}

(async () => {
  const browser = await chromium.launch();
  try {
    const specs = await fullPass(browser, 'desktop');
    await fullPass(browser, 'phone');
    // small phone: sheet behaviour only
    { const { ctx, page, errors } = await newPage(browser, 'small'); await wander(page); await sheet(page, 'small', specs);
      check('small: no errors', errors.length === 0, errors.join(' | ')); await ctx.close(); }
    await motion(browser, 'desktop', specs);
    await motion(browser, 'phone', specs);
    await pulse(browser, 'desktop', true);
    await pulse(browser, 'phone', false);
  } catch (e) { failed++; console.log('FAIL harness crashed :: ' + (e.stack || e)); }
  await browser.close();
  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
})();
