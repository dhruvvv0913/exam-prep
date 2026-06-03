// Dev-only PROOF: cluster real Industry 4.0 2024 questions (typed from the
// scanned paper) against the auto-parsed 2025 paper, to show the engine finds
// repeated concepts across years. The 2024 paper is image-only, so OCR (a later
// phase) will replace this typed fixture.
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { readFileSync } from "node:fs";
import { parsePaper } from "../src/engine/parsePaper.js";
import { clusterQuestions } from "../src/engine/cluster.js";

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
  const data = new Uint8Array(readFileSync(path));
  const doc = await getDocument({ data, useSystemFonts: true }).promise;
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

const items = Y2024.map(([id, text]) => ({ id, text, paperId: "Spring 2024", year: 2024 }));
const p2025 = parsePaper(await extract("C:/Users/KIIT/Downloads/spring end 2025.pdf"));
for (const q of p2025.questions) items.push({ ...q, paperId: "Spring 2025", year: 2025 });

const threshold = Number(process.argv[2]) || 0.5;
console.log(`Clustering ${items.length} questions (2024 + 2025) @ threshold ${threshold}...\n`);
const clusters = await clusterQuestions(items, threshold);
const ranked = clusters
  .map((c) => ({ c, papers: new Set(c.items.map((i) => i.paperId)).size }))
  .sort((a, b) => b.papers - a.papers || b.c.items.length - a.c.items.length);

console.log("=== CONCEPTS THAT REPEAT ACROSS 2024 & 2025 ===");
for (const { c, papers } of ranked) {
  if (papers < 2) continue;
  console.log(`\n• REPEATS (${papers} years):`);
  for (const it of c.items) console.log(`    [${it.paperId} ${it.id}] ${it.text.slice(0, 80)}`);
}
console.log("\n=== asked once (low priority) ===");
console.log(ranked.filter((r) => r.papers < 2).length + " single-occurrence clusters");
