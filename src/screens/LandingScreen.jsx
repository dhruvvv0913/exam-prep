// Landing screen: animated hero + upload. "Previous year papers" supports
// multi-page papers — each uploaded file starts its own paper, and you can add
// more pages to a paper or merge papers together (so a paper split across
// several screenshots counts as ONE exam). Handouts stay a simple file list.
import React from "react";
import { C, hexA } from "../theme.js";
import { IconUpload, IconFile, IconCheck, IconArrow, IconPlus, IconSparkle, IconClose } from "../components/icons.jsx";
import { Tag, PrimaryButton, FloatField } from "../components/atoms.jsx";
import { useIsMobile } from "../useIsMobile.js";

const ACCEPT = ".pdf,.png,.jpg,.jpeg,.webp,image/*";
const acceptedFiles = (list) => Array.from(list || []).filter((f) => /\.(pdf|png|jpe?g|webp)$/i.test(f.name));
const newId = () => "p" + Math.random().toString(36).slice(2, 9);

function FileChip({ name, accent, onRemove }) {
  const col = accent ? C.primary : C.ink2;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 9px 6px 11px", borderRadius: 9, background: accent ? C.primarySoft : "#f1f2f8", border: `1px solid ${accent ? hexA(C.primary, 0.2) : C.line}`, maxWidth: "100%" }}>
      <IconFile s={14} c={col} />
      <span style={{ fontFamily: C.font, fontSize: 12.5, color: C.ink, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 150 }}>{name}</span>
      <IconCheck s={12} c={accent ? C.primary : C.good} sw={2.4} />
      <button onClick={(e) => { e.stopPropagation(); onRemove(); }} style={{ background: "none", border: "none", padding: 2, cursor: "pointer", display: "flex" }}><IconClose s={13} c={C.faint} /></button>
    </div>);
}

// One paper = an ordered set of page files, with its own "add page" input.
function PaperCard({ index, paper, others, onAddPages, onRemovePage, onRemovePaper, onMerge }) {
  const inputRef = React.useRef(null);
  return (
    <div style={{ background: "#fff", border: `1px solid ${hexA(C.primary, 0.25)}`, borderRadius: 12, padding: 12, textAlign: "left" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 9 }}>
        <span style={{ fontFamily: C.font, fontWeight: 600, fontSize: 13.5, color: C.ink }}>Paper {index + 1}</span>
        {paper.pages.length > 1 && <Tag tone="primary">{paper.pages.length} pages</Tag>}
        <div style={{ flex: 1 }} />
        {others.length > 0 &&
          <select value="" onChange={(e) => e.target.value && onMerge(paper.id, e.target.value)}
            title="Combine this paper's pages into another paper"
            style={{ fontFamily: C.font, fontSize: 12, color: C.ink2, padding: "4px 6px", borderRadius: 7, border: `1px solid ${C.line}`, background: "#fff", cursor: "pointer" }}>
            <option value="">Merge into…</option>
            {others.map((o) => <option key={o.id} value={o.id}>Paper {o.index + 1}</option>)}
          </select>}
        <button onClick={() => onRemovePaper(paper.id)} title="Remove paper" style={{ background: "none", border: "none", padding: 3, cursor: "pointer", display: "flex" }}><IconClose s={15} c={C.faint} /></button>
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 7, alignItems: "center" }}>
        {paper.pages.map((f, i) => <FileChip key={f.name + i} name={f.name} accent onRemove={() => onRemovePage(paper.id, i)} />)}
        <input ref={inputRef} type="file" accept={ACCEPT} multiple style={{ display: "none" }}
          onChange={(e) => { const fs = acceptedFiles(e.target.files); if (fs.length) onAddPages(paper.id, fs); e.target.value = ""; }} />
        <button onClick={() => inputRef.current?.click()} style={{ fontFamily: C.font, fontSize: 12.5, fontWeight: 600, color: C.primary, background: C.primarySoft, border: "none", borderRadius: 8, padding: "6px 10px", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 4 }}>
          <IconPlus s={13} c={C.primary} /> page
        </button>
      </div>
    </div>);
}

// Required zone: a list of papers (each with one or more pages).
function PapersZone({ papers, setPapers }) {
  const inputRef = React.useRef(null);
  const [drag, setDrag] = React.useState(false);
  const has = papers.length > 0;

  const addNewPapers = (files) => setPapers((p) => [...p, ...files.map((f) => ({ id: newId(), pages: [f] }))]);
  const addPagesTo = (id, files) => setPapers((p) => p.map((pp) => (pp.id === id ? { ...pp, pages: [...pp.pages, ...files] } : pp)));
  const removePage = (id, idx) => setPapers((p) => p.map((pp) => (pp.id === id ? { ...pp, pages: pp.pages.filter((_, j) => j !== idx) } : pp)).filter((pp) => pp.pages.length > 0));
  const removePaper = (id) => setPapers((p) => p.filter((pp) => pp.id !== id));
  const mergePaper = (srcId, targetId) => setPapers((p) => {
    const src = p.find((x) => x.id === srcId);
    if (!src || srcId === targetId) return p;
    return p.map((x) => (x.id === targetId ? { ...x, pages: [...x.pages, ...src.pages] } : x)).filter((x) => x.id !== srcId);
  });

  const pick = (e) => { const fs = acceptedFiles(e.target.files); if (fs.length) addNewPapers(fs); e.target.value = ""; };
  const drop = (e) => { e.preventDefault(); setDrag(false); const fs = acceptedFiles(e.dataTransfer.files); if (fs.length) addNewPapers(fs); };

  return (
    <div onDragOver={(e) => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)} onDrop={drop}
      style={{ flex: 1, minWidth: 280, background: drag ? hexA(C.primary, 0.05) : "#fff", borderRadius: 18, border: `2px dashed ${drag ? C.primary : (has ? hexA(C.primary, 0.45) : "#cfd3e6")}`, padding: 22, display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", gap: 12, boxShadow: has ? C.shadowMd : C.shadowSm }}>
      <input ref={inputRef} type="file" accept={ACCEPT} multiple onChange={pick} style={{ display: "none" }} />
      <div style={{ width: 50, height: 50, borderRadius: 14, background: C.primarySoft, display: "flex", alignItems: "center", justifyContent: "center" }}><IconUpload s={25} c={C.primary} /></div>
      <div style={{ fontFamily: C.font, fontWeight: 600, fontSize: 17, color: C.ink }}>Previous year papers</div>
      <Tag tone="primary">★ required to start</Tag>

      {has
        ? <div style={{ display: "flex", flexDirection: "column", gap: 10, width: "100%" }}>
            {papers.map((paper, i) => (
              <PaperCard key={paper.id} index={i} paper={paper}
                others={papers.map((o, j) => ({ id: o.id, index: j })).filter((o) => o.id !== paper.id)}
                onAddPages={addPagesTo} onRemovePage={removePage} onRemovePaper={removePaper} onMerge={mergePaper} />
            ))}
          </div>
        : <div style={{ fontFamily: C.font, fontSize: 13.5, color: C.muted, lineHeight: 1.5 }}>Drag &amp; drop PDFs or screenshots here.<br /><span style={{ fontSize: 12.5, color: C.faint }}>Each file starts a paper · add pages or merge for multi-page papers</span></div>}

      <button onClick={() => inputRef.current?.click()} style={{ fontFamily: C.font, fontSize: 13.5, fontWeight: 600, padding: "9px 18px", borderRadius: 10, cursor: "pointer", color: C.primary, background: "#fff", border: `1px solid ${hexA(C.primary, 0.4)}`, display: "inline-flex", alignItems: "center", gap: 6 }}>
        {has ? <React.Fragment><IconPlus s={14} c={C.primary} /> Add paper</React.Fragment> : "Browse files"}
      </button>
    </div>);
}

// Optional zone: a simple flat list of handout files.
function HandoutsZone({ files, onAdd, onRemove }) {
  const inputRef = React.useRef(null);
  const [drag, setDrag] = React.useState(false);
  const has = files.length > 0;
  const pick = (e) => { const fs = acceptedFiles(e.target.files); if (fs.length) onAdd(fs); e.target.value = ""; };
  const drop = (e) => { e.preventDefault(); setDrag(false); const fs = acceptedFiles(e.dataTransfer.files); if (fs.length) onAdd(fs); };
  return (
    <div onDragOver={(e) => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)} onDrop={drop}
      style={{ flex: 1, minWidth: 280, background: drag ? hexA(C.primary, 0.05) : "#fff", borderRadius: 18, border: `2px dashed ${drag ? C.primary : (has ? hexA(C.good, 0.45) : "#cfd3e6")}`, padding: 22, display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", gap: 12, boxShadow: has ? C.shadowMd : C.shadowSm }}>
      <input ref={inputRef} type="file" accept={ACCEPT} multiple onChange={pick} style={{ display: "none" }} />
      <div style={{ width: 50, height: 50, borderRadius: 14, background: "#f1f2f8", display: "flex", alignItems: "center", justifyContent: "center" }}><IconUpload s={25} c={C.ink2} /></div>
      <div style={{ fontFamily: C.font, fontWeight: 600, fontSize: 17, color: C.ink }}>Course slides &amp; handouts</div>
      <Tag tone="good">optional · groups by your real slide topics</Tag>
      {has
        ? <div style={{ display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "center", width: "100%" }}>
            {files.map((f, i) => <FileChip key={f.name + i} name={f.name} onRemove={() => onRemove(i)} />)}
          </div>
        : <div style={{ fontFamily: C.font, fontSize: 13.5, color: C.muted, lineHeight: 1.5 }}>Drop your lecture slide PDFs here.<br /><span style={{ fontSize: 12.5, color: C.faint }}>We read the slide titles and group questions under them</span></div>}
      <button onClick={() => inputRef.current?.click()} style={{ fontFamily: C.font, fontSize: 13.5, fontWeight: 600, padding: "9px 18px", borderRadius: 10, cursor: "pointer", color: C.ink2, background: "#fff", border: `1px solid ${C.line}`, display: "inline-flex", alignItems: "center", gap: 6 }}>
        {has ? <React.Fragment><IconPlus s={14} c={C.ink2} /> Add more</React.Fragment> : "Browse files"}
      </button>
    </div>);
}

export default function LandingScreen({ papers, handouts, setPapers, setHandouts, onStart, onBrowse, auth, useAi, setUseAi }) {
  const isMobile = useIsMobile();
  const ready = papers.length > 0;
  const pageCount = papers.reduce((n, p) => n + p.pages.length, 0) + handouts.length;

  const addHandouts = (fs) => setHandouts((h) => [...h, ...fs]);
  const removeHandout = (i) => setHandouts((h) => h.filter((_, j) => j !== i));

  return (
    <div style={{ position: "relative", flex: 1, minHeight: 0, overflowY: "auto" }}>
      <FloatField />
      <div style={{ position: "relative", zIndex: 1, maxWidth: 880, margin: "0 auto", padding: isMobile ? "34px 20px 48px" : "52px 32px 60px", display: "flex", flexDirection: "column", alignItems: "center" }}>
        <div style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "6px 14px", borderRadius: 999, background: "#fff", border: `1px solid ${C.line}`, boxShadow: C.shadowSm, marginBottom: 22 }}>
          <IconSparkle s={15} c={C.primary} />
          <span style={{ fontFamily: C.font, fontSize: 13, fontWeight: 500, color: C.ink2 }}>Find the questions that actually repeat</span>
        </div>
        <h1 style={{ fontFamily: C.font, fontWeight: 700, fontSize: isMobile ? 32 : 46, lineHeight: 1.08, textAlign: "center", color: C.ink, letterSpacing: -1, margin: 0 }}>
          Upload. Learn.<br /><span style={{ background: C.grad, WebkitBackgroundClip: "text", backgroundClip: "text", WebkitTextFillColor: "transparent" }}>Ace the exam.</span>
        </h1>
        <p style={{ fontFamily: C.font, fontSize: isMobile ? 15 : 17, lineHeight: 1.55, color: C.muted, textAlign: "center", maxWidth: 470, margin: "16px 0 20px", textWrap: "pretty" }}>
          Drop in your past exam papers and we'll surface the questions that come back year after year — ranked by how often they repeat.
        </p>
        <div style={{ display: "flex", gap: 9, flexWrap: "wrap", justifyContent: "center", marginBottom: 34 }}>
          {["100% free", "No sign-up to start", "Runs in your browser"].map((t) => (
            <span key={t} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "6px 12px", borderRadius: 999, background: "#fff", border: `1px solid ${C.line}`, boxShadow: C.shadowSm, fontFamily: C.font, fontSize: 12.5, fontWeight: 500, color: C.ink2 }}>
              <IconCheck s={11} c={C.good} sw={2.8} /> {t}
            </span>))}
        </div>

        <div style={{ display: "flex", gap: 20, width: "100%", marginBottom: 30, alignItems: "flex-start", flexWrap: "wrap" }}>
          <PapersZone papers={papers} setPapers={setPapers} />
          <HandoutsZone files={handouts} onAdd={addHandouts} onRemove={removeHandout} />
        </div>

        <PrimaryButton size="lg" disabled={!ready} glow={ready} onClick={onStart}>
          Start learning <IconArrow s={19} />
        </PrimaryButton>
        <div style={{ fontFamily: C.font, fontSize: 13, color: C.faint, marginTop: 14, minHeight: 18 }}>
          {ready ? `${papers.length} paper${papers.length > 1 ? "s" : ""} · ${pageCount} file${pageCount > 1 ? "s" : ""} ready — we'll analyse next` : "Add at least one past paper to begin"}
        </div>

        {/* AI grouping: signed-in users get the smarter LLM grouping (toggle);
            visitors see a nudge. Hidden entirely when auth isn't configured. */}
        {auth?.enabled && (auth.user
          ? <button onClick={() => setUseAi((v) => !v)} title="AI grouping uses a smarter model for more accurate topics; falls back automatically if unavailable"
              style={{ marginTop: 12, display: "inline-flex", alignItems: "center", gap: 8, padding: "8px 14px", borderRadius: 999, cursor: "pointer", fontFamily: C.font, fontSize: 13, fontWeight: 600, border: `1px solid ${useAi ? hexA(C.primary, 0.4) : C.line}`, background: useAi ? C.primarySoft : "#fff", color: useAi ? C.primary : C.muted }}>
              <IconSparkle s={14} c={useAi ? C.primary : C.muted} /> AI grouping {useAi ? "on" : "off"}
              <span style={{ width: 30, height: 16, borderRadius: 999, background: useAi ? C.primary : "#d3d6e6", position: "relative", flex: "0 0 auto" }}>
                <span style={{ position: "absolute", top: 2, left: useAi ? 16 : 2, width: 12, height: 12, borderRadius: "50%", background: "#fff", transition: "left .2s" }} />
              </span>
            </button>
          : <button onClick={auth.signInWithGoogle}
              style={{ marginTop: 12, display: "inline-flex", alignItems: "center", gap: 7, padding: "8px 14px", borderRadius: 999, cursor: "pointer", fontFamily: C.font, fontSize: 13, fontWeight: 600, border: `1px solid ${hexA(C.primary, 0.35)}`, background: C.primarySoft, color: C.primary }}>
              <IconSparkle s={14} c={C.primary} /> Sign in for sharper AI grouping
            </button>)}
        {onBrowse && (
          <button onClick={onBrowse} style={{ marginTop: 18, fontFamily: C.font, fontSize: 14, fontWeight: 500, color: C.primary, background: "none", border: "none", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6 }}>
            or browse the subject library <IconArrow s={16} c={C.primary} />
          </button>
        )}
      </div>
    </div>);
}
