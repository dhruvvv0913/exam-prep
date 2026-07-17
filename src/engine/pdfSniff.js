// Sniff whether an uploaded "PDF" is actually a PDF — and if not, say what it
// really is so the user gets an actionable error instead of a generic
// "unreadable". The classic failure: a paper "downloaded" from a college
// portal / an intercepting campus network is really the portal's HTML page
// saved with a .pdf name (we've seen a 13 KB CourseSelect.aspx login page
// masquerading as a COA paper). pdf.js then throws an opaque
// "Invalid PDF structure." Pure + Node-safe, unit-tested.
//
// Returns:
//   { kind: "pdf", offset: 0 }        — a normal PDF
//   { kind: "pdf", offset: N }        — a PDF with N junk bytes prepended
//                                       (slice the buffer from N and pdf.js
//                                       can usually open it)
//   { kind: "html" }                  — an HTML page saved as .pdf
//   { kind: "unknown" }               — not a PDF at all
export function sniffPdf(data) {
  const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);
  // "%PDF-" anywhere in the first 8 KB (real headers sit at 0; wrapped/junk-
  // prefixed ones a little further in).
  const MAGIC = [0x25, 0x50, 0x44, 0x46, 0x2d]; // %PDF-
  const limit = Math.min(bytes.length - MAGIC.length, 8192);
  for (let i = 0; i <= limit; i++) {
    let hit = true;
    for (let j = 0; j < MAGIC.length; j++) {
      if (bytes[i + j] !== MAGIC[j]) { hit = false; break; }
    }
    if (hit) return { kind: "pdf", offset: i };
  }
  // No PDF header — is it an HTML page? (whitespace/BOM then "<!doctype"/"<html",
  // or an html/head/body tag early on)
  const head = String.fromCharCode(...bytes.slice(0, 512)).toLowerCase();
  if (/^\s*(?:﻿)?\s*<(?:!doctype\s+html|html|head|body)\b/.test(head) || /<html[\s>]/.test(head)) {
    return { kind: "html" };
  }
  return { kind: "unknown" };
}

// The user-facing explanation for a non-PDF upload, shared by extractText (so
// the rollback banner says something actionable).
export function notPdfMessage(kind, name) {
  const label = name ? `"${name}"` : "This file";
  return kind === "html"
    ? `${label} isn't a real PDF — it's a saved web page (the download from the portal probably failed and saved its login page instead). Re-download the paper and upload again.`
    : `${label} isn't a readable PDF — the file looks corrupt or in an unsupported format. Try re-downloading or re-exporting it.`;
}
