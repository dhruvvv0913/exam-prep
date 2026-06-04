// Landing screen: animated hero + two interactive upload zones (required past
// papers, optional handouts). Ported from prototype-app.jsx.
import React from "react";
import { C, hexA } from "../theme.js";
import { IconUpload, IconFile, IconCheck, IconArrow, IconPlus, IconSparkle, IconClose } from "../components/icons.jsx";
import { Tag, PrimaryButton, FloatField } from "../components/atoms.jsx";
import { useIsMobile } from "../useIsMobile.js";

function FileChip({ name, accent, onRemove }) {
  const col = accent ? C.primary : C.ink2;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 10px 7px 12px", borderRadius: 10, background: accent ? C.primarySoft : "#f1f2f8", border: `1px solid ${accent ? hexA(C.primary, 0.2) : C.line}`, maxWidth: "100%" }}>
      <IconFile s={15} c={col} />
      <span style={{ fontFamily: C.font, fontSize: 13, color: C.ink, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 150 }}>{name}</span>
      <IconCheck s={13} c={accent ? C.primary : C.good} sw={2.4} />
      <button onClick={(e) => { e.stopPropagation(); onRemove(); }} style={{ background: "none", border: "none", padding: 2, cursor: "pointer", display: "flex", marginLeft: 2 }}><IconClose s={14} c={C.faint} /></button>
    </div>);
}

function UploadZone({ required, title, files, onAdd, onRemove }) {
  const inputRef = React.useRef(null);
  const [drag, setDrag] = React.useState(false);
  const has = files.length > 0;
  const accent = required;
  const border = drag ? C.primary : (has ? hexA(accent ? C.primary : C.good, 0.45) : "#cfd3e6");

  // Keep the actual File objects — the pipeline reads their bytes for analysis.
  // Accept PDFs and image screenshots (png/jpg/webp); images are OCR'd.
  const accepted = (list) => Array.from(list || []).filter((f) => /\.(pdf|png|jpe?g|webp)$/i.test(f.name));
  const pick = (e) => {
    const fs = accepted(e.target.files);
    if (fs.length) onAdd(fs);
    e.target.value = "";
  };
  const drop = (e) => {
    e.preventDefault(); setDrag(false);
    const fs = accepted(e.dataTransfer.files);
    if (fs.length) onAdd(fs);
  };

  return (
    <div onDragOver={(e) => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)} onDrop={drop}
      style={{
        flex: 1, background: drag ? hexA(C.primary, 0.05) : "#fff", borderRadius: 18,
        border: `2px dashed ${border}`, padding: 24, display: "flex", flexDirection: "column",
        alignItems: "center", textAlign: "center", gap: 13, transition: "border-color .15s, background .15s",
        boxShadow: has ? C.shadowMd : C.shadowSm,
      }}>
      <input ref={inputRef} type="file" accept=".pdf,.png,.jpg,.jpeg,.webp,image/*" multiple onChange={pick} style={{ display: "none" }} />
      <div style={{ width: 52, height: 52, borderRadius: 14, background: accent ? C.primarySoft : "#f1f2f8", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <IconUpload s={26} c={accent ? C.primary : C.ink2} />
      </div>
      <div style={{ fontFamily: C.font, fontWeight: 600, fontSize: 17, color: C.ink }}>{title}</div>
      <Tag tone={accent ? "primary" : "muted"}>{accent ? "★ required to start" : "optional · improves results"}</Tag>

      {has
        ? <div style={{ display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "center", width: "100%" }}>
            {files.map((f, i) => <FileChip key={f.name + i} name={f.name} accent={accent} onRemove={() => onRemove(i)} />)}
          </div>
        : <div style={{ fontFamily: C.font, fontSize: 13.5, color: C.muted }}>Drag &amp; drop PDFs or screenshots here</div>}

      <div style={{ display: "flex", alignItems: "center", gap: 14, marginTop: 2 }}>
        <button onClick={() => inputRef.current && inputRef.current.click()} style={{
          fontFamily: C.font, fontSize: 13.5, fontWeight: 600, padding: "9px 18px", borderRadius: 10, cursor: "pointer",
          color: accent ? C.primary : C.ink2, background: "#fff", border: `1px solid ${accent ? hexA(C.primary, 0.4) : C.line}`,
          display: "inline-flex", alignItems: "center", gap: 6,
        }}>{has ? <React.Fragment><IconPlus s={14} c={accent ? C.primary : C.ink2} /> Add more</React.Fragment> : "Browse files"}</button>
      </div>
    </div>);
}

export default function LandingScreen({ papers, handouts, setPapers, setHandouts, onStart }) {
  const ready = papers.length > 0;
  const total = papers.length + handouts.length;
  const add = (setter) => (names) => setter((p) => [...p, ...names]);
  const remove = (setter) => (i) => setter((p) => p.filter((_, j) => j !== i));
  const isMobile = useIsMobile();

  return (
    <div style={{ position: "relative", flex: 1, minHeight: 0, overflowY: "auto" }}>
      <FloatField />
      <div style={{ position: "relative", zIndex: 1, maxWidth: 880, margin: "0 auto", padding: isMobile ? "34px 20px 48px" : "52px 32px 60px", display: "flex", flexDirection: "column", alignItems: "center" }}>
        <div style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "6px 14px", borderRadius: 999, background: "#fff", border: `1px solid ${C.line}`, boxShadow: C.shadowSm, marginBottom: 22 }}>
          <IconSparkle s={15} c={C.primary} />
          <span style={{ fontFamily: C.font, fontSize: 13, fontWeight: 500, color: C.ink2 }}>Find the questions that actually repeat</span>
        </div>
        <h1 style={{ fontFamily: C.font, fontWeight: 700, fontSize: isMobile ? 32 : 46, lineHeight: 1.08, textAlign: "center", color: C.ink, letterSpacing: -1, margin: 0 }}>
          Upload. Learn.<br />Ace the exam.
        </h1>
        <p style={{ fontFamily: C.font, fontSize: isMobile ? 15 : 17, lineHeight: 1.55, color: C.muted, textAlign: "center", maxWidth: 470, margin: "16px 0 38px", textWrap: "pretty" }}>
          Drop in your past exam papers and we'll surface the questions that come back year after year — ranked by how often they repeat.
        </p>

        <div style={{ display: "flex", gap: 20, width: "100%", marginBottom: 30, alignItems: "stretch", flexWrap: "wrap" }}>
          <UploadZone required title="Previous year papers" files={papers} onAdd={add(setPapers)} onRemove={remove(setPapers)} />
          <UploadZone title="Course handouts" files={handouts} onAdd={add(setHandouts)} onRemove={remove(setHandouts)} />
        </div>

        <PrimaryButton size="lg" disabled={!ready} glow={ready} onClick={onStart}>
          Start learning <IconArrow s={19} />
        </PrimaryButton>
        <div style={{ fontFamily: C.font, fontSize: 13, color: C.faint, marginTop: 14, minHeight: 18 }}>
          {ready ? `${total} file${total > 1 ? "s" : ""} ready · we'll analyse your papers next` : "Add at least one past paper to begin"}
        </div>
      </div>
    </div>);
}
