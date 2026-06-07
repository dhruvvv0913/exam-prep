# PYQ-LY — engineering notes & roadmap

A running record of the hardening pass and what's worth doing next. (Product
vision and the big technical decisions live in `memory/` and `CLAUDE.md`.)

## Done — hardening pass

| Area | What changed | Commit |
|---|---|---|
| **Tests** | 28 zero-dependency unit tests (Node's built-in runner, `npm test`) for parsePaper, textQuality, rank, slides, clustering. Extracted the pure clustering math into `clusterCore.js` so it tests without loading the embedding model. | `c2af8ad` |
| **Robustness** | A corrupt/unreadable paper is now skipped (kept index-aligned) instead of failing the whole analysis; the result carries `skipped: [{name, reason}]`, surfaced in the UI. | `d80dddb` |
| **Parsing accuracy** | Strip en/em-dash model answers (`Solution – …`) in solution PDFs, which were leaking answer text into the grouping. (Marker broadening to `1)`/`a)` was tried and reverted — it doubled question counts on solution sheets.) | `61a78fa` |
| **Accessibility** | Global `:focus-visible` ring; collapsible card headers are keyboard-operable (role/tabindex/Enter/Space/`aria-expanded`); `aria-pressed` on toggles. | `7675964` |
| **Performance** | Code-split screens behind `Suspense`; initial JS **1.81 MB → 385 KB** (engine loads on demand). | `0cd418a` |
| **Library** | Search/filter subjects by name/code (appears once there are >3). | `f9bfa59` |

## Recommended next (roughly by value)

1. **Stock the library** — add the core KIIT subjects you have papers for (OS, DBMS, OOPJ, DM, EVS) via `scripts/llm-group.mjs` → `scripts/publish-library.mjs`. The pipeline is proven; this is the biggest user-facing win for launch. A `--publish` flag on `llm-group.mjs` would make it one command.
2. **Delete the junk `i-environmental-sciences` library subject** — leftover test data with an OCR-garbled name. (Admin screen → Delete, or a small script flag.)
3. **Per-user AI rate limit** on `/api/group` — today it only requires sign-in; the free Gemini ceiling (~1500/day shared) is the only cap. Add a small Supabase table (`user_id, day, count`) and reject past N/day so one user can't drain the quota.
4. **Solution-sheet handling** — model-answer bullets ("Operating System – …", "Clock Speed – …") still parse as pseudo-questions and pollute grouping. Options: detect "this is a solution sheet" (high `mark for`/`Solution` density) and warn the user to upload the question paper, or strip "Term – explanation" answer bullets (risky — needs care).
5. **OCR acronym-gibberish** — slide-title extraction lets through OCR garble like "OSGN OSPN" (the vowel filter misses it because "O" is a vowel). A dictionary/real-word check would help but risks dropping legit all-caps titles ("BUS STRUCTURE").
6. **More numbering formats** — supporting `1)` / `Q1.` would help non-KIIT papers, but needs real alt-format samples to tune without regressing solution sheets. Gather a few first, then add with tests.
7. **Further bundle splitting** — the engine chunk is still ~1.34 MB. Tesseract (OCR) is only needed for scanned/image papers; lazy-load it inside `ocr.js` so text-layer PDFs never download it.
8. **Pipeline integration test** — add one tiny fixture PDF and a test that runs `analyze()` end-to-end (currently only the pure stages are unit-tested; extraction/OCR are covered by the `scripts/` harnesses against real PDFs).
9. **Mobile QA pass** — spot-check spacing/touch targets across screens on a real phone.
10. **Print/copy lock** (deferred) — the student no-export request; browser-side deterrent only (can't fully prevent screenshots).
