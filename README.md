# DP Lens

A step-based tutor for knapsack dynamic programming, built as a project for CS6460
(Educational Technology) at Georgia Tech.

**Live version: https://avengersstark.github.io/dp-lens/**

Learners open a URL, type a nickname, and follow a unit path. Every problem is
organized by a five-slot spec card (state, base case, transition, evaluation order,
answer), and support fades across four modes:

| Mode | What the learner does | Where |
|---|---|---|
| Watch | Steps through an animated worked example; answers self-explanation questions at pauses | `src/pages/Watch.tsx` |
| Predict | Types the value of a paused cell and clicks the cells it depends on; feedback is keyed to the error; escalating hints; mastery gate | `src/pages/Predict.tsx` |
| Build | Assembles the spec card from shuffled blocks with distractors (a Parsons problem); the card is run on 66 instances | `src/pages/Build.tsx` |
| Write | Types the transition in a small notation and picks the loop order; it runs on 206 instances and traces the first wrong cell | `src/pages/Write.tsx` |

Plus a test mode (Unit Check, parallel forms A and B, no feedback) and a teacher
page that merges exported logs into an error board.

## Run it

Needs Node.js 20 or newer.

```bash
npm install
npm run dev                 # http://localhost:5173
```

Other scripts: `npm test` (Vitest), `npm run typecheck`, `npm run build` (writes `dist/`),
`npm run preview` (serves the build).

For a recording or a review, a fresh browser window works best. Use **Reset my progress** at
the bottom of the start page to start over. Reviewers can turn on the **reviewer pass**
on the start page to open every step without the mastery gates.

## Deploy to GitHub Pages

The build is static and uses relative paths, so it works under any repository name.
`npm run deploy` runs the tests, builds, and pushes `dist/` to the `gh-pages` branch,
which GitHub Pages serves (Settings → Pages → Deploy from a branch → `gh-pages`, `/`).

## How it is built

- Preact 10, TypeScript, Vite, and hand-drawn SVG. No third-party scripts, no web
  fonts, no accounts: it loads from mainland China and runs offline once loaded.
- `src/lib/notation.ts`: the Write notation. A hand-written parser and tree-walking
  interpreter; nothing goes through `eval`. Every value carries the multiset of items
  that built it, which is how a reused item shows up as `1×2`.
- `src/lib/runner.ts`: runs a spec (base case, transition, loop order) the way a
  program would, records every read and write, finds the first wrong write, traces
  back from a wrong answer, and diagnoses the root cause with a misconception code.
- `src/lib/knapsack.ts`: the answer key. Truth tables come from enumerating packings,
  not from the recurrence being taught.
- `src/lib/check.ts`, `src/lib/build.ts`: Write and Build checking. Cards are judged by
  running them, so valid alternatives (right-to-left rows, column order, an "exactly
  j" state with its matching base case and answer) pass, and each distractor fails
  with feedback on the slot that caused it.
- `src/lib/tutor.ts`: Predict's explanations, hints, and the classifier for wrong
  values and wrong dependency sets.
- `src/lib/codes.ts`: the misconception code book shared by every mode and the error board.
- `src/lib/log.ts`: the event log (browser storage, exported as JSON).

## Status against the proposal

| Proposal item | Status |
|---|---|
| Watch, Predict (0/1, table) | Done; mastery gate and three-level hints |
| Build (0/1, table), Write (0/1, table) | First version done |
| One-array 0/1: Predict with item tracking, forward-loop experiment, Write | First version done |
| Complete knapsack: Build and Write | First version done |
| Spec card stated aloud (in class) | In-app version: Explain your spec card, with self-rating against the reference |
| Three-sentence reflection (after class) | In-app version: Reflect, showing the learner's own coded errors by slot |
| Mental effort rating after each mode (evaluation plan) | Done; summarized on the teacher page |
| Unit Check, forms A and B, counterbalanced by nickname | Done; open parts are rubric-scored from the teacher page |
| Error board with labeled synthetic demo data | Done |
| Minute-by-minute lesson plan | First version in the app (Lesson plan page) |
| Reviewer support | Reviewer pass (opens every step), a 15-minute tour, a design note on each page |
| Event log export | Done |
| Optional Cloudflare Workers log endpoint | Not built (fallback in use: learners export a file) |
| Optional Chinese glosses | On hold; English-only with plain-English hover definitions |
| Instructions and Evaluation documents | Not started (weeks 7–8) |
