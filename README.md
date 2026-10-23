# Grdn — prelaunch site and explainer video

**Everything worth a revisit.** The tools and games you make, the links and notes you find, somewhere others can wander in and keep what they love.

- `index.html` — the prelaunch page: an endless, pannable garden of made and found things with a quiet signup card. Scene width and scale adapt to the device; navigation pans without zooming. The signup form does not store anything yet.
- `web/` — preview images for the links in the garden (fetched with `fetch-og.js`).
- `video/` — the explainer video, built as code:
  - `index.html` — the whole animation; `seek(t)` draws any exact moment.
  - `render.js` — headless Chromium frame capture → ffmpeg (4 sub-frames per frame for motion blur). `node render.js preview` for a quick low-res cut.
  - `audio.js` — synthesises the score from the page's sound events.
  - `check.js` — WCAG 2.2 contrast and overlap checks against real rendered pixels.
  - Rendered `.mp4` outputs stay local (gitignored); re-render with `node render.js video`.

Local preview: `python3 -m http.server 8787`, then open http://localhost:8787.

Scene development: read `MOTION.md` for shared animation rules and the minimum review standard. Scripts: `scene-01-colour.md` (Mo's palette), `scene-02-read-next.md` (Lena's curated reading list), and `scene-03-writing.md` (Wen's responsive Fred Rogers Stream). `AGENTS.md` directs future builders to these instructions.

Upcoming concepts: `coming-soon-scenes.md` records two options each for automations, HTML tools/pages, and custom AI sidebar actions, grounded in Primer v2 GitHub issues. These are discussion options, not built features.
