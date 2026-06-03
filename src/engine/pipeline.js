// Orchestrates the whole analysis: PDF files -> ranked repeated questions.
// Reports progress through `onProgress({ stage, ... })` so the loading screen
// can show what's happening. Stages: reading, ocr, extracted, clustering,
// ranking.
import { extractText } from "./extractText.js";
import { parsePaper } from "./parsePaper.js";
import { clusterQuestions } from "./cluster.js";
import { rankClusters } from "./rank.js";

export async function analyze(files, { onProgress } = {}) {
  const items = [];
  const papers = [];

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    onProgress?.({ stage: "reading", paper: file.name, index: i, total: files.length });

    let text, method;
    try {
      const buf = new Uint8Array(await file.arrayBuffer());
      ({ text, method } = await extractText(buf, {
        onOcrProgress: (done, total) =>
          onProgress?.({ stage: "ocr", paper: file.name, done, total }),
      }));
    } catch (e) {
      throw new Error(`Reading "${file.name}" failed: ${e.message}`);
    }

    const { meta, questions } = parsePaper(text);
    const paperId = `${meta.session ?? meta.examType ?? "Paper"} ${meta.year ?? ""}`.trim();
    papers.push({ name: file.name, ...meta, method, count: questions.length });
    for (const q of questions) items.push({ ...q, paperId, year: meta.year });

    onProgress?.({ stage: "extracted", index: i, total: files.length, questions: items.length });
  }

  onProgress?.({ stage: "clustering", questions: items.length });
  let clusters;
  try {
    clusters = await clusterQuestions(items);
  } catch (e) {
    throw new Error(`Grouping (AI model) failed: ${e.message}`);
  }

  onProgress?.({ stage: "ranking" });
  const { ranked, unique, clusters: enriched } = rankClusters(clusters);

  return {
    papers,
    ranked,
    unique,
    clusters: enriched,
    questionCount: items.length,
    paperCount: files.length,
  };
}
