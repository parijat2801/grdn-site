# Handoff: grdn.page specimens (2026-10-26)

Read this first. It says where the landing page work stands, what the owner has decided, and what to do next. The animated-scenes work that came before it has been abandoned; see "Why we changed direction" before proposing anything like it again.

## Where things are

- **Branch and worktree:** `feature/grdn-specimens` in `~/dev/grdn-specimens`. Local only and not pushed. It was started from `main` (4473aa0), the static canvas from before any scenes.
- **Local hosting:** python http.server on port 8850, bound to 0.0.0.0. Open http://localhost:8850/ on the laptop. On the phone, use the Mac's LAN address: it was 192.168.68.100 on 2026-10-26 and has changed before (`ipconfig getifaddr en0`).
- **The page:** one file, `index.html`. Design tokens sit in a single `:root` block at the top. Gardens are data (`G`). The canvas pans, wraps endlessly and drifts until touched. The opening card holds the waitlist form, "Reserve your grdn" and Wander.
- **Commits on the branch:**
  - 96b4c53, 1e00a64: cherry-picked no-store headers (`vercel.json`), needed for grdn.page.
  - 4dccdad: static base. Signups post to the app's `/api/waitlist`, images load from `https://grdn-site.vercel.app/web/…`, the approved opening copy is in, and the design tokens are in.
  - 6dbdce2: the specimens prototype, with five specimens. The owner reviewed it and said: "looks good actually. And this one is way more scalable and easier to change too."
- **Round 2 (in flight when this was written):** an Opus agent is building it in the same worktree.
  - A one-line definition of Grdn on the opening card. The agent reports 3 candidates; the owner picks one.
  - Two more specimens: a recipe scaler in Kitchen, and a savings chart in Money basics.
  - Polish:
    - a discoverability pulse on the nearest specimen;
    - an open/close FLIP from the card;
    - a phone bottom sheet with a sticky close button;
    - a de-duplicated paper title;
    - keyboard and focus handling.
  - A new check script, `node checks/specimens.cjs` (Playwright, PORT defaults to 8850), with every check written to fail first.

  Check `git log` on the branch and the agent's report before continuing.

## What the page is now (owner-approved concept)

- **The canvas.** Visitors wander a canvas of many people's gardens: static cards for links, notes, apps and a few live widgets. That alone already says "lots of people keep gardens you can visit". The owner confirmed this is the part that works.
- **Specimen cards.** A few cards are specimens: things made with Grdn. Each has a teal outline and an "Open ↗" mark. Tapping one opens a live view over the dimmed canvas:
  - **Live view:** the thing itself, usable. You can play the game, switch the planner from sun to rain, or re-roll the palette.
  - **Made line:** "Made with Grdn from N things in X's garden", with the sources as chips. This line is how the page teaches "Grdn makes things from what you keep".
  - **Where next:** beside the view on desktop, under it on the phone, titled "Because you opened this". Rows either open another specimen or close the view and pan to a person's garden, whose title glows once. One tap leads to the next.
- **Each specimen is data plus a small function.** It is one entry in `SPECS` (`kind`, `title`, `owner`, `garden`, `from[]`, `next[]`, `render(el)`), plus `spec: '<id>'` on a card in `G`. There is no timeline, cursor or choreography. Keep it that way: it is the reason the owner likes this direction.
- **Specimens so far:**
  - Land on Titan (Tiny games, Leo): a playable lander.
  - Moon tonight (Moon & sky, Grandpa Tom): a dashboard. The moon phase is real; the other tiles are illustrative.
  - The Sunday Garden (Windows onto the world, Amara): a weekly paper made from four other gardens.
  - Café: warm, not cute (Colour, Mo): a moodboard.
  - Day planner, rain or shine (Trip to Kyoto, Mei & Jo).
  - In round 2: a recipe scaler and a savings chart.

## Owner rulings to keep

- **No animated scenes, no cursors, no Pointy** (the old helper seed character), on the canvas or in specimens.
- **No end lines under gardens, no "See all gardens", no zoom-out overview, no "Next: … garden".** Visitors swipe or drag the board.
- **Desktop panning stays free.** Nothing snaps.
- **Call it "Where next", never "stream"**, matching the product's `where_next` tool. Where next follows what you are in.
- **One "Reserve your grdn" button on screen at a time.** The opening copy stays: "Everything worth a revisit.", "Reserve your grdn", and "We'll email you once, when your garden is ready."
- **Dice is not a good tool specimen.** A tool must look like something a person made from what they kept.
- **Source-linked briefs are a standard feature** (Perplexity, NotebookLM). Don't spend page space on them.
- **Everything is "coming soon"**, but no "coming soon" labels.

## Next steps

1. **Review round 2 with the owner.**
   - The owner picks the definition line from the 3 candidates.
   - Look at the discoverability pulse and the phone sheet on a real phone.
   - Run `node checks/specimens.cjs` and confirm it is green.
2. **Test with 3–5 real people, not model readers.** Show them the page cold, then ask: "What is Grdn? What would you do with it?" Write the answers down. This is the real acceptance test; see the lessons below.
3. **Decide the specimen set** (count and kinds) from what people respond to. Candidate additions:
   - a fractions explorer (Fractions, by hand);
   - a bird song finder (Birds at the window);
   - Where next as its own mini-demo, if people don't get it from the side panel.
4. **Reviews.** Codex reviews the diff (gpt-6-astra, see the process rules below) before anything ships.
5. **Ship to grdn.page, only on the owner's explicit word** (see Deploy).
6. **Later, optional, discussed but not chosen:**
   - **Keep tray:** a "+ Keep" in each view collects into a small "Your garden" tray, and the email reserves that garden.
   - **Visitor makes a garden:** type a topic, and a small garden starts, seeded by the real app's Where next. This is the strongest idea, but it needs the backend.
   - **Captions:** one line per garden in the owner's voice, e.g. "Tom keeps the night sky he sees from his balcony."

## Deploy (only with the owner's go-ahead)

- **How grdn.page serves the page.** grdn.page is the Grdn app (Vercel project in the primer-v2 repo). It shows this page to signed-out visitors by proxying only `/` to `grdn-site.vercel.app` (Vercel project `grdn-site`, scope `parijats-projects-aff4061b`). So:
  - every asset must be inline or an absolute `https://grdn-site.vercel.app/…` URL;
  - `web/` images must stay in the deployed build;
  - the waitlist form posts same-origin to the app's `/api/waitlist`, which answers 202. It only works under grdn.page, not on localhost or vercel.app.
- **How to deploy grdn-site.** Run from a checkout linked to that project: `vercel link --yes --scope parijats-projects-aff4061b --project grdn-site`, then `vercel deploy --yes` for a preview, or with `--prod` for production. The specimens worktree is not linked yet. The scene branch's checkout (`~/dev/grdn-site-deploy`) is linked; don't deploy that branch.
- **Pushing `main` deploys GitHub Pages.** Never push `main` without the owner. Pushing `feature/grdn-specimens` is safe, but still ask.
- **Today's live state.** grdn.page runs `feature/grdn-page-deploy` at 4f207a9, an older build that still has the first-round animated scenes. Shipping specimens replaces it.

## Why we changed direction (lessons)

- **Six choreographed scenes failed with the owner** even though every model cold read "passed". The readers saw recorded frames in order and were asked to restate our outcome sentence. That proves the mechanics read (keep, door, loader), not that a newcomer understands why they would want Grdn.
  - **Lesson:** judge comprehension with real people, cold, with an open question.
- **The scenes asked too much of a first visitor.** They showed six people using features before the visitor knew what a garden was. The motion also competed with the gardens.
- **Doing beats watching.** Specimens let the visitor poke a real thing, and the made line plus Where next carry the explanation.
- **Scene machinery became expensive.** Clocks, phases, hand-overs and lint, plus a 340-check suite taking about 5 minutes per run. Each owner tweak cost a full cycle.
  - **Lesson:** prefer data plus small render functions. Add machinery only when a second use appears.
- **Check the base before building.** Branching from `main` instead of deleting scene code saved a lot of time. Look for a clean base first.

## Reference: the abandoned scene work (do not build on it; copy pieces only if needed)

- **Branch:** `feature/grdn-page-deploy` (HEAD 4eef2de, local; origin has 4f207a9, which is live). Worktree `~/dev/grdn-site-deploy`.
- **Contents:** the shared focus card, browser window, "making" loader, keep-FLIP and the door pill, plus the full motion standard (`docs/scenes/motion-standard.md`), cold-read notes and `docs/agent-notes.md`.
- **The last full suite run is unconfirmed.** Its final 4 commits (Codex fixes) passed their own checks, but the full suite never ran on 4eef2de.
- **Open question for the owner:** whether to keep this branch. It shouldn't be merged.
- **Cleanup the owner has not yet approved** (all clean; removing them loses nothing committed):
  - worktrees: `~/dev/grdn-review`, `grdn-browse`, `grdn-docs`, `grdn-fit`, `grdn-lena`, `grdn-lena2`, `grdn-pointy`, and `grdn-scene-{tom,leo,amara,lena,arjun,mo}`;
  - python servers on ports 8787, 8792, 8794, 8796, 8800, 8820 and 8821.

  Keep 8850 (specimens). Ask before removing anything.
- **The builder session** (`grdn-site-builder`, a separate Claude session) was told to stop and is idle. Don't send it work unless the owner asks.

## Process rules (owner, standing)

- **Replies:** brief, about 80% ASD-STE100. One short paragraph plus numbered questions. No bare internal codes.
- **Agents:** use agents for multi-step work, with an explicit model (opus or sonnet), and never run implementation on fable. Give the agent a spec and a test plan, TDD (failing test first). Never truncate test output with `| tail` or `| head`.
- **Reviews: Codex**, run as `timeout 900 codex exec -s read-only -m gpt-6-astra -c service_tier=default - < prompt.txt` from inside the repo. The prompt goes in a file. Never use fast mode. Codex can't reach localhost, so its reviews are static.
- **No destructive actions.** Never reset, amend or stash shared work. Keep work local. Production deploys happen only on the owner's word.
- **The owner reviews visually on the phone and laptop.** Keep the page hosted and tell them the URL. Move the hosted copy forward when new commits land.
