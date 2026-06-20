// Landing screen: animated hero + upload. "Previous year papers" supports
// multi-page papers — each uploaded file starts its own paper, and you can add
// more pages to a paper or merge papers together (so a paper split across
// several screenshots counts as ONE exam). Handouts stay a simple file list.
import React from "react";
import { C, hexA } from "../theme.js";
import { IconUpload, IconFile, IconCheck, IconArrow, IconPlus, IconSparkle, IconClose } from "../components/icons.jsx";
import { Tag, PrimaryButton, FloatField } from "../components/atoms.jsx";
import Tip from "../components/Tip.jsx";
import { useIsMobile } from "../useIsMobile.js";

const ACCEPT = ".pdf,.png,.jpg,.jpeg,.webp,image/*";
const acceptedFiles = (list) => Array.from(list || []).filter((f) => /\.(pdf|png|jpe?g|webp)$/i.test(f.name));
const newId = () => "p" + Math.random().toString(36).slice(2, 9);

function FileChip({ name, accent, onRemove }) {
  const col = accent ? C.primary : C.ink2;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 9px 6px 11px", borderRadius: 9, background: accent ? C.primarySoft : C.card2, border: `1px solid ${accent ? hexA(C.primary, 0.2) : C.line}`, maxWidth: "100%" }}>
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
    <div style={{ background: C.card, border: `1px solid ${hexA(C.primary, 0.25)}`, borderRadius: 12, padding: 12, textAlign: "left" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 9 }}>
        <span style={{ fontFamily: C.font, fontWeight: 600, fontSize: 13.5, color: C.ink }}>Paper {index + 1}</span>
        {paper.pages.length > 1 && <Tag tone="primary">{paper.pages.length} pages</Tag>}
        <div style={{ flex: 1 }} />
        {others.length > 0 &&
          <select value="" onChange={(e) => e.target.value && onMerge(paper.id, e.target.value)}
            title="Combine this paper's pages into another paper"
            style={{ fontFamily: C.font, fontSize: 12, color: C.ink2, padding: "4px 6px", borderRadius: 7, border: `1px solid ${C.line}`, background: C.card, cursor: "pointer" }}>
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
      style={{ flex: 1, minWidth: 280, background: drag ? hexA(C.primary, 0.08) : C.card, borderRadius: 18, border: `2px dashed ${drag ? C.primary : (has ? hexA(C.primary, 0.45) : C.line2)}`, padding: 22, display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", gap: 12, boxShadow: has ? C.shadowMd : C.shadowSm }}>
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

      <button onClick={() => inputRef.current?.click()} style={{ fontFamily: C.font, fontSize: 13.5, fontWeight: 600, padding: "9px 18px", borderRadius: 10, cursor: "pointer", color: C.primary, background: C.card, border: `1px solid ${hexA(C.primary, 0.4)}`, display: "inline-flex", alignItems: "center", gap: 6 }}>
        {has ? <React.Fragment><IconPlus s={14} c={C.primary} /> Add paper</React.Fragment> : "Browse files"}
      </button>
    </div>);
}

// Per-file Slide ⇄ Assignment selector.
function KindToggle({ kind, onChange }) {
  const seg = (val, label, color) => (
    <button onClick={(e) => { e.stopPropagation(); onChange(val); }}
      title={val === "assignment" ? "Teacher's important questions — merged into the results & ranked higher" : "Lecture slides — group questions under their topics"}
      style={{ fontFamily: C.font, fontSize: 10.5, fontWeight: 600, padding: "3px 9px", borderRadius: 999, border: "none", cursor: "pointer", background: kind === val ? color : "transparent", color: kind === val ? "#fff" : C.muted, transition: "background .15s, color .15s" }}>{label}</button>
  );
  return (
    <div style={{ display: "inline-flex", flex: "0 0 auto", borderRadius: 999, background: C.card, border: `1px solid ${C.line}`, padding: 2 }}>
      {seg("slide", "Slide", C.primary)}
      {seg("assignment", "Assignment", C.gold)}
    </div>);
}

// Optional zone (the "PPTs area"): drop course slides AND/OR assignment lists,
// then mark each file as a Slide (group by topic) or an Assignment (teacher's
// important questions — merged into the results and boosted). `items` is a list
// of { id, file, kind }.
function MaterialsZone({ items, onAdd, onRemove, onSetKind }) {
  const inputRef = React.useRef(null);
  const [drag, setDrag] = React.useState(false);
  const has = items.length > 0;
  const pick = (e) => { const fs = acceptedFiles(e.target.files); if (fs.length) onAdd(fs); e.target.value = ""; };
  const drop = (e) => { e.preventDefault(); setDrag(false); const fs = acceptedFiles(e.dataTransfer.files); if (fs.length) onAdd(fs); };
  return (
    <div onDragOver={(e) => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)} onDrop={drop}
      style={{ flex: 1, minWidth: 280, background: drag ? hexA(C.primary, 0.08) : C.card, borderRadius: 18, border: `2px dashed ${drag ? C.primary : (has ? hexA(C.good, 0.45) : C.line2)}`, padding: 22, display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", gap: 12, boxShadow: has ? C.shadowMd : C.shadowSm }}>
      <input ref={inputRef} type="file" accept={ACCEPT} multiple onChange={pick} style={{ display: "none" }} />
      <div style={{ width: 50, height: 50, borderRadius: 14, background: C.card2, display: "flex", alignItems: "center", justifyContent: "center" }}><IconUpload s={25} c={C.ink2} /></div>
      <div style={{ fontFamily: C.font, fontWeight: 600, fontSize: 17, color: C.ink }}>Slides &amp; assignments</div>
      <Tag tone="good">optional</Tag>
      {has
        ? <div style={{ display: "flex", flexDirection: "column", gap: 8, width: "100%" }}>
            {items.map((it) => {
              const asn = it.kind === "assignment";
              return (
                <div key={it.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 8px 7px 11px", borderRadius: 10, background: asn ? C.goldSoft : C.card2, border: `1px solid ${asn ? hexA(C.gold, 0.35) : C.line}` }}>
                  <IconFile s={14} c={asn ? C.gold : C.ink2} />
                  <span style={{ flex: 1, minWidth: 0, fontFamily: C.font, fontSize: 12.5, color: C.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", textAlign: "left" }}>{it.file.name}</span>
                  <KindToggle kind={it.kind} onChange={(k) => onSetKind(it.id, k)} />
                  <button onClick={() => onRemove(it.id)} title="Remove" style={{ background: "none", border: "none", padding: 2, cursor: "pointer", display: "flex", flex: "0 0 auto" }}><IconClose s={13} c={C.faint} /></button>
                </div>);
            })}
          </div>
        : <div style={{ fontFamily: C.font, fontSize: 13.5, color: C.muted, lineHeight: 1.5 }}>Drop course slide PDFs — or a teacher's important-question list.<br /><span style={{ fontSize: 12.5, color: C.faint }}>Slides group questions by topic · mark a file as <strong>Assignment</strong> to fold its questions into the results</span></div>}
      <button onClick={() => inputRef.current?.click()} style={{ fontFamily: C.font, fontSize: 13.5, fontWeight: 600, padding: "9px 18px", borderRadius: 10, cursor: "pointer", color: C.ink2, background: C.card, border: `1px solid ${C.line}`, display: "inline-flex", alignItems: "center", gap: 6 }}>
        {has ? <React.Fragment><IconPlus s={14} c={C.ink2} /> Add more</React.Fragment> : "Browse files"}
      </button>
    </div>);
}

export default function LandingScreen({ papers, handouts, setPapers, setHandouts, onStart, onBrowse, auth, useAi, setUseAi, scanError, onClearError }) {
  const isMobile = useIsMobile();
  const ready = papers.length > 0;
  const pageCount = papers.reduce((n, p) => n + p.pages.length, 0) + handouts.length;

  // handouts = [{ id, file, kind: "slide" | "assignment" }]; new files default to slides.
  const addHandouts = (fs) => setHandouts((h) => [...h, ...fs.map((f) => ({ id: newId(), file: f, kind: "slide" }))]);
  const removeHandout = (id) => setHandouts((h) => h.filter((x) => x.id !== id));
  const setHandoutKind = (id, kind) => setHandouts((h) => h.map((x) => (x.id === id ? { ...x, kind } : x)));

  return (
    <div style={{ position: "relative", flex: 1, minHeight: 0, overflowY: "auto" }}>
      <FloatField />
      <div style={{ position: "relative", zIndex: 1, maxWidth: 880, margin: "0 auto", padding: isMobile ? "34px 20px 48px" : "52px 32px 60px", display: "flex", flexDirection: "column", alignItems: "center" }}>
        {scanError && (
          <div role="alert" style={{ width: "100%", maxWidth: 580, display: "flex", alignItems: "flex-start", gap: 10, background: C.dangerSoft, border: `1px solid ${C.dangerBorder}`, borderRadius: 12, padding: "12px 14px", marginBottom: 22, animation: "rise .4s both" }}>
            <span style={{ flex: 1, fontFamily: C.font, fontSize: 13.5, color: C.danger, lineHeight: 1.5 }}>{scanError}</span>
            {onClearError && <button onClick={onClearError} aria-label="Dismiss" style={{ background: "none", border: "none", padding: 2, cursor: "pointer", display: "flex", flex: "0 0 auto" }}><IconClose s={16} c={C.danger} /></button>}
          </div>
        )}
        <div style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "6px 14px", borderRadius: 999, background: C.card, border: `1px solid ${C.line}`, boxShadow: C.shadowSm, marginBottom: 22, animation: "rise .5s both" }}>
          <IconSparkle s={15} c={C.primary} />
          <span style={{ fontFamily: C.font, fontSize: 13, fontWeight: 500, color: C.ink2 }}>Find the questions that actually repeat</span>
        </div>
        <h1 style={{ fontFamily: C.font, fontWeight: 700, fontSize: isMobile ? 32 : 46, lineHeight: 1.08, textAlign: "center", color: C.ink, letterSpacing: -1, margin: 0, animation: "rise .5s .07s both" }}>
          Upload. Learn.<br /><span style={{ background: C.grad, WebkitBackgroundClip: "text", backgroundClip: "text", WebkitTextFillColor: "transparent" }}>Ace the exam.</span>
        </h1>
        <p style={{ fontFamily: C.font, fontSize: isMobile ? 15 : 17, lineHeight: 1.55, color: C.muted, textAlign: "center", maxWidth: 470, margin: "16px 0 20px", textWrap: "pretty", animation: "rise .5s .14s both" }}>
          Drop in your past exam papers and we'll surface the questions that come back year after year — ranked by how often they repeat.
        </p>
        <div style={{ display: "flex", gap: 9, flexWrap: "wrap", justifyContent: "center", marginBottom: 34, animation: "rise .5s .2s both" }}>
          {["100% free", "No sign-up to start", "Runs in your browser"].map((t) => (
            <span key={t} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "6px 12px", borderRadius: 999, background: C.card, border: `1px solid ${C.line}`, boxShadow: C.shadowSm, fontFamily: C.font, fontSize: 12.5, fontWeight: 500, color: C.ink2 }}>
              <IconCheck s={11} c={C.good} sw={2.8} /> {t}
            </span>))}
        </div>

        <Tip id="landing-slides" title="Tip: add slides & assignments for better results">
          Drop your course slides (PPTs, as PDF) into the <strong>“Slides &amp; assignments”</strong> box to group questions under your real syllabus topics — and mark a teacher's important-question list as an <strong>Assignment</strong> to fold it into the results and rank those topics higher.{!auth?.user && auth?.enabled ? <React.Fragment> <strong>Sign in</strong> for sharper AI grouping.</React.Fragment> : null}
        </Tip>

        <div style={{ display: "flex", gap: 20, width: "100%", marginBottom: 30, alignItems: "flex-start", flexWrap: "wrap" }}>
          <PapersZone papers={papers} setPapers={setPapers} />
          <MaterialsZone items={handouts} onAdd={addHandouts} onRemove={removeHandout} onSetKind={setHandoutKind} />
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
          ? <button onClick={() => setUseAi((v) => !v)} aria-pressed={useAi} title="AI grouping uses a smarter model for more accurate topics; falls back automatically if unavailable"
              style={{ marginTop: 12, display: "inline-flex", alignItems: "center", gap: 8, padding: "8px 14px", borderRadius: 999, cursor: "pointer", fontFamily: C.font, fontSize: 13, fontWeight: 600, border: `1px solid ${useAi ? hexA(C.primary, 0.4) : C.line}`, background: useAi ? C.primarySoft : C.card, color: useAi ? C.primary : C.muted }}>
              <IconSparkle s={14} c={useAi ? C.primary : C.muted} /> AI grouping {useAi ? "on" : "off"}
              <span style={{ width: 30, height: 16, borderRadius: 999, background: useAi ? C.primary : C.line2, position: "relative", flex: "0 0 auto" }}>
                <span style={{ position: "absolute", top: 2, left: useAi ? 16 : 2, width: 12, height: 12, borderRadius: "50%", background: C.card, transition: "left .2s" }} />
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
