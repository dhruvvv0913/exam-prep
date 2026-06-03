// Dev-only: A/B compare embedding models (with the keyword-guard clustering)
// on the Industry 4.0 2024 + 2025 questions. Downloads candidates from HF.
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { readFileSync } from "node:fs";
import { env } from "@xenova/transformers";
import { parsePaper } from "../src/engine/parsePaper.js";
import { embed, clusterVectors } from "../src/engine/cluster.js";

// In Node we download candidates from HF (the browser stays self-hosted).
env.allowRemoteModels = true;
env.allowLocalModels = false;

const Y2024 = [
  ["q1a", "Is Industry 4.0 going to be the smart factory and the future of automation? Which design concepts enable us to look into the possibility of an Industry 4.0 technology transition?"],
  ["q1b", "State the basic difference between Machine Learning and Deep learning. How machine learning (ML) field has deeply impacted the manufacturing industry in the context of the Industry 4.0 paradigm"],
  ["q2a", "Describe blockchain technology and its fundamental principles of operation."],
  ["q2b", "What are the key challenges in integrating cyber physics with the physical world? How can cyber physics enhance the field of robotics?"],
  ["q3a", "What are the deployment models of cloud computing model? How does a hybrid cloud work and benefit the businesses?"],
  ["q3b", "State the concept of AR and VR. What are the Obstacles that developers face when producing AR/VR Content, and How can these be overcome?"],
  ["q4a", "Explain Artificial intelligence, Machine Learning, and Deep Learning differ from each other with respect to their application."],
  ["q4b", "Differentiate between conventional manufacturing and additive manufacturing. Explain briefly about the role of additive technology in Architectural Designs Firm."],
  ["q5a", "Compare the differences between of IOT, IIOT and M2M. Explain about M2M architecture."],
  ["q5b", "What are the key privacy and security considerations when collecting and managing patient data with IoT devices in healthcare settings?"],
  ["q6a", "What is a Value Chain analysis? Explain how growth in agriculture industry follow the concept of value chain to have the profit."],
  ["q6b", "Justify is there any benefit for supply chain management combine with a Digital Twin. Explain the major areas where industries apply the concept of digital twins."],
  ["q7a", "Explain in brief the top challenges that face factories when they adopt industry 4.0 technology? State examples of some Indian companies that have successfully implemented industry 4.0 in their organization/enterprise?"],
  ["q7b", "How do you create the conceptual model for Industry 4.0 that addresses the challenges of the implementation framework, the opportunity for the future, and the financial impact of a country?"],
];

async function extract(path) {
  const doc = await getDocument({ data: new Uint8Array(readFileSync(path)), useSystemFonts: true }).promise;
  let out = "";
  for (let p = 1; p <= doc.numPages; p++) {
    const content = await (await doc.getPage(p)).getTextContent();
    let line = "", lastY = null; const lines = [];
    for (const it of content.items) {
      const y = it.transform[5];
      if (lastY !== null && Math.abs(y - lastY) > 2) { lines.push(line); line = ""; }
      line += it.str;
      if (it.hasEOL) { lines.push(line); line = ""; lastY = null; } else lastY = y;
    }
    if (line) lines.push(line);
    out += lines.join("\n") + "\n";
  }
  return out;
}

const items = Y2024.map(([id, text]) => ({ id, text, paperId: "2024" }));
for (const q of parsePaper(await extract("C:/Users/KIIT/Downloads/spring end 2025.pdf")).questions)
  items.push({ ...q, paperId: "2025" });

const CANDIDATES = [
  { modelId: "Xenova/bge-small-en-v1.5", pooling: "cls", sweep: [0.70, 0.72, 0.74] },
];

const detail = process.argv.includes("--detail");

for (const cand of CANDIDATES) {
  console.log(`\n################## ${cand.modelId} ##################`);
  const vecs = await embed(items.map((i) => i.text), cand);
  for (const threshold of cand.sweep) {
    const clusters = clusterVectors(items, vecs, { threshold, strong: threshold + 0.17 });
    const repeats = clusters.filter((c) => new Set(c.items.map((i) => i.paperId)).size >= 2);
    const maxSize = Math.max(...clusters.map((c) => c.items.length));
    const cleanRepeats = repeats.filter((c) => c.items.length <= 4).length; // small = likely clean
    console.log(`  t=${threshold}: repeats=${repeats.length}  clean(<=4)=${cleanRepeats}  biggestCluster=${maxSize}`);
    if (detail) for (const c of repeats) console.log("       • " + c.items.map((i) => `${i.paperId}:${i.id}`).join(" "));
  }
}
