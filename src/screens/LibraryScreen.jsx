// Subject library browse screen: a grid of pre-analysed subjects students can
// open instantly (no upload). Data comes from public/library/index.json.
import React from "react";
import { C, hexA } from "../theme.js";
import { IconArrow, IconUpload, IconLayers } from "../components/icons.jsx";
import { Tag, PrimaryButton, FloatField } from "../components/atoms.jsx";
import { useIsMobile } from "../useIsMobile.js";
import { loadLibraryIndex } from "../engine/library.js";

function SubjectCard({ s, onOpen }) {
  const [hover, setHover] = React.useState(false);
  return (
    <div onClick={() => onOpen(s.id)} onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      style={{
        background: "#fff", border: `1px solid ${hover ? hexA(C.primary, 0.5) : C.line}`, borderRadius: 16,
        padding: 20, cursor: "pointer", boxShadow: hover ? "0 8px 24px rgba(63,81,196,0.14)" : C.shadowSm,
        transition: "border-color .15s, box-shadow .15s, transform .15s", transform: hover ? "translateY(-2px)" : "none",
        display: "flex", flexDirection: "column", gap: 12, minWidth: 0,
      }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontFamily: C.font, fontWeight: 600, fontSize: 17, color: C.ink, lineHeight: 1.3, textWrap: "pretty" }}>{s.subject}</div>
          {s.code && <div style={{ fontFamily: C.font, fontSize: 12.5, color: C.faint, marginTop: 2 }}>{s.code}</div>}
        </div>
        <div style={{ width: 38, height: 38, flex: "0 0 auto", borderRadius: 11, background: C.primarySoft, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <IconLayers s={18} c={C.primary} />
        </div>
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
        <Tag>{s.paperCount} papers</Tag>
        <Tag>{s.questionCount} questions</Tag>
        <Tag tone="primary">{s.topicCount} topics</Tag>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 6, fontFamily: C.font, fontSize: 13.5, fontWeight: 600, color: C.primary, marginTop: 2 }}>
        Open <IconArrow s={16} />
      </div>
    </div>);
}

export default function LibraryScreen({ onOpen, onUpload }) {
  const [subjects, setSubjects] = React.useState(null); // null = loading
  const isMobile = useIsMobile();

  React.useEffect(() => {
    let cancelled = false;
    loadLibraryIndex().then((s) => { if (!cancelled) setSubjects(s); });
    return () => { cancelled = true; };
  }, []);

  return (
    <div style={{ position: "relative", flex: 1, minHeight: 0, overflowY: "auto" }}>
      <FloatField />
      <div style={{ position: "relative", zIndex: 1, maxWidth: 940, margin: "0 auto", padding: isMobile ? "34px 18px 48px" : "48px 32px 60px" }}>
        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 16, flexWrap: "wrap", marginBottom: 26 }}>
          <div>
            <h1 style={{ fontFamily: C.font, fontWeight: 700, fontSize: isMobile ? 28 : 38, color: C.ink, letterSpacing: -0.5, margin: 0 }}>Subject library</h1>
            <p style={{ fontFamily: C.font, fontSize: isMobile ? 14.5 : 16, color: C.muted, margin: "10px 0 0", maxWidth: 460, lineHeight: 1.5 }}>
              Pick a subject to instantly see its important, repeated questions — already analysed for you.
            </p>
          </div>
          <PrimaryButton onClick={onUpload}><IconUpload s={17} /> Upload your own</PrimaryButton>
        </div>

        {subjects === null
          ? <div style={{ fontFamily: C.font, color: C.muted, padding: "40px 0", textAlign: "center" }}>Loading subjects…</div>
          : subjects.length === 0
            ? <div style={{ fontFamily: C.font, color: C.muted, background: "#fff", border: `1px solid ${C.line}`, borderRadius: 16, padding: "28px 24px", textAlign: "center", lineHeight: 1.6 }}>
                No subjects in the library yet.<br /><span style={{ fontSize: 13.5, color: C.faint }}>Upload papers and use “Save to library” to add one.</span>
              </div>
            : <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(auto-fill, minmax(260px, 1fr))", gap: 16 }}>
                {subjects.map((s) => <SubjectCard key={s.id} s={s} onOpen={onOpen} />)}
              </div>}
      </div>
    </div>);
}
