# Scene 02 — Lena's read-next list

Approved concept: Robotics, new this week, in Lena's lab. A mixed reading list appears; Pointy reads it as a whole, prunes irrelevant items, highlights a relevant read-next list, and Lena keeps one item in her garden. This is an observational demonstration, not visitor interaction.

Read `AGENTS.md`, `MOTION.md`, and the consolidated Colour script before implementation. Reuse the shared character and handoffs. Preserve the completed Colour experience.

## Stage and content

Use the existing Robotics garden. Its stage has exactly two panels: Lena's existing garden grid on the left and the reading stream on the right. Put three already-collected items in the garden (a wheel-calibration note, a robot sketch, and a sensor reference), with room for the new kept item. The question appears in a chat/thought bubble associated with Lena's cursor, not a third panel. On narrow screens preserve garden-before-stream reading order with a compact stacked layout if needed. Replace the distracting video-generation workflow in this section with this focused demonstration. Do not add a new garden; navigation is limited to the approved edge cue described below.

Question: “Why does my robot drift?”

Show five illustrative reading topics (not fabricated paper citations):

1. Wheel odometry: where drift begins — relevant; the item Lena will keep.
2. Teaching a robot to fold laundry — unrelated to this question.
3. Calibrating wheel radius and axle width — relevant.
4. A gripper for delicate fruit — unrelated to this question.
5. Correcting drift with visual landmarks — relevant.

Each item shows where Lena encountered it. The wheel-odometry item says “From Karthik’s garden,” the landmarks item says “From Ines’s garden,” and the other items say “From the web.” Keep this source line visible in both the mixed and curated lists, with curation reasons as a separate, quieter cue. The kept garden reference says “Kept from Karthik’s garden.”

Label the panel “Reading stream”; remove “demo”. These remain illustrative topics rather than fabricated freshly fetched arXiv paper citations. No invented authors, dates, citations or external links. The actual scene can be polished without article images. Reading rows should have sufficient visual hierarchy to scan as a list, distinct from garden cards.

The filtered list is titled “Read next”, with concise reasons such as “Start here” and “Then calibrate”. The destination is a garden card with the selected title and a final “Kept in Lena's lab” state. Do not visually delete the original sources from the world: pruning removes irrelevant suggestions from this list.

## Entry and actor ownership

After Wander, all three scenes have directional edge markers available together. Visitors can choose any order or wander into a scene; a completed scene remains linkable when offscreen and does not replay. Hide a marker at 60% stage visibility and re-show it below 50%, regardless of playback state. Clicking pans there at the shared device scale, and manual navigation cancels the requested pan. Above 60% stage visibility and after navigation settles, Pointy gives a brief attention nudge, then joins Lena's ordinary human cursor with the same +24/+24 companion offset and shared handoff. On a deliberate finished revisit, Pointy acknowledges the kept result once and returns without replay. Only one scene owns Pointy at a time; do not interrupt an existing eligible active scene merely because another is partly visible.

Keep Lena's cursor unlabelled and coral, with Pointy adopting that colour, as in Colour. Accompany Lena before acting. Use the shared pause, departure, re-entry and completion rules. It must be possible to discover Robotics before completing Colour. Target bounds must follow canvas pan/wrap.

## Beats (approximately 13–16 seconds; tune for readability)

1. Recognition: show Lena's populated garden and the stream. Pointy joins her cursor and dwells beside it. Lena thinks “Why does my robot drift?” in a chat/thought bubble; hold it long enough to read before Pointy acts.
2. The five-row list resolves into view as one group with a restrained stagger. Lena remains beside her garden with Pointy accompanying her before its departure. Hold long enough to see the mixture.
3. Pointy transfers to the list, turns once, and scans the whole list in one smooth pass. Use one subdued travelling emphasis, not a tap/rotation on every row. This is reading all at once before curation.
4. Prune: two irrelevant rows soften and withdraw; the remaining three close the gaps smoothly. Keep the stage's outer dimensions fixed so the world layout and scene visibility don't jump. Hold the filtered list.
5. Curate: “Read next” resolves; emphasise the first choice and lightly mark another useful follow-up. Show clear hierarchy, not flashing highlights on everything. Pointy rejoins Lena using the shared handoff and dwells at the same companion offset. It no longer parks separately at the stream heading.
6. Human choice: accompanied by Pointy, Lena's cursor approaches the first item, gives a restrained selection beat, then carries a miniature legible reference card showing “Wheel odometry” and “From Karthik’s garden” into the available cell of her left garden grid. The source stays in the read-next list; keeping creates a garden reference. No actual visitor click required or invited.
7. Result: the kept card settles among the existing collected items, retaining its source and “Kept in Lena's lab”. After that has settled, the site's small floating heart appears with “Roma loved it,” then fades. This is an observed social signal, not a visitor control. Hold the result before Pointy returns using the shared handoff. Persist the card and list; do not replay the transient reaction.

## Active-scene frame

Apply a shared border to each active scene's compact stage (Colour and Robotics), using Pointy's current colour. Ease it in on joining and follow Pointy's colour as it changes. Fade it out when ownership is released or the scene completes; no border or layout jump. Use a pointer-transparent outline/overlay so card geometry, visibility thresholds, and navigation are unaffected. A paused scene's frame fades away and eases back on re-entry.

## Engineering and review

Extract a small shared scene lifecycle/ownership layer if necessary instead of cloning the Colour controller. Keep per-scene content and task rendering distinct. Use deterministic active-clock animation, including the carried reference, list layout, and heart/reaction. On departure freeze every intermediate state; on re-entry Pointy rejoins that state before resuming. Finished scenes remain finished.

Respect reduced motion with a completed readable list/card and no flights or animated pruning. Fit the compact stage at approximately 390px without actor/text collisions. Preserve all current intro, Wander and Colour behaviour.

Review the complete sequence in the browser, interruption during pruning and during keeping, resume, scene arbitration, narrow layout, and Colour regression. Syntax/diff checks supplement visual review. Keep changes local. Report any unperformed checks honestly.
