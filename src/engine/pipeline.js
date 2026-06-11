// Orchestrates the whole analysis: uploaded papers -> ranked repeated questions.
// `paperFiles` is an array of papers, each itself an array of page files (so a
// multi-page paper = several images/PDFs that get concatenated into one paper).
// Reports progress through `onProgress({ stage, ... })` for the loading screen.
// Stages: reading, ocr, extracted, clustering, ranking.
import { extractText } from "./extractText.js";
import { ocrImage } from "./ocr.js";
import { parsePaper } from "./parsePaper.js";
// cluster.js pulls in transformers.js + onnxruntime (~1.3 MB). It's imported
// *dynamically* (below) so signed-in AI-grouping users — whose grouping happens
// on the server — never download the embedder unless the LLM call fails.
import { extractDeckTopics, deckLabel } from "./slides.js";
import { groupsFromClusters } from "./rank.js";

async function readPage(file, onProgress) {
  const isPdf = /\.pdf$/i.test(file.name) || file.type === "application/pdf";
  if (isPdf) {
    const buf = new Uint8Array(await file.arrayBuffer());
    const { text, method } = await extractText(buf, {
      onOcrProgress: (done, total) => onProgress?.({ stage: "ocr", paper: file.name, done, total }),
    });
    return { text, ocr: method === "ocr" };
  }
  onProgress?.({ stage: "ocr", paper: file.name, done: 0, total: 1 });
  return { text: await ocrImage(file), ocr: true };
}

// `aiGroup(items, chapters)` is an optional async grouper (the signed-in LLM
// path); if it throws we fall back to the in-browser embedding grouping.
export async function analyze(paperFiles, { onProgress, slideFiles, aiGroup } = {}) {
  const items = [];
  const papers = [];
  const skipped = []; // papers we couldn't read or that yielded no questions
  const warnings = []; // papers we analysed but flagged (e.g. answer keys)

  // When there's no AI grouper we'll definitely need the in-browser embedder,
  // so start downloading its chunk in parallel with reading the papers (so it
  // isn't a serial wait after extraction). AI users skip it entirely.
  const embedderP = aiGroup ? null : import("./cluster.js");

  for (let i = 0; i < paperFiles.length; i++) {
    const pages = paperFiles[i];
    const name = pages[0]?.name || `Paper ${i + 1}`;
    onProgress?.({ stage: "reading", paper: name, index: i, total: paperFiles.length });

    // Concatenate every page of this paper into one text blob. A single bad
    // file (e.g. a corrupt/unsupported PDF) skips just that paper, not the run —
    // we still push a placeholder so `papers[pIdx]` stays index-aligned.
    let text = "";
    let usedOcr = false;
    let failed = false;
    try {
      for (const file of pages) {
        const { text: t, ocr } = await readPage(file, onProgress);
        text += t + "\n";
        usedOcr = usedOcr || ocr;
      }
    } catch (e) {
      failed = true;
      onProgress?.({ stage: "paper-skipped", paper: name, reason: e.message });
    }

    const { meta, questions } = failed ? { meta: {}, questions: [] } : parsePaper(text);
    const paperId = `${meta.session ?? meta.examType ?? "Paper"} ${meta.year ?? i + 1}`.trim();
    papers.push({ pages: pages.length, ...meta, name, method: failed ? "failed" : usedOcr ? "ocr" : "text", count: questions.length });
    // pIdx (paper index) = which uploaded paper a question came from.
    for (const q of questions) items.push({ ...q, paperId, year: meta.year, pIdx: i });
    if (failed || questions.length === 0) skipped.push({ name, reason: failed ? "unreadable" : "no-questions" });
    // Analysed fine, but it looks like an answer key — warn (non-destructive).
    else if (meta.solution) {
      warnings.push({ name, reason: "solution-sheet" });
      onProgress?.({ stage: "paper-warning", paper: name, reason: "solution-sheet" });
    }

    onProgress?.({ stage: "extracted", index: i, total: paperFiles.length, questions: items.length });
  }

  if (items.length === 0) {
    throw new Error(
      skipped.every((s) => s.reason === "unreadable")
        ? "We couldn't read those files — they may be corrupt, password-protected, or an unsupported format."
        : "We couldn't find any questions in those papers. If they're scanned images, try clearer scans, or check they're exam papers."
    );
  }

  // Optional: read course slides and extract a deck-level topic taxonomy to
  // group against. Each slide deck (PDF) becomes one coarse topic, labelled from
  // its filename; per-slide titles are the precise match targets. extractText
  // separates a PDF's pages with a blank line, so split on that for slides.
  let topics = [];
  let deckOf = null;
  let topicCount = 0;
  if (slideFiles && slideFiles.length) {
    const decks = [];
    for (let i = 0; i < slideFiles.length; i++) {
      onProgress?.({ stage: "slides", index: i, total: slideFiles.length, paper: slideFiles[i]?.name });
      try {
        const { text } = await readPage(slideFiles[i], onProgress);
        const slides = text.split(/\n\s*\n/).filter((c) => c.trim());
        decks.push({ label: deckLabel(slideFiles[i]?.name || `Deck ${i + 1}`), slides });
      } catch (e) {
        throw new Error(`Reading slide deck ${i + 1} failed: ${e.message}`);
      }
    }
    ({ titles: topics, deckOf } = extractDeckTopics(decks));
    topicCount = new Set(deckOf).size;
    onProgress?.({ stage: "topics", topics: topicCount });
  }

  const chapters = deckOf ? [...new Set(deckOf)] : [];
  onProgress?.({ stage: "clustering", questions: items.length, anchored: topics.length > 0, ai: !!aiGroup });

  // Preferred path (signed-in): LLM grouping via the backend. On any failure
  // (offline, quota, not signed in) fall back to the local embedding grouping.
  let clusters = null;
  if (aiGroup) {
    try {
      clusters = await aiGroup(items, chapters);
    } catch (e) {
      onProgress?.({ stage: "ai-fallback", error: e.message });
      clusters = null;
    }
  }
  if (!clusters) {
    try {
      // Use the prefetched chunk if we started one; otherwise (AI path that
      // failed) load it now.
      const { clusterQuestions, anchorAndClusterQuestions } = await (embedderP || import("./cluster.js"));
      clusters = topics.length ? await anchorAndClusterQuestions(items, topics, { deckOf }) : await clusterQuestions(items);
    } catch (e) {
      throw new Error(`Grouping (AI model) failed: ${e.message}`);
    }
  }

  onProgress?.({ stage: "ranking" });
  const groups = groupsFromClusters(clusters); // editable source of truth

  return {
    papers,
    groups,
    questionCount: items.length,
    paperCount: paperFiles.length,
    topicCount,
    skipped, // [{ name, reason }] — papers that were unreadable or had no questions
    warnings, // [{ name, reason }] — analysed but flagged (e.g. "solution-sheet")
  };
}
