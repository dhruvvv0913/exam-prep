// Orchestrates the whole analysis: uploaded papers -> ranked repeated questions.
// `paperFiles` is an array of papers, each itself an array of page files (so a
// multi-page paper = several images/PDFs that get concatenated into one paper).
// Reports progress through `onProgress({ stage, ... })` for the loading screen.
// Stages: reading, ocr, extracted, clustering, ranking.
import { extractText } from "./extractText.js";
import { ocrImage } from "./ocr.js";
import { parsePaper } from "./parsePaper.js";
import { clusterQuestions, anchorQuestions } from "./cluster.js";
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

export async function analyze(paperFiles, { onProgress, slideFiles } = {}) {
  const items = [];
  const papers = [];

  for (let i = 0; i < paperFiles.length; i++) {
    const pages = paperFiles[i];
    onProgress?.({ stage: "reading", paper: pages[0]?.name, index: i, total: paperFiles.length });

    // Concatenate every page of this paper into one text blob.
    let text = "";
    let usedOcr = false;
    try {
      for (const file of pages) {
        const { text: t, ocr } = await readPage(file, onProgress);
        text += t + "\n";
        usedOcr = usedOcr || ocr;
      }
    } catch (e) {
      throw new Error(`Reading paper ${i + 1} failed: ${e.message}`);
    }

    const { meta, questions } = parsePaper(text);
    const paperId = `${meta.session ?? meta.examType ?? "Paper"} ${meta.year ?? i + 1}`.trim();
    papers.push({ pages: pages.length, ...meta, method: usedOcr ? "ocr" : "text", count: questions.length });
    // pIdx (paper index) = which uploaded paper a question came from.
    for (const q of questions) items.push({ ...q, paperId, year: meta.year, pIdx: i });

    onProgress?.({ stage: "extracted", index: i, total: paperFiles.length, questions: items.length });
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

  onProgress?.({ stage: "clustering", questions: items.length, anchored: topics.length > 0 });
  let clusters;
  try {
    clusters = topics.length ? await anchorQuestions(items, topics, { deckOf }) : await clusterQuestions(items);
  } catch (e) {
    throw new Error(`Grouping (AI model) failed: ${e.message}`);
  }

  onProgress?.({ stage: "ranking" });
  const groups = groupsFromClusters(clusters); // editable source of truth

  return {
    papers,
    groups,
    questionCount: items.length,
    paperCount: paperFiles.length,
    topicCount,
  };
}
