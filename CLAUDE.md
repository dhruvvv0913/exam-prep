# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev      # start dev server (HMR)
npm run build    # production build
npm run preview  # preview production build locally
npm test         # engine unit tests (Node's built-in runner, tests/*.test.mjs)
```

`npm test` covers the pure engine modules (parsePaper, textQuality, rank, slides, clusterCore) with zero extra dependencies. No linter is configured. The browser-only modules (extractText, ocr, cluster's embedder) aren't unit-tested — they're exercised by the `scripts/` harnesses against real PDFs.

### Engine dev scripts (Node)

The `src/engine/` modules are validated against real papers with throwaway Node
harnesses in `scripts/` (the browser uses `src/engine/*`; these scripts re-do
PDF I/O the Node way but import the real parse/cluster/rank modules):

```bash
node scripts/test-parse.mjs "<pdf>"                 # extract + parse one paper
node scripts/test-quality.mjs "<pdf>" ...           # text-usable vs needs-OCR score
node scripts/test-ocr.mjs "<scanned.pdf>"           # OCR a scanned paper
node scripts/test-pipeline.mjs "<pdf>" "<pdf>" ...  # full pipeline -> ranked repeats
node scripts/test-slides.mjs "<slides.pdf>"         # topic taxonomy extracted from one slide deck
node scripts/test-anchor.mjs <slides...> -- <papers...> [--floor=0.7] [--debug]
                                                    # full STRICT slide-anchored grouping (--debug prints match scores)
# Admin-only high-accuracy grouping via an LLM. Provider-agnostic; default is
# Gemini's FREE tier (GEMINI_API_KEY in .env). Also: groq | ollama | openai | anthropic.
node --env-file=.env scripts/llm-group.mjs --manifest=samples/coa_sample
node --env-file=.env scripts/llm-group.mjs <slides...> -- <papers...> [--provider=gemini] [--model=...] [--out=...]
```

The real sample PDFs live in the user's `~/Downloads/`; `samples/{coa_sample,eod_sample,exam_papers}` are manifest files listing them per subject (papers, then slide decks). `llm-group.mjs` can read one directly via `--manifest=samples/coa_sample`.

## Architecture

**PYQ-LY** is a React + Vite SPA that helps college students find the important, repeated questions in past exam papers, grouped by concept and ranked by how often they recur. See `memory/` for the product vision and the agreed technical decisions.

### Analysis engine (`src/engine/`) — runs 100% in the browser, free (Supabase backs only auth + the saved library, never the analysis)

Wired into the UI ([pipeline.js](src/engine/pipeline.js) orchestrates files → ranked results; screens consume it). **Everything is self-hosted in `public/`** — the embedding model (`public/models/`), the ONNX-runtime WASM (`public/ort/`), and the OCR worker/core/lang (`public/tesseract/`) — with **no external CDN calls**, because the target users are on a locked-down campus network that intercepts CDN requests and returns HTML (which broke JSON parsing). `cluster.js` sets `env.allowRemoteModels=false`, local paths, `numThreads=1`, and `useBrowserCache=false` (a failed run had cached an HTML error page that replayed forever). `vite.config.js` has an `asset-404` plugin so missing files under `/models|/ort|/tesseract` return 404 instead of the SPA `index.html` fallback (transformers probes optional files; HTML responses crash it). Note: the `scripts/*.mjs` Node harnesses override `env.localModelPath="./public/models/"` (or set `allowRemoteModels=true`) since the browser paths don't resolve in Node. Pipeline:

1. `extractText.js` — pdfjs text layer; if empty/garbled, falls back to OCR. Returns `{ text, method }`.
2. `textQuality.js` — `assessText()` decides usable-vs-OCR by common-English-word ratio (threshold 0.08). Only image-only scans truly need OCR; garbled-header scans (e.g. COA) still parse fine.
3. `ocr.js` — `ocrDocument()` renders pages to a canvas and OCRs with tesseract.js (free, local). **tesseract.js is dynamically imported** (cached promise) so text-layer PDFs — the common case — never load the OCR wrapper; it splits into its own on-demand chunk.
4. `parsePaper.js` — pure functions: detect exam type/session/year/subject/code (tolerant of OCR garble), strip KIIT noise + model answers in solution PDFs (the answer separator may be an en/em-dash: "Solution – …"), split into question units (number + part). The question-marker regex is kept strict ("1." + "(a)") on purpose — broadening to "1)"/"a)" doubled the count on solution sheets by matching answer-list bullets as questions. Handles the 3 KIIT formats (mid-sem, end-sem type 1/2). `assessSolutionSheet(text, questionCount)` flags **answer keys / solution sheets** (an explicit "Marking Scheme/Model Answer/Answer Key" header, or per-question "Solution –"/"Ans:" lead-ins covering ≥50% of questions or ≥6 absolute); `parsePaper` exposes the result as `meta.solution`. Such papers are still analysed (stems parse fine after the model answers are stripped) but the pipeline raises a non-destructive **warning** so the user can prefer the question paper. Validated on real COA papers: the genuine solution sheet (2023.pdf, explicit header + 12 markers) flags, real question papers don't.
5. `cluster.js` — embeds questions with transformers.js (`Xenova/bge-small-en-v1.5`, CLS pooling); the pure clustering math lives in `clusterCore.js` (no model import, unit-tested) and is re-exported here. Two grouping paths share the embedder:
   - **bottom-up** (no slides): `clusterVectors()` (pure, A/B-testable) uses **complete-linkage** (threshold 0.72) plus a **keyword guard**: in the weak band, questions must share a real topic word (acronyms like AR/ML count; words appearing in >50% of questions are ignored as non-distinctive) — this stops generic exam phrasing from grouping unrelated questions. Topic labels are then synthesised from the questions themselves (`rank.topicLabel`). Model chosen via `scripts/test-models.mjs` A/B.
   - **slide-anchored** (when course slides are uploaded — the preferred path): `anchorVectors()`/`anchorQuestions()` match **each question to its single nearest slide TITLE** (strict argmax), but **group by that title's DECK label** (`deckOf`). Matching at title granularity is precise; grouping at deck granularity is what makes repeats aggregate — e.g. "Addressing Modes" asked in 2018/2019/2023 forms ONE 3× group instead of scattering across per-slide sub-titles ("Immediate", "Indirect"…) as "asked once". Below `floor` (default **0.70**, calibrated on real COA papers: correct matches scored ≥0.73, off-syllabus peaked ~0.69) a question goes to one **"Not on slides"** bucket instead of a forced weak match. Tune/inspect with `scripts/test-anchor.mjs --debug`.
6. `slides.js` — `extractTopics(slideChunks)` pulls per-slide **titles** (first real line of each PDF page): drops running headers/footers (lines repeating on >40% of slides), bullet/Wingdings-prefixed body lines, OCR gibberish, mark tokens, sentence lead-ins, and >8-word fragments. Agenda/outline harvesting was tried and removed — wrapped, keyword-stuffed syllabus lines hijacked questions under strict argmax. `extractDeckTopics(decks)` returns `{ titles, deckOf }` (each title tagged with its deck's coarse label); `deckLabel(filename)` derives that label ("8 COA Addressing Modes.pdf" → "Addressing Modes"). All pure/Node-safe.
7. `rank.js` — `groupsFromClusters()` turns raw clusters into the **editable source of truth**: `groups = [{ id, topic, items: [question] }]` (each question gets a stable `uid`); it honours a cluster's given `topic` (slide-anchored) and otherwise synthesises one via `topicLabel()`. `summarize(groups)` derives the ranked display view: `appears` = distinct exams a concept showed up in, `variants` = distinct wordings; repeats (appears ≥ 2) are ranked, single-exam concepts are "asked once". (`rankClusters` is a back-compat wrapper for the Node scripts.)

`pipeline.analyze(paperFiles, { onProgress, slideFiles, aiGroup })` reads `slideFiles` (optional slide PDFs; each deck is read separately and labelled from its filename), extracts deck topics, and uses slide-anchored grouping when slides exist (else bottom-up). A corrupt/unreadable paper is **skipped** (a placeholder keeps `papers[pIdx]` index-aligned) rather than failing the whole run; only if *no* questions are found does it throw. Returns `{ papers, groups, questionCount, paperCount, topicCount, skipped, warnings }` (`skipped`/`warnings` = `[{ name, reason }]` — `skipped` papers yielded nothing/were unreadable; `warnings` were analysed but flagged, e.g. `reason: "solution-sheet"`; groups, not pre-ranked). Both are surfaced as banners on the analysis screen, and `LoadingScreen` shows live `paper-skipped`/`paper-warning` notes. `rank.byPaper(groups)` powers the analysis screen's "By paper" view. The analysis screen derives its view with `summarize()`; the **admin review** ([ReviewScreen.jsx](src/screens/ReviewScreen.jsx), reached via "Edit groups") edits `groups` directly — merge/split/rename/delete via one "move question to → group / new group" primitive — and `onGroupsChange` persists the edits. This is the guaranteed-accuracy step over the imperfect auto-grouping.

Keep `parsePaper`, `textQuality`, `clusterCore`, `rank`, `slides` as pure/Node-safe modules (no DOM/pdfjs) so the `scripts/` harnesses and `npm test` can use them; browser-only bits live in `extractText`/`ocr`/`cluster` (the embedder).

### Screen state machine (`src/screens/App.jsx`)

`App` manages a `screen` value across five screens (the old hardcoded-prototype flow is gone — analysis is real now):

```
landing → loading → analysis        (self-upload)
library → analysis                  (open a published subject)
admin                               (admin-only)
```

- `landing` ([LandingScreen.jsx](src/screens/LandingScreen.jsx)) — upload past-paper PDFs/images (multi-page papers supported) + optional **course slides**; "Start" → loading.
- `loading` ([LoadingScreen.jsx](src/screens/LoadingScreen.jsx)) — runs the **real** `pipeline.analyze(papers, { slideFiles })` with live stage progress (not a fake timer), then → analysis.
- `analysis` ([AnalysisScreen.jsx](src/screens/AnalysisScreen.jsx)) — a **By topic / By paper** toggle: topic view is `summarize()`d groups (collapsible cards, study progress, search + Starred/Hide-done/Expand chips); paper view is `rank.byPaper()` — the same questions regrouped by source exam, in order. Each question chip cross-links to the other view (paper⇄topic) with a scroll + flash. Admins also get **Publish to library**; "Edit groups" opens the review screen.
- `library` ([LibraryScreen.jsx](src/screens/LibraryScreen.jsx)) — browse published subjects from Supabase; opening one (free/entitled/admin) → analysis, else a paywall.
- `admin` ([AdminScreen.jsx](src/screens/AdminScreen.jsx), admin-only) — manage subjects + grant/revoke per-email access.
- The review step is not its own `screen` value — [ReviewScreen.jsx](src/screens/ReviewScreen.jsx) renders within analysis ("Edit groups") and edits `groups` directly: merge/split/rename/delete via one "move question to → group / new group" primitive; `onGroupsChange` persists. This is the guaranteed-accuracy step over imperfect auto-grouping.

Every screen except `landing` is `React.lazy`-loaded behind a `Suspense` boundary, so the heavy analysis engine (transformers/tesseract/pdfjs, reached only via `LoadingScreen`) is a separate chunk that loads on demand — initial JS is ~385 KB vs ~1.8 MB. The engine itself is further split: **the embedder (`cluster.js` → transformers + onnxruntime, ~817 KB / 199 KB gzip) is dynamically imported by `pipeline.js`** only when the in-browser grouping runs, so signed-in AI-grouping users (whose grouping is server-side) download a ~487 KB analysis chunk instead of ~1.33 MB and skip the embedder entirely unless the LLM call fails. For the no-AI path the embedder chunk is prefetched in parallel with paper extraction (`const embedderP = aiGroup ? null : import("./cluster.js")`) so it isn't a serial wait. Tesseract is likewise dynamically imported in `ocr.js`. Onboarding uses one-time dismissible [Tip.jsx](src/components/Tip.jsx) banners (slides-upload nudge on landing, the views toggle on results), persisted in `localStorage` (`pyqly-tips`).

Persistence (`localStorage`): `"pyqly-proto-v1"` → `{ screen, result, progressKey }`; `"pyqly-progress"` → per-bucket `{ done, starred }` keyed `lib:<id>` (a library subject) vs `upload` (a fresh self-upload). Uploaded `File`s are not persisted. (`src/data/clusters.js` is dead prototype data — nothing imports it; ignore it.)

### Backend, auth & the curated library (Supabase)

Supabase backs **only** auth + the saved library, never the analysis; it degrades gracefully when unconfigured.

- [supabase.js](src/lib/supabase.js) — client from `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY`; `supabaseEnabled` is false (auth/library quietly hidden) when those are unset.
- [auth.jsx](src/auth.jsx) — `AuthProvider`/`useAuth`: Google OAuth; `isAdmin` = signed-in email === `VITE_ADMIN_EMAIL`.
- [libraryDb.js](src/engine/libraryDb.js) — all queries. RLS-protected tables: `subjects` (public metadata), `subject_content` (the `groups`; served only if free/entitled/admin), `entitlements` (admin-granted `(email, subject_id)`), `my_subjects` (each user's own private saved analyses), `contributions` (user-submitted analyses awaiting admin review). Writes to the curated tables are admin-only via RLS `is_admin()`; **paid content is enforced server-side, never client-side**. All table DDL + policies are in [supabase-schema.sql](supabase-schema.sql).
- **Library growth model** (instead of the admin hand-curating everything): **My Library** — signed-in users "Save to My Library" from the results screen (`my_subjects`), shown as "Your subjects" on the library screen. **Community contributions** — users "Contribute to library" (a new subject, or *pool* their papers into an existing one via `target_subject_id`); the admin approves/rejects from `AdminScreen` (approve publishes a new subject or `mergeContent`-merges into the target, re-basing `pIdx`). Queue hygiene: `submitContribution` enforces a soft **per-user cap** (max 10 pending; fails open on a count error), and the contribute modal **nudges toward pooling** when the typed name matches an existing subject (steers away from near-duplicate subjects).
- The **anon** key is public/safe to ship; the **service_role** key (local scripts only) bypasses RLS and must never be committed (`.env` is gitignored). Env vars are documented in `.env.example`.

### Building a curated library (admin workflow)

Two ways to produce a subject's `groups`, then publish:

1. **In-browser** — analyze on the landing screen, then (as admin) **Publish to library** on the analysis screen (`publishSubject()`).
2. **Higher-accuracy, offline** (recommended for curated content) — `scripts/llm-group.mjs` parses papers + slides with the real engine, then asks an LLM (free Gemini by default) to group them with clean labels → `scripts/llm-groups.out.json` (gitignored); `scripts/publish-library.mjs --id=… --subject="…"` upserts it into Supabase (needs the service_role key locally). Then refine in the in-app review screen.

The LLM pass clearly beats in-browser embedding grouping (correct chapter per question, no off-syllabus dumping) and, being admin-side, stays free + campus-safe for students. See `memory/slide-anchored-grouping`.

### AI grouping for self-upload (signed-in students)

Anonymous self-upload uses the free in-browser grouping; **signed-in** users get the same LLM grouping via a same-origin serverless proxy (works on the campus network; the key never reaches the client):

- [api/group.js](api/group.js) — Vercel function: verifies the caller's Supabase token, calls Gemini with the **server-side** `GEMINI_API_KEY` (set in Vercel project env, not `VITE_`-prefixed), returns `{ groups }`. Inert (503 → client falls back) until that env var is set.
- [aiGroup.js](src/engine/aiGroup.js) — browser: `groupViaApi(items, topics)` POSTs question text + chapters to `/api/group` with the user's token and maps the response to clusters.
- `App` owns a `useAi` toggle and passes `aiGroup` to `LoadingScreen` only when signed in + on; `pipeline.analyze(…, { aiGroup })` uses it and **falls back to in-browser embedding grouping on any failure** (offline, quota, not deployed). `LandingScreen` shows the AI toggle (signed-in) or a sign-in nudge (anonymous). `/api/group` doesn't run under `vite dev` — use `vercel dev` to exercise it locally (otherwise it just falls back).

### Deployment

Static **Vercel** deploy, auto-deploys on push to `main`. Use the stable production alias, not the per-deploy hash URLs. Newly published library subjects appear immediately (read from Supabase) without a redeploy.

### Styling

All layout and visual styling uses **inline styles** — there is no CSS-in-JS library and no component-level stylesheet. All color, shadow, font, and spacing values come from the design token object `C` exported by `src/theme.js`. The helper `hexA(hex, alpha)` converts a hex color to `rgba` for transparency variants.

Do not introduce a CSS file or external styling library; keep new styles inline using tokens from `C`.

### Component structure

- `src/components/atoms.jsx` — shared primitives: `Logo`, `Tag`, `HeatBar`, `PrimaryButton`, `GhostButton`, `FloatField` (animated decorative background)
- `src/components/icons.jsx` — inline SVG icon components
- `src/useIsMobile.js` — `useIsMobile(maxWidth?)` hook wrapping `matchMedia`, used throughout screens to switch a handful of padding/font-size values for mobile

### Key patterns

- `done`/`starred` progress is owned by `App` (as `Set`s, persisted per progress bucket) and passed into `AnalysisScreen`; toggling clones the Set via a `toggleIn(setter)(id)` helper.
- `AnalysisScreen` renders groups as collapsible `GroupCard`s (topic header + question list); ranking and labels come from `summarize()`. The admin-only `PublishModal` saves the current groups as a library subject.
- Background visuals are decorative only: `AuroraBg` (in `App`) and `FloatField` (atoms) sit behind content at a lower `zIndex`.
