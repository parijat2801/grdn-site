// node render.js stills 3,10     → stills/t-3.png …
// node render.js sfx             → sfx.json (sound events)
// node render.js video [sub=4]   → video-silent.mp4 (motion blur: sub-frames averaged)
const { chromium } = require('/Users/parijat/dev/primer-v2/node_modules/@playwright/test');
const { spawn } = require('child_process');
const fs = require('fs'), path = require('path');
const FPS = 30, url = 'file://' + path.join(__dirname, 'index.html');
(async () => {
  const [mode, arg] = process.argv.slice(2);
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  page.on('pageerror', e => { console.error('PAGE ERROR', e.message); process.exitCode = 1; });
  await page.goto(url); await page.evaluate(() => document.fonts.ready); await page.waitForTimeout(500);
  if (mode === 'stills') {
    fs.mkdirSync(path.join(__dirname, 'stills'), { recursive: true });
    for (const t of arg.split(',').map(Number)) { await page.evaluate(t => window.seek(t), t); await page.screenshot({ path: path.join(__dirname, 'stills', `t-${t}.png`) }); }
  } else if (mode === 'sfx') {
    fs.writeFileSync(path.join(__dirname, 'sfx.json'), JSON.stringify(await page.evaluate(() => ({ duration: window.DURATION, events: window.SFX }))));
  } else {
    const preview = mode === 'preview';
    const SUB = preview ? 1 : +(arg || 4), SHUTTER = .5; // 180° shutter
    const duration = await page.evaluate(() => window.DURATION), frames = Math.round(duration * FPS);
    const out = path.join(__dirname, preview ? 'preview-silent.mp4' : 'video-silent.mp4');
    const vf = `tmix=frames=${SUB},select='eq(mod(n\\,${SUB})\\,${SUB - 1})',setpts=N/(${FPS}*TB)`;
    const vfx = preview ? 'scale=640:-2' : vf;
    const ff = spawn('ffmpeg', ['-y', '-f', 'image2pipe', '-framerate', String(FPS * SUB), '-c:v', 'mjpeg', '-i', '-', '-vf', vfx, '-r', String(FPS),
      '-c:v', 'libx264', '-preset', 'slow', '-crf', preview ? '30' : '17', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', out], { stdio: ['pipe', 'ignore', 'inherit'] });
    const t0 = Date.now();
    for (let f = 0; f < frames; f++) for (let k = 0; k < SUB; k++) {
      await page.evaluate(t => window.seek(t), f / FPS + (k / SUB) * SHUTTER / FPS);
      const buf = await page.screenshot({ type: 'jpeg', quality: 94 });
      if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r));
      if (k === 0 && f % 300 === 0) console.log(`frame ${f}/${frames}  ${((Date.now() - t0) / 1000).toFixed(0)}s`);
    }
    ff.stdin.end(); await new Promise((res, rej) => ff.on('close', c => c === 0 ? res() : rej(new Error('ffmpeg exit ' + c))));
    console.log('wrote', out);
  }
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
