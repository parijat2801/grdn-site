# Scene 01 — Pointy meets Mo

Consolidated approved script, 23 October 2026. Replaces the original draft and its appended revisions. Read `MOTION.md` for the shared character, motion and review rules.

Scope ends after Mo's note and Pointy's palette change. Preserve the existing opening copy and wandering canvas. No new roadmap, arrows, signup backend or additional scenes in this slice.

## Cast and stage

- Visitor: real system cursor, never replaced, hidden or controlled.
- Pointy: one small soft pointed seed, teal beside the visitor and coral while helping Mo. No label.
- Mo: conventional coral human cursor. No label.
- Pointy accompanies either cursor at the same +24px right/down offset, with viewport clamping and gentle lag. Do not invent a different mobile offset.
- Colour remains an existing garden. The note and palette are its compact stage; keep the OKLCH and Silk references. Fit the stage readably on narrow screens.
- Observational demonstration: no palette controls or editable note. Existing unrelated gardens are outside this change.

## Opening and arrival

1. Existing intro card arrives. Once the visitor's cursor is known, Pointy materialises beside it after the opening delay. With touch/no mouse, use the established safe fallback.
2. The seed gathers and resolves, then accompanies the visitor briefly.
3. Wander fills teal in pill geometry matching Reserve yours. Complete the fill before Pointy departs; no layout shift.
4. Use the shared handoff to travel below Wander's centre. Pointy's tip rests about 6px below its lower edge, aimed upward. A restrained curved upward cue repeats with a still interval. Keep the seed inside the card and clear of the button text.
5. The visitor clicks Wander. Early clicks work; Pointy never clicks for them.
6. Dismiss the intro and frame Colour with the existing short camera move. Hold Pointy's actual pose during the move rather than abruptly chasing the visitor.
7. Use the shared handoff to join Mo. Only then start scene time. Navigation can interrupt arrival.

## Active scene timeline

Times reflect the current implementation, not reusable durations for every future scene.

| Seconds | Action |
| --- | --- |
| 0.0–0.6 | Recognise Colour and Mo. Palette begins in muted cool colours. Mo approaches the blank note, titled “For the café”; reserve space for the final text. |
| 0.6–3.8 | Mo types “Warm paper, dark ink, a little terracotta.” Pointy accompanies Mo. Use readable typing with punctuation pauses and a small caret. |
| 3.8–4.35 | Hold the complete request; remove the caret. |
| 4.35–5.6 | Pointy leaves Mo and travels to the first swatch using the shared handoff. |
| 5.6–5.85 | Turn downward once and lower the seed's tip into the palette. |
| 5.85–7.85 | One continuous eased slide across all five swatch centres. Each colour starts changing as Pointy crosses its centre. No individual dips, stops or repeated turns. |
| 7.85–8.1 | Lift from the last swatch and turn upright once. |
| 8.1–9.3 | Hold the result. Mo moves near the palette to inspect it. |
| 9.3–10.25 | Shared handoff returns Pointy to the visitor, smoothly tracking the visitor's current position. |
| after 10.25 | Final note and palette persist. Pointy accompanies the visitor. No automatic replay. |

On phones, the current mobile rule in `MOTION.md` supersedes the visitor-return part of this desktop timeline: Pointy materialises beside Mo on entry and fades within the scene after the result, rather than travelling to an invisible visitor cursor.

Final palette: paper `#F3EBDD`, sand `#D8C3A5`, terracotta `#C46B4E`, sage `#8C9B82`, ink `#263B42`.

## Interruption and completion

Follow the playback contract in `MOTION.md`: detach below 50% stage visibility; resume above 60% after navigation settles. Small mouse movements do not interrupt. Pause the active clock and preserve intermediate text/colours. Pointy returns using the shared handoff and rejoins the frozen task before resuming. Hide/pause appropriately when the browser tab is hidden or the intro is reopened. Targets remain attached to current DOM bounds through canvas wrapping and resize.

Reduced motion uses a stationary Wander cue and the completed scene after activation. Actors are decorative and do not intercept input or announce every character. Completion persists for the page load.

## Review

Use the minimum-quality review in `MOTION.md`, including early Wander activation, departure/join continuity, continuous palette sweep, mid-task exit and resume, completed revisits, narrow layout and reduced motion. Report what was actually inspected. Preview locally at http://127.0.0.1:8787 when the existing server is running; do not publish as part of scene review.
