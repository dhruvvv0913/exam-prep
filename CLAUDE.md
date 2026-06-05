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

Sample papers are in the user's `~/Downloads/` (see `samples/exam_papers`).

## Architecture

**PYQ-LY** is a React + Vite SPA that helps college students find the important, repeated questions in past exam papers, grouped by concept and ranked by how often they recur. See `memory/` for the product vision and the agreed technical decisions.

### Analysis engine (`src/engine/`) — runs 100% in the browser, free, no backend

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

### Current prototype UI — all question data is hardcoded in `src/data/clusters.js`.

### Screen state machine (`src/screens/App.jsx`)

The app is a three-screen linear flow managed in `App` with a `screen` state value:

```
landing  →  loading  →  analysis
```

- `landing`: user uploads PDFs (names only, no actual parsing) and optionally handouts
- `loading`: fake 3.5s animated progress that simulates analysis, then auto-advances
- `analysis`: shows ranked question clusters from hardcoded data

State (`screen`, `papers`, `handouts`) is persisted to `localStorage` under the key `"pyqly-proto-v1"`.

### Data (`src/data/clusters.js`)

All question content is static. `Q` is a flat map of cluster objects keyed by id. `MODES` maps the three toggle values (`"5"`, `"1"`, `"combined"`) to their ranked/unique cluster id lists. `DEFAULT_DONE` and `DEFAULT_STAR` seed the initial done/starred state.

To add or change questions, edit `Q` and update the `MODES` arrays accordingly.

### Styling

All layout and visual styling uses **inline styles** — there is no CSS-in-JS library and no component-level stylesheet. All color, shadow, font, and spacing values come from the design token object `C` exported by `src/theme.js`. The helper `hexA(hex, alpha)` converts a hex color to `rgba` for transparency variants.

Do not introduce a CSS file or external styling library; keep new styles inline using tokens from `C`.

### Component structure

- `src/components/atoms.jsx` — shared primitives: `Logo`, `Tag`, `HeatBar`, `PrimaryButton`, `GhostButton`, `FloatField` (animated decorative background)
- `src/components/icons.jsx` — inline SVG icon components
- `src/useIsMobile.js` — `useIsMobile(maxWidth?)` hook wrapping `matchMedia`, used throughout screens to switch a handful of padding/font-size values for mobile

### Key patterns

- `AnalysisScreen` owns `doneSet` and `starSet` as `Set` state; toggling uses a generic `toggle(setter)(id)` helper that clones the Set.
- Hovering a `RankRow` for 1.6 s opens its `SidePanel` (via `setTimeout`); clicking opens it immediately.
- The `SidePanel` is an absolutely-positioned overlay inside the analysis scroll container, not a portal.
