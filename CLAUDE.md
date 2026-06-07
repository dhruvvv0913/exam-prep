# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev      # start dev server (HMR)
npm run build    # production build
npm run preview  # preview production build locally
```

No test suite or linter is configured.

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
3. `ocr.js` — `ocrDocument()` renders pages to a canvas and OCRs with tesseract.js (free, local).
4. `parsePaper.js` — pure functions: detect exam type/session/year/subject/code (tolerant of OCR garble), strip KIIT noise + model answers in solution PDFs, split into question units (number + part). Handles the 3 KIIT formats (mid-sem, end-sem type 1/2).
5. `cluster.js` — embeds questions with transformers.js (`Xenova/bge-small-en-v1.5`, CLS pooling). Two grouping paths share the embedder:
   - **bottom-up** (no slides): `clusterVectors()` (pure, A/B-testable) uses **complete-linkage** (threshold 0.72) plus a **keyword guard**: in the weak band, questions must share a real topic word (acronyms like AR/ML count; words appearing in >50% of questions are ignored as non-distinctive) — this stops generic exam phrasing from grouping unrelated questions. Topic labels are then synthesised from the questions themselves (`rank.topicLabel`). Model chosen via `scripts/test-models.mjs` A/B.
   - **slide-anchored** (when course slides are uploaded — the preferred path): `anchorVectors()`/`anchorQuestions()` match **each question to its single nearest slide TITLE** (strict argmax), but **group by that title's DECK label** (`deckOf`). Matching at title granularity is precise; grouping at deck granularity is what makes repeats aggregate — e.g. "Addressing Modes" asked in 2018/2019/2023 forms ONE 3× group instead of scattering across per-slide sub-titles ("Immediate", "Indirect"…) as "asked once". Below `floor` (default **0.70**, calibrated on real COA papers: correct matches scored ≥0.73, off-syllabus peaked ~0.69) a question goes to one **"Not on slides"** bucket instead of a forced weak match. Tune/inspect with `scripts/test-anchor.mjs --debug`.
6. `slides.js` — `extractTopics(slideChunks)` pulls per-slide **titles** (first real line of each PDF page): drops running headers/footers (lines repeating on >40% of slides), bullet/Wingdings-prefixed body lines, OCR gibberish, mark tokens, sentence lead-ins, and >8-word fragments. Agenda/outline harvesting was tried and removed — wrapped, keyword-stuffed syllabus lines hijacked questions under strict argmax. `extractDeckTopics(decks)` returns `{ titles, deckOf }` (each title tagged with its deck's coarse label); `deckLabel(filename)` derives that label ("8 COA Addressing Modes.pdf" → "Addressing Modes"). All pure/Node-safe.
7. `rank.js` — `groupsFromClusters()` turns raw clusters into the **editable source of truth**: `groups = [{ id, topic, items: [question] }]` (each question gets a stable `uid`); it honours a cluster's given `topic` (slide-anchored) and otherwise synthesises one via `topicLabel()`. `summarize(groups)` derives the ranked display view: `appears` = distinct exams a concept showed up in, `variants` = distinct wordings; repeats (appears ≥ 2) are ranked, single-exam concepts are "asked once". (`rankClusters` is a back-compat wrapper for the Node scripts.)

`pipeline.analyze(paperFiles, { onProgress, slideFiles })` reads `slideFiles` (optional slide PDFs; each deck is read separately and labelled from its filename), extracts deck topics, and uses slide-anchored grouping when slides exist (else bottom-up). Returns `{ papers, groups, questionCount, paperCount, topicCount }` (topicCount = distinct decks; groups, not pre-ranked). The analysis screen derives its view with `summarize()`; the **admin review** ([ReviewScreen.jsx](src/screens/ReviewScreen.jsx), reached via "Edit groups") edits `groups` directly — merge/split/rename/delete via one "move question to → group / new group" primitive — and `onGroupsChange` persists the edits. This is the guaranteed-accuracy step over the imperfect auto-grouping.

Keep `parsePaper`, `textQuality`, `cluster`, `rank`, `slides` as pure/Node-safe modules (no DOM/pdfjs) so the `scripts/` harnesses can test them; browser-only bits live in `extractText`/`ocr`.

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

Persistence (`localStorage`): `"pyqly-proto-v1"` → `{ screen, result, progressKey }`; `"pyqly-progress"` → per-bucket `{ done, starred }` keyed `lib:<id>` (a library subject) vs `upload` (a fresh self-upload). Uploaded `File`s are not persisted. (`src/data/clusters.js` is dead prototype data — nothing imports it; ignore it.)

### Backend, auth & the curated library (Supabase)

Supabase backs **only** auth + the saved library, never the analysis; it degrades gracefully when unconfigured.

- [supabase.js](src/lib/supabase.js) — client from `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY`; `supabaseEnabled` is false (auth/library quietly hidden) when those are unset.
- [auth.jsx](src/auth.jsx) — `AuthProvider`/`useAuth`: Google OAuth; `isAdmin` = signed-in email === `VITE_ADMIN_EMAIL`.
- [libraryDb.js](src/engine/libraryDb.js) — all queries. Three RLS-protected tables: `subjects` (public metadata), `subject_content` (the `groups`; served only if free/entitled/admin), `entitlements` (admin-granted `(email, subject_id)`). Writes are admin-only via RLS `is_admin()`; **paid content is enforced server-side, never client-side**.
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
