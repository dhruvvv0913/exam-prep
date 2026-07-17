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

async function readPage(file, onProgress, aiScan) {
  const isPdf = /\.pdf$/i.test(file.name) || file.type === "application/pdf";
  if (isPdf) {
    const buf = new Uint8Array(await file.arrayBuffer());
    const { text, method } = await extractText(buf, {
      onOcrProgress: (done, total) => onProgress?.({ stage: "ocr", paper: file.name, done, total }),
      aiScan, // signed-in last resort for papers our OCR can't read; undefined for slides
      onAiScan: () => onProgress?.({ stage: "ai-scan", paper: file.name }),
      name: file.name, // for actionable not-a-PDF errors
    });
    return { text, ocr: method === "ocr" };
  }
  onProgress?.({ stage: "ocr", paper: file.name, done: 0, total: 1 });
  return { text: await ocrImage(file), ocr: true };
}

// `aiGroup(items, chapters)` is an optional async grouper (the signed-in LLM
// path); if it throws we fall back to the in-browser embedding grouping.
export async function analyze(paperFiles, { onProgress, slideFiles, assignmentFiles, aiGroup, aiScan } = {}) {
  const items = [];
  const papers = [];
  const skipped = []; // papers we couldn't read or that yielded no questions

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
    let failDetail = null;
    try {
      for (const file of pages) {
        const { text: t, ocr } = await readPage(file, onProgress, aiScan);
        text += t + "\n";
        usedOcr = usedOcr || ocr;
      }
    } catch (e) {
      failed = true;
      failDetail = e.message;
      onProgress?.({ stage: "paper-skipped", paper: name, reason: e.message });
    }

    const { meta, questions } = failed ? { meta: {}, questions: [] } : parsePaper(text);
    const paperId = `${meta.session ?? meta.examType ?? "Paper"} ${meta.year ?? i + 1}`.trim();
    papers.push({ pages: pages.length, ...meta, name, method: failed ? "failed" : usedOcr ? "ocr" : "text", count: questions.length });
    // pIdx (paper index) = which uploaded paper a question came from.
    for (const q of questions) items.push({ ...q, paperId, year: meta.year, pIdx: i });
    if (failed || questions.length === 0) skipped.push({ name, reason: failed ? "unreadable" : "no-questions", detail: failDetail });
    // Papers that come WITH solutions are analysed normally and silently — the
    // model answers are stripped to question stems (parsePaper.cleanText), so a
    // solution-bearing PYQ just works; we never warn or block on it.

    onProgress?.({ stage: "extracted", index: i, total: paperFiles.length, questions: items.length });
  }

  // Assignment questions (optional): teacher-flagged "important question" lists.
  // Parsed like papers but tagged `assignment: true`, so rank.js MERGES them into
  // the topic groups, badges them, and boosts their ranking — without counting
  // them as exams. A bad assignment file is skipped silently (it's supplementary,
  // so it never triggers the no-partial-result rollback below).
  let assignmentCount = 0;
  for (let a = 0; a < (assignmentFiles?.length || 0); a++) {
    const file = assignmentFiles[a];
    onProgress?.({ stage: "reading", paper: file?.name || `Assignment ${a + 1}`, index: a, total: assignmentFiles.length });
    try {
      const { text } = await readPage(file, onProgress, aiScan);
      const { questions } = parsePaper(text);
      for (const q of questions) items.push({ ...q, paperId: "Assignment", year: null, pIdx: 1000 + a, assignment: true });
      assignmentCount += questions.length;
    } catch (e) { console.error("assignment file skipped:", file?.name, e); }
  }

  if (items.length === 0) {
    throw new Error(
      skipped.every((s) => s.reason === "unreadable")
        ? "We couldn't read those files — they may be corrupt, password-protected, or an unsupported format."
        : "We couldn't find any questions in those papers. If they're scanned images, try clearer scans, or check they're exam papers."
    );
  }

  // Don't return a PARTIAL result: if ANY uploaded paper couldn't be scanned
  // (unreadable, or no questions could be read from it), stop and send the user
  // back to re-upload a clearer copy rather than silently dropping it. Better an
  // honest "couldn't read X" than a result that's quietly missing a paper.
  if (skipped.length > 0) {
    // A not-a-PDF upload (e.g. a portal's HTML page saved as .pdf) carries its
    // own actionable message — surface that instead of the generic blurry-scan
    // advice, which would mislead ("re-scan" can't fix a corrupt download).
    const notPdf = skipped.find((s) => s.detail && /isn't a re(al|adable) PDF/i.test(s.detail));
    if (notPdf) throw new Error(notPdf.detail);
    const names = skipped.map((s) => s.name).join(", ");
    const one = skipped.length === 1;
    // If the sharper AI scan wasn't available (not signed in), point them to it.
    const aiHint = aiScan ? "" : " — or sign in to use the sharper AI scan";
    throw new Error(`Couldn't scan ${one ? "this paper" : "these papers"}: ${names}. The scan looks too blurry or low-contrast to read reliably — try a clearer scan or photo${one ? "" : " (or remove it)"}${aiHint}, then upload again.`);
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
  let aiError = null; // set when AI grouping was attempted but failed (we then fell back)
  if (aiGroup) {
    try {
      clusters = await aiGroup(items, chapters);
    } catch (e) {
      aiError = e.message || "ai-failed";
      onProgress?.({ stage: "ai-fallback", error: aiError });
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
    assignmentCount, // questions merged in from uploaded assignment lists (badged + boosted)
    topicCount,
    skipped, // [{ name, reason }] — papers that were unreadable or had no questions
    aiError, // null, or the reason AI grouping fell back to basic grouping (e.g. "group api 429")
  };
}
