# PYQ-LY — engineering notes & roadmap

A running record of the hardening pass and what's worth doing next. (Product
vision and the big technical decisions live in `memory/` and `CLAUDE.md`.)

## Done — hardening pass

| Area | What changed | Commit |
|---|---|---|
| **Tests** | 28 zero-dependency unit tests (Node's built-in runner, `npm test`) for parsePaper, textQuality, rank, slides, clustering. Extracted the pure clustering math into `clusterCore.js` so it tests without loading the embedding model. | `c2af8ad` |
| **Robustness** | A corrupt/unreadable paper is now skipped (kept index-aligned) instead of failing the whole analysis; the result carries `skipped: [{name, reason}]`, surfaced in the UI. | `d80dddb` |
| **Parsing accuracy** | Strip en/em-dash model answers (`Solution – …`) in solution PDFs, which were leaking answer text into the grouping. (Marker broadening to `1)`/`a)` was tried and reverted — it doubled question counts on solution sheets.) | `61a78fa` |
| **Accessibility** | Global `:focus-visible` ring; collapsible card headers are keyboard-operable (role/tabindex/Enter/Space/`aria-expanded`); `aria-pressed` on toggles. Modals (Publish/Contribute/Paywall) are `role="dialog"` + `aria-modal`, take focus on open, and close on **Escape** (`useDismissable`). | `7675964`, *next push* |
| **Performance** | Code-split screens behind `Suspense`; initial JS **1.81 MB → 385 KB** (engine loads on demand). | `0cd418a` |
| **Library** | Search/filter subjects by name/code (appears once there are >3). | `f9bfa59` |
| **Library growth** | Pivoted from admin hand-curation to a self-growing model: **My Library** (users save their own analyses, private), **community contributions** (users submit a new subject for admin review), and **pooling** (add papers to an existing subject; admin merge). | `3108c9f`, `9b3dfc3` |
| **Mobile** | Wrapped the analysis-header action row and loading step rows so a signed-in student's buttons / a long progress note can't overflow on a narrow phone. | `ec488ce` |
| **Lazy engine deps** | Dynamically import tesseract.js (OCR) and the embedder (`cluster.js`, transformers+onnxruntime). The analysis chunk dropped 1.33 MB → 487 KB; AI-grouping users skip the 817 KB embedder entirely (prefetched in parallel for the no-AI path). | *next push* |
| **Solution-sheet detection** | `assessSolutionSheet()` flags answer keys (explicit "Marking Scheme/Model Answer" header, or "Solution –"/"Ans:" lead-ins on ≥50% of questions / ≥6 absolute) → `meta.solution` → a non-destructive `warnings` banner telling the user to prefer the question paper. Validated on real COA papers (2023.pdf solution sheet flags; question papers don't). | *next push* |

## Recommended next (roughly by value)

1. **Activate the library-growth features** — manual stocking was dropped (too tedious to gather papers + slides per subject). Instead the library now grows itself (My Library + community contributions + pooling). To turn it on: run `supabase-schema.sql` in Supabase, then test the three flows once deployed. (Optional admin shortcut for a few popular subjects: `scripts/llm-group.mjs` works **papers-only** — no slides needed.)
2. **Delete the junk `i-environmental-sciences` library subject** — leftover test data with an OCR-garbled name. (Admin screen → Delete, or a small script flag.)
3. **Contribution quality controls** — *partly done:* `submitContribution` now enforces a soft per-user pending cap (10), and the contribute modal nudges duplicate-named subjects toward pooling. Still open: server-side enforcement of the cap (today it's client + RLS-read), true dedup of two near-identical contributions, and auto-merging same-topic groups on pool (today the admin tidies those in the review screen).
3. **Per-user AI rate limit** on `/api/group` — today it only requires sign-in; the free Gemini ceiling (~1500/day shared) is the only cap. Add a small Supabase table (`user_id, day, count`) and reject past N/day so one user can't drain the quota.
4. **Solution-sheet handling — DONE (detect + warn).** `assessSolutionSheet()` now flags answer keys and the analysis screen warns the user to upload the question paper. Still open (riskier): actually *stripping* stray "Term – explanation" answer bullets that slip through as pseudo-questions, and detecting solution sheets that have **no** explicit header and few separators (pure OCR scans of hand-marked scripts).
5. **OCR acronym-gibberish** — slide-title extraction lets through OCR garble like "OSGN OSPN" (the vowel filter misses it because "O" is a vowel). A dictionary/real-word check would help but risks dropping legit all-caps titles ("BUS STRUCTURE").
6. **More numbering formats** — supporting `1)` / `Q1.` would help non-KIIT papers, but needs real alt-format samples to tune without regressing solution sheets. Gather a few first, then add with tests.
7. **Further bundle splitting — DONE.** Tesseract and the embedder (`cluster.js`) are now dynamically imported; the analysis chunk is ~487 KB (was ~1.33 MB) and AI users skip the 817 KB embedder. Remaining: pdf.worker is still a 2.19 MB asset (loaded by pdfjs as a worker, off the main thread) — hard to shrink without dropping pdfjs features.
8. **Pipeline integration test** — add one tiny fixture PDF and a test that runs `analyze()` end-to-end (currently only the pure stages are unit-tested; extraction/OCR are covered by the `scripts/` harnesses against real PDFs).
9. **Mobile QA pass** — spot-check spacing/touch targets across screens on a real phone.
10. **Print/copy lock** (deferred) — the student no-export request; browser-side deterrent only (can't fully prevent screenshots).
