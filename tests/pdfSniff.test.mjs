// Tests for the not-actually-a-PDF sniffer (portal HTML saved as .pdf, junk-
// prefixed PDFs, corrupt files).
import { test } from "node:test";
import assert from "node:assert/strict";
import { sniffPdf, notPdfMessage } from "../src/engine/pdfSniff.js";

const bytes = (s) => new TextEncoder().encode(s);

test("a normal PDF sniffs as pdf at offset 0", () => {
  assert.deepEqual(sniffPdf(bytes("%PDF-1.7\n1 0 obj\n<<>>\nendobj")), { kind: "pdf", offset: 0 });
});

test("a junk-prefixed PDF reports the real header offset (recoverable)", () => {
  const r = sniffPdf(bytes("JUNKJUNKJUNK%PDF-1.4\nrest of file"));
  assert.equal(r.kind, "pdf");
  assert.equal(r.offset, 12);
});

test("an HTML page saved as .pdf sniffs as html (the failed-portal-download case)", () => {
  const html = `\n<html xmlns="http://www.w3.org/1999/xhtml">\n<head id="Head1"><title></title></head>\n<body>...</body></html>`;
  assert.equal(sniffPdf(bytes(html)).kind, "html");
  assert.equal(sniffPdf(bytes("<!DOCTYPE html><html><body>x</body></html>")).kind, "html");
});

test("random binary junk sniffs as unknown", () => {
  assert.equal(sniffPdf(new Uint8Array([0, 1, 2, 3, 255, 254, 77, 90])).kind, "unknown");
});

test("plain ArrayBuffer input works too", () => {
  const u8 = bytes("%PDF-1.5\n");
  assert.equal(sniffPdf(u8.buffer).kind, "pdf");
});

test("messages are actionable and name the file", () => {
  assert.match(notPdfMessage("html", "coa.pdf"), /"coa\.pdf".*saved web page.*Re-download/is);
  assert.match(notPdfMessage("unknown", "x.pdf"), /corrupt|unsupported/i);
});
