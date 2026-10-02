// Soundtrack v2 — Floydian score + jungle stream. Original music; nothing sampled.
// sfx.json → soundtrack.wav (48 kHz, 16-bit stereo).
// Bed: slow E-minor progression on detuned analog-style pads through a sweeping low-pass.
// Heartbeat under the opening. A sparse lead synth (bends, vibrato, ping-pong echo) in three
// phrases. Nature arrives with the seed: a babbling stream, insects, birds; leaf rustles on
// camera moves. Pops are tuned to E minor pentatonic and fed to the echo.
const fs = require('fs');
const { duration, events, marks } = JSON.parse(fs.readFileSync(__dirname + '/sfx.json', 'utf8'));
const SR = 48000, N = Math.ceil((duration + 2) * SR), TAU = 2 * Math.PI;
const mk = () => new Float32Array(N);
const padL = mk(), padR = mk(), dryL = mk(), dryR = mk(), dlyL = mk(), dlyR = mk(), rev = mk();
const midi = m => 440 * Math.pow(2, (m - 69) / 12);
let rs = 3; const rnd = () => (rs = (rs * 16807) % 2147483647) / 2147483647;
const at = (b, i, v) => { if (i >= 0 && i < N) b[i] += v; };
const NAT = marks.nature, NAT_OUT = marks.natureOut;
const natureGain = t => Math.min(1, Math.max(0, (t - NAT) / 3)) * (1 - Math.min(1, Math.max(0, (t - NAT_OUT) / 3)) * .6);

// ---------- pads: Em9 → Cmaj7 → G6 → D/F#
const chords = [[40, 47, 50, 54, 55], [36, 43, 47, 52, 55], [43, 50, 52, 59, 62], [42, 50, 52, 57, 62]];
const CH = 9.9;
for (let c = 0; c * CH < duration + 2; c++) {
  const notes = chords[c % 4], t0 = c * CH - 2, len = CH + 5;
  notes.forEach((m, ni) => {
    const f = midi(m + 12), pan = (ni / 4) * .8 - .4, gain = .032 / (1 + ni * .2);
    for (const det of [-.0045, .0045]) {
      const fr = f * (1 + det), ph = rnd() * TAU, sp = det > 0 ? 1 : -1;
      for (let k = 0; k < len * SR; k++) {
        const i = Math.floor(t0 * SR) + k; if (i < 0 || i >= N) continue;
        const t = k / SR, env = Math.min(1, t / 3.5) * Math.min(1, (len - t) / 4);
        let v = 0; for (let h = 1; h <= 9; h++) v += Math.sin(TAU * fr * h * t + ph * h) / h; // saw-ish
        v *= env * gain; padL[i] += v * (1 - pan * sp); padR[i] += v * (1 + pan * sp);
      }
    }
  });
  const f = midi(notes[0]); // sub root
  for (let k = 0; k < len * SR; k++) { const i = Math.floor(t0 * SR) + k; if (i < 0 || i >= N) continue; const t = k / SR;
    const v = Math.sin(TAU * f * t) * Math.min(1, t / 4) * Math.min(1, (len - t) / 4) * .09; dryL[i] += v; dryR[i] += v; }
}
// sweeping resonant low-pass on the pad bus (cutoff breathes 350 ↔ 2200 Hz)
function lowpassSweep(buf) {
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  for (let i = 0; i < N; i++) { const t = i / SR;
    const fc = 350 + 1850 * (.5 - .5 * Math.cos(TAU * t / 19)) * Math.min(1, .35 + t / 25), q = 1.6;
    const w = TAU * fc / SR, al = Math.sin(w) / (2 * q), cw = Math.cos(w), a0 = 1 + al;
    const b0 = (1 - cw) / 2, b1 = 1 - cw, b2 = (1 - cw) / 2, a1 = -2 * cw, a2 = 1 - al;
    const x = buf[i], y = (b0 * x + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2) / a0; x2 = x1; x1 = x; y2 = y1; y1 = y; buf[i] = y; }
}
lowpassSweep(padL); lowpassSweep(padR);
for (let i = 0; i < N; i++) { dryL[i] += padL[i]; dryR[i] += padR[i]; rev[i] += (padL[i] + padR[i]) * .45; }

// ---------- heartbeat under the opening
for (let b = 0; b < 6; b++) for (const [off, g] of [[0, 1], [.27, .7]]) {
  const i0 = Math.floor((.35 + b * 1.0 + off) * SR), fade = 1 - b / 7;
  for (let k = 0; k < .25 * SR; k++) { const x = k / SR, f = 48 + 30 * Math.exp(-x * 30);
    const v = Math.sin(TAU * f * x) * Math.exp(-x * 16) * (1 - Math.exp(-x * 400)) * .5 * g * fade; at(dryL, i0 + k, v); at(dryR, i0 + k, v); }
}

// ---------- lead synth phrases (original), E minor pentatonic: [midi, seconds, bend-from]
const phrases = [
  [marks.phrases[0], [[71, 1.8, 69], [69, .7], [67, .7], [64, 2.6]]],
  [marks.phrases[1], [[74, 1.6, 71], [71, .8], [69, .8], [71, 2.8]]],
  [marks.phrases[2], [[67, .9], [69, .9], [71, 1.4, 69], [76, 3.6, 74]]],
];
for (const [start, notes] of phrases) { let t = start;
  for (const [m, d, from] of notes) { const f1 = midi(m), f0 = from ? midi(from) : f1, i0 = Math.floor(t * SR); let ph = 0;
    for (let k = 0; k < (d + 1.2) * SR; k++) { const x = k / SR;
      const bend = from ? Math.min(1, x / .32) : 1, vibD = Math.min(1, Math.max(0, (x - .35) / .6)) * .012;
      const f = (f0 + (f1 - f0) * (1 - Math.pow(1 - bend, 2))) * (1 + vibD * Math.sin(TAU * 5.3 * x)); ph += TAU * f / SR;
      const env = Math.min(1, x / .06) * (x < d ? 1 : Math.exp(-(x - d) * 5));
      let v = Math.sin(ph) + .35 * Math.sin(2 * ph) + .15 * Math.sin(3 * ph); v = Math.tanh(v * 1.4) * env * .2;
      at(dryL, i0 + k, v * .8); at(dryR, i0 + k, v * .8); at(dlyL, i0 + k, v * .6); at(rev, i0 + k, v * .7); }
    t += d; } }

// ---------- nature: stream bubbles, water body, insects, birds
for (let t = NAT; t < duration; t += .012 + rnd() * .05) {
  const g = natureGain(t) * (.4 + rnd() * .6) * .03; if (g <= 0) continue;
  const f0 = 500 + Math.pow(rnd(), 1.6) * 2600, d = .015 + rnd() * .05, i0 = Math.floor(t * SR), pan = (rnd() - .5) * 1.2; let ph = 0;
  for (let k = 0; k < d * SR; k++) { const x = k / SR, f = f0 * (1 + 1.4 * x / d); ph += TAU * f / SR;
    const v = Math.sin(ph) * Math.sin(Math.PI * Math.min(1, x / d)) * Math.exp(-x / d * 2) * g; at(dryL, i0 + k, v * (1 - pan)); at(dryR, i0 + k, v * (1 + pan)); at(rev, i0 + k, v * .3); }
}
{ let b1 = 0, b2 = 0; for (let i = 0; i < N; i++) { const t = i / SR, g = natureGain(t) * .025;
  const n = rnd() * 2 - 1; b1 += (n - b1) * .12; b2 += (b1 - b2) * .05; const v = (b1 - b2) * g * 1.2; dryL[i] += v; dryR[i] += v * .9; } }
{ let y1 = 0, y2 = 0, x1 = 0, x2 = 0; // cicadas: band-passed noise, pulsed, slow swells
  for (let i = 0; i < N; i++) { const t = i / SR, g = natureGain(t) * .012 * (.55 + .45 * Math.sin(TAU * t / 11 + 1));
    const w = TAU * 5200 / SR, al = Math.sin(w) / 6, a0 = 1 + al, xn = rnd() * 2 - 1;
    const y = (al * xn - al * x2 + 2 * Math.cos(w) * y1 - (1 - al) * y2) / a0; x2 = x1; x1 = xn; y2 = y1; y1 = y;
    const v = y * (.5 + .5 * Math.sin(TAU * 42 * t)) * g * 1.6; dryL[i] += v * .7; dryR[i] += v * 1.2; } }
function bird(t, pan) { const n = 2 + Math.floor(rnd() * 4), base = 2200 + rnd() * 1800, up = rnd() < .5; let tt = t;
  for (let j = 0; j < n; j++) { const d = .07 + rnd() * .12, i0 = Math.floor(tt * SR), f0 = base * (1 + (rnd() - .5) * .25); let ph = 0;
    for (let k = 0; k < d * SR; k++) { const x = k / SR, p = x / d, f = f0 * (up ? 1 + .45 * p : 1.4 - .45 * p) * (1 + .03 * Math.sin(TAU * 38 * x)); ph += TAU * f / SR;
      const v = Math.sin(ph) * Math.sin(Math.PI * p) * .045 * natureGain(tt); at(dryL, i0 + k, v * (1 - pan)); at(dryR, i0 + k, v * (1 + pan)); at(rev, i0 + k, v * .6); }
    tt += d + .03 + rnd() * .08; } }
for (let t = NAT + 2.7; t < duration - 3; t += 3.2 + rnd() * 5) bird(t, (rnd() - .5) * 1.4);

// ---------- event voices
function pop(t, idx, gain = .22, oct = 1) {
  const pent = [0, 3, 5, 7, 10], root = 64 + (oct - 1) * 12;
  const m = root + pent[idx % 5] + 12 * Math.floor((idx % 10) / 5), f = midi(m), i0 = Math.floor(t * SR), pan = (rnd() - .5) * .6;
  for (let k = 0; k < .5 * SR; k++) { const x = k / SR, fr = f * (1 + .3 * Math.exp(-x * 80)), env = (1 - Math.exp(-x * 900)) * Math.exp(-x * 9);
    const v = (Math.sin(TAU * fr * x) + .2 * Math.sin(2 * TAU * fr * x)) * env * gain;
    at(dryL, i0 + k, v * (1 - pan)); at(dryR, i0 + k, v * (1 + pan)); at(dlyR, i0 + k, v * .5); at(rev, i0 + k, v * .4); } }
function tick(t, gain = .07) { const i0 = Math.floor(t * SR);
  for (let k = 0; k < .05 * SR; k++) { const x = k / SR, env = Math.exp(-x * 140); const v = ((rnd() * 2 - 1) * .4 + Math.sin(TAU * 3100 * x) * .6) * env * gain; at(dryL, i0 + k, v); at(dryR, i0 + k, v); at(rev, i0 + k, v * .3); } }
function rustle(t, dur, gain) { const i0 = Math.floor(t * SR); let lp = 0, lp2 = 0;
  for (let k = 0; k < dur * SR; k++) { const x = k / SR, p = x / dur, env = Math.pow(Math.sin(Math.PI * p), 1.5);
    const crackle = rnd() < .004 ? (rnd() * 2 - 1) * 2 : 0, n = rnd() * 2 - 1; lp += (lp * 0) + (n - lp) * .08;
    lp2 += ((n - lp) * .6 + crackle - lp2) * .45; const v = lp2 * env * gain, pan = Math.sin(Math.PI * p * 2) * .5; at(dryL, i0 + k, v * (1 - pan)); at(dryR, i0 + k, v * (1 + pan)); at(rev, i0 + k, v * .4); } }
function thud(t) { const i0 = Math.floor(t * SR);
  for (let k = 0; k < .6 * SR; k++) { const x = k / SR, f = 60 + 70 * Math.exp(-x * 18), v = Math.sin(TAU * f * x) * Math.exp(-x * 8) * .2; at(dryL, i0 + k, v); at(dryR, i0 + k, v); at(rev, i0 + k, v * .3); } }
function bell(t, m, gain) { const i0 = Math.floor(t * SR), f = midi(m), parts = [[1, 1, 2.6], [2, .4, 1.6], [2.76, .28, 1.1], [5.4, .12, .5]];
  for (let k = 0; k < 4 * SR; k++) { const x = k / SR; let v = 0; for (const [r, a, d] of parts) v += a * Math.sin(TAU * f * r * x) * Math.exp(-x / d * 2);
    v *= (1 - Math.exp(-x * 600)) * gain; at(dryL, i0 + k, v); at(dryR, i0 + k, v); at(dlyL, i0 + k, v * .5); at(rev, i0 + k, v * .8); } }

for (const e of events) {
  switch (e.type) {
    case 'pop': pop(e.t, e.i); break;
    case 'heart': pop(e.t, (e.i * 3) % 10, .07, 2); break;
    case 'tick': tick(e.t); break;
    case 'click': tick(e.t, .1); tick(e.t + .045, .07); break;
    case 'whoosh': if (e.t > NAT) rustle(e.t, 1.0, .035); break;
    case 'whooshL': rustle(e.t, 1.9, .04); break;
    case 'thud': thud(e.t); break;
    case 'chime': [76, 79, 83, 88].forEach((m, i) => bell(e.t + i * .16, m, .07)); break;
    // 'rise' and 'swell' are carried by the stream and the heartbeat now
  }
}

// ---------- ping-pong echo (~0.64 s), then a long hall reverb
{ const d = Math.round(.64 * SR), fb = .48; const L = new Float32Array(d), R = new Float32Array(d); let j = 0, lp = 0;
  for (let i = 0; i < N; i++) { const oL = L[j], oR = R[j]; lp = lp * .3 + oR * .7;
    L[j] = dlyL[i] + lp * fb; R[j] = dlyR[i] + oL * fb; dryL[i] += oL * .55; dryR[i] += oR * .55; rev[i] += (oL + oR) * .25; j = (j + 1) % d; } }
function reverb(input, combs, aps) { const out = new Float32Array(N);
  for (const [d, fb] of combs) { const buf = new Float32Array(d); let idx = 0, lp = 0;
    for (let i = 0; i < N; i++) { const y = buf[idx]; lp = y * .6 + lp * .4; buf[idx] = input[i] + lp * fb; out[i] += y; idx = (idx + 1) % d; } }
  for (const d of aps) { const buf = new Float32Array(d); let idx = 0;
    for (let i = 0; i < N; i++) { const b = buf[idx], y = -out[i] + b; buf[idx] = out[i] + b * .5; out[i] = y; idx = (idx + 1) % d; } }
  return out; }
const s = SR / 44100;
const wetL = reverb(rev, [1557, 1617, 1491, 1422].map(d => [Math.round(d * s * 1.9), .9]), [225, 556].map(d => Math.round(d * s)));
const wetR = reverb(rev, [1583, 1643, 1517, 1448].map(d => [Math.round(d * s * 1.9), .9]), [241, 572].map(d => Math.round(d * s)));

// ---------- mix, fade, write
const OL = mk(), OR = mk(); let peak = 0;
for (let i = 0; i < N; i++) { const t = i / SR, fade = Math.min(1, t / .3) * Math.min(1, Math.max(0, (duration - t) / 3));
  OL[i] = (dryL[i] + wetL[i] * .06) * fade; OR[i] = (dryR[i] + wetR[i] * .06) * fade; peak = Math.max(peak, Math.abs(OL[i]), Math.abs(OR[i])); }
const g = .89 / peak, buf = Buffer.alloc(44 + N * 4);
buf.write('RIFF', 0); buf.writeUInt32LE(36 + N * 4, 4); buf.write('WAVE', 8); buf.write('fmt ', 12); buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(2, 22);
buf.writeUInt32LE(SR, 24); buf.writeUInt32LE(SR * 4, 28); buf.writeUInt16LE(4, 32); buf.writeUInt16LE(16, 34); buf.write('data', 36); buf.writeUInt32LE(N * 4, 40);
for (let i = 0; i < N; i++) { buf.writeInt16LE(Math.round(Math.max(-1, Math.min(1, OL[i] * g)) * 32767), 44 + i * 4); buf.writeInt16LE(Math.round(Math.max(-1, Math.min(1, OR[i] * g)) * 32767), 46 + i * 4); }
fs.writeFileSync(__dirname + '/soundtrack.wav', buf);
console.log('wrote soundtrack.wav', (N / SR).toFixed(1) + 's', 'gain', g.toFixed(2));
