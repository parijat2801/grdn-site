# Grdn scene motion rules

Derived from the owner's review of the Colour scene, 23 October 2026. These are the baseline for subsequent scenes. The implementation reference is `index.html`; the scene-specific script is `scene-01-colour.md`. These rules do not authorize building additional scenes.

## What a scene must communicate

Visitors watch someone using their garden. Each scene demonstrates one understandable action with a visible result. Pointy accompanies the visitor, joins that person's cursor, helps with a task, then returns. The visitor remains free to wander; scenes are not a forced slideshow.

Before implementation, specify the human's intent, entry trigger, Pointy's role, ordered beats, visible result, finish, and interruption/resume behaviour. Distinguish launch capabilities from future concepts. Do not imply a mock demonstration is live functionality.

## Reuse behaviour, vary the task

| Shared behaviour | Existing implementation reference | Rule |
| --- | --- | --- |
| Character drawing | Pointy SVG and `actor` | One seed, one identity, no duplicate helpers. |
| Companion placement | `companionPoint`, `hostPoint`, `visitorPoint` | Same +24px right/down offset and viewport clamp beside every human cursor. Preserve gentle lag. |
| Departure and arrival | `handoff`, `landPoint`, `blendPose` | Use the same motion for every transfer, including interruptions and re-entry. |
| Following | `chasePoint`, `visitorFollowPose` | Follow with lag and eased orientation; do not teleport to moving targets. |
| Scene playback | `sceneFrame`, `scenePause`, `sceneVisibility` | Preserve the state/clock contract below when adding scenes. |

These names describe today's code, not a requirement to keep a single-scene architecture forever. Extract shared code when the next scene needs it; do not copy and fork the first scene's controller or introduce a new framework just for one scene. Keep scene targets, content and task beats separate from shared character behaviour. A shared motion fix must apply across every call site, not just the first appearance.

## Character and visual consistency

- Pointy is a soft pointed seed: rounded body, one directional tip, no human-arrow stem or notch. Human cursors remain conventional arrows. No labels on any cursors.
- Pointy is teal with the visitor and adopts the host's colour while helping. Shape must distinguish the characters even when their colours match.
- Accompany the host before and after task work. Once the task is done, rejoin their cursor using the shared handoff and dwell at the shared companion offset; do not park Pointy at an unrelated scene anchor.
- Frame the active scene with a restrained border in Pointy's current colour. Ease the frame in on joining and fade it out on completion or departure. It must not change layout, intercept input or leave completed scenes permanently outlined.
- Materialisation has a readable beginning: colour gathers, the seed resolves and settles beside the actual visitor cursor. Do not simply switch opacity on at an arbitrary location. Use a deliberate fallback when no mouse position exists.
- Keep the system cursor visible and untouched. Decorative actors do not intercept input and are hidden from assistive technology.
- Use the site's paper, ink, teal/coral, typography and scale. Keep actors and effects clear of meaningful text, controls and viewport edges. Adjust staging rather than changing the companion offset on mobile.

## One motion language for every handoff

Every transfer has readable intent, travel and arrival: turn toward the destination and gather with a small pullback; accelerate into a curved path; decelerate and settle with restrained elasticity. The destination orientation and host colour resolve as part of arrival.

Use this for leaving the visitor, joining a host, leaving the host to work, returning to the visitor, and resuming a paused task. Start from the actual rendered position and pose. Preserve position, orientation, scale and colour through interruption. Never snap back to an earlier anchor. Resolve targets from current DOM bounds so pan, resize and canvas wrapping remain aligned.

The current reference reserves about 32% of a handoff for anticipation (roughly 0.25–0.40 seconds in the existing transfers), with a 3.5px pullback and small settling motion. These are tuning references, not universal durations. Preserve the perceived rhythm across distances. If a short transfer makes anticipation unreadable, give it more time.

Do not let camera motion compete with character intent. The current Wander reveal holds Pointy's pose during the camera move, then hands it to Mo. It must not abruptly chase the visitor in between.

## Choreography and restraint

- Stage the destination before directing attention to it. Wander fills into its teal pill before Pointy departs; its dimensions stay fixed during activation.
- Give the viewer time to recognise the host, read the request and see the finished result. One primary action at a time; avoid background emphasis competing with it.
- A visible action causes a visible change. Synchronise the result to actual progress/contact, rather than an unrelated timer.
- Repeated work should read as one coherent gesture. In Colour, turn down once, sweep across all swatches, then turn upright. Do not rotate, dip, bounce and restart at every item.
- A cue may repeat quietly while waiting for visitor input: Pointy sits below Wander and loops upward with rests. Finished task demonstrations do not loop automatically.
- After Wander, all available scene markers are discoverable together: Colour, Read next, and Writing. Directional edge markers track the nearest wrapped copy of each destination, stay quiet after a restrained entrance, and hide individually while their scene is sufficiently in view. Completed scenes remain available from offscreen for revisiting without replay. Markers need clear contrast, keyboard access, at least 44px targets, and spacing from each other, the signup CTA, and meaningful scene content. Clicking pans smoothly at the fixed device scale; manual navigation cancels the pan. Never force a sequence or pulse the signup CTA for this action. Keep Pointy’s name internal to scripts and code, not visitor-facing copy or accessibility labels.
- Keep scene stages the same width at each breakpoint. Choose one canvas scale from device width so the stage and its outer frame have comfortable horizontal margins (24px each side). Wander and scene navigation pan at that scale; they do not zoom between scenes. Recompute the shared scale on viewport-width changes and refit an intentionally framed scene. Browsing elsewhere keeps the same world centre. Touch pinch zoom is disabled for now.
- Ordinary page clicks may subtly cue the visible Reserve yours button, but clicks inside an interactive garden card belong to that card; observational scene cards can still cue the button.
- Apply anticipation, staging, slow-in/slow-out, arcs, follow-through, restrained squash/stretch and clear timing where they improve readability. These principles are tools, not a checklist of effects to add. Glow and elasticity cannot compensate for unclear intent or a poor path.

## Playback contract

- New scenes are observational. No editing, hover games, replay buttons or extra controls unless requested. Navigation remains available.
- Use one pausable active clock per scene for its task animation. Derive typing, colours and actor poses from that clock; avoid independent timer chains continuing offscreen.
- Start the task after Pointy has joined. Small mouse movements or pans do not detach it.
- Detach when less than 50% of the compact scene stage remains visible. Rejoin above 60%, after navigation settles for roughly 350ms. Use hysteresis to avoid boundary flicker.
- Freeze intermediate content on departure; Pointy returns to the visitor. On re-entry it rejoins the frozen action before the clock resumes. Never restart or skip unfinished work.
- Pause when the document is hidden or the intro is reopened. Preserve the result after completion; revisiting does not replay it. Future scenes must coordinate ownership of the single Pointy.
- Reduced motion shows a stationary cue and completed content without flights or typewriter effects. Touch has an intentional companion fallback. Do not announce every typed character.

## Minimum quality before returning work

Watch the animation at normal speed in the browser and compare it with the existing site. Review the whole sequence, not just a captured pose. Fix visible defects before reporting completion.

Check the new scene's entry, task, result and exit; also check the shared motions it changes. Exercise early clicks, moving visitor targets, small movements that must not detach, leaving mid-task, returning, and repeated boundary crossings. Confirm completed scenes remain completed. Review a narrow viewport (about 390px), text clearance, and reduced-motion behaviour. Report any check that could not actually be performed.

Reject the result if any of these remain:

- abrupt appearance, unexplained departure, teleport, sharp orientation change, or visibly different handoff rhythm;
- repeated jitter or unnecessary turns during one continuous task;
- animation that obscures content or changes layout when a cue activates;
- result changes before the actor reaches it, or content keeps progressing while paused;
- unclear distinction between human cursor and Pointy;
- a new scene that looks less considered than the existing canvas.

Run JavaScript syntax and diff checks after code changes. They verify code hygiene, not motion quality. Screenshots support composition review; they cannot prove pacing or smoothness. State what was implemented and what was inspected without calling a static screenshot an animation test.
