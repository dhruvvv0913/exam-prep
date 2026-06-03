// Analysis screen: ranked repeated-question clusters with live star/done and a
// slide-out cluster panel. Data comes from the analysis pipeline (rank.js).
import React from "react";
import { C, hexA } from "../theme.js";
import { IconStar, IconCheck, IconChevron, IconClose, IconArrow, IconLayers } from "../components/icons.jsx";
import { Tag, HeatBar } from "../components/atoms.jsx";
import { useIsMobile } from "../useIsMobile.js";

function MiniCheck({ on, onClick }) {
  return (
    <button onClick={onClick} title={on ? "Mark as not done" : "Mark as done"} style={{
      width: 26, height: 26, borderRadius: 8, cursor: "pointer", flex: "0 0 auto",
      border: `1.5px solid ${on ? C.good : "#d3d6e6"}`, background: on ? C.good : "#fff",
      display: "flex", alignItems: "center", justifyContent: "center", padding: 0,
    }}>{on && <IconCheck s={14} />}</button>);
}

function StarBtn({ on, onClick }) {
  return (
    <button onClick={onClick} title={on ? "Unstar" : "Star this"} style={{ background: "none", border: "none", padding: 4, cursor: "pointer", display: "flex" }}>
      <IconStar s={20} on={on} />
    </button>);
}

// ---- one ranked cluster row -------------------------------------------
function RankRow({ rank, cluster, max, open, onOpen, starred, done, onStar, onDone }) {
  const unique = cluster.unique;
  const timer = React.useRef(null);
  const start = () => { if (!unique) timer.current = setTimeout(onOpen, 1600); };
  const stop = () => clearTimeout(timer.current);
  return (
    <div onMouseEnter={start} onMouseLeave={stop} onClick={unique ? undefined : onOpen}
      style={{
        display: "flex", alignItems: "flex-start", gap: 16, padding: "16px 18px",
        background: open ? hexA(C.primary, 0.05) : "#fff", borderRadius: 16,
        border: `1px solid ${open ? hexA(C.primary, 0.5) : C.line}`,
        boxShadow: open ? "0 6px 20px rgba(63,81,196,0.14)" : C.shadowSm,
        cursor: unique ? "default" : "pointer", transition: "border-color .15s, box-shadow .15s, background .15s",
      }}>
      <div style={{
        width: 30, height: 30, flex: "0 0 auto", borderRadius: "50%", marginTop: 1,
        background: unique ? "#f1f2f8" : (rank === 1 ? C.primary : C.primarySoft),
        color: unique ? C.faint : (rank === 1 ? "#fff" : C.primary),
        display: "flex", alignItems: "center", justifyContent: "center",
        fontFamily: C.font, fontWeight: 700, fontSize: 13.5,
      }}>{unique ? "·" : rank}</div>

      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 11 }}>
        <div style={{ fontFamily: C.font, fontSize: 15.5, fontWeight: 500, lineHeight: 1.45, color: C.ink, textWrap: "pretty" }}>{cluster.q}</div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <Tag>{cluster.topic}</Tag>
          {cluster.marks && <Tag tone="primary">{cluster.marks}</Tag>}
          {unique
            ? <span style={{ fontFamily: C.font, fontSize: 12.5, color: C.faint }}>asked once · no variants</span>
            : <React.Fragment>
                <span style={{ fontFamily: C.font, fontSize: 12.5, color: C.muted }}>appears in {cluster.appears} exams · {cluster.variants} variants</span>
                <HeatBar value={cluster.variants} max={max} />
              </React.Fragment>}
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 10, flex: "0 0 auto" }}>
        {!unique &&
          <button onClick={(e) => { e.stopPropagation(); onOpen(); }} style={{
            display: "inline-flex", alignItems: "center", gap: 5, fontFamily: C.font, fontSize: 12.5, fontWeight: 600,
            padding: "5px 11px", borderRadius: 999, cursor: "pointer",
            color: open ? "#fff" : C.primary, background: open ? C.primary : C.primarySoft, border: "none",
          }}>{cluster.variants} similar <IconChevron s={14} c={open ? "#fff" : C.primary} dir={open ? "up" : "down"} /></button>}
        <div style={{ display: "flex", alignItems: "center", gap: 6 }} onClick={(e) => e.stopPropagation()}>
          <StarBtn on={starred} onClick={onStar} />
          <MiniCheck on={done} onClick={onDone} />
        </div>
      </div>
    </div>);
}

// ---- slide-out cluster panel ------------------------------------------
function SidePanel({ cluster, paperCount, onClose, starred, onStar }) {
  return (
    <React.Fragment>
      <div onClick={onClose} style={{ position: "absolute", inset: 0, background: "rgba(20,22,42,0.34)", zIndex: 40, animation: "fadein .2s ease" }} />
      <div style={{
        position: "absolute", top: 0, right: 0, bottom: 0, width: "min(540px, 94vw)", background: "#fbfbfe",
        boxShadow: "-20px 0 60px rgba(20,22,42,0.22)", zIndex: 41, display: "flex", flexDirection: "column",
        animation: "panelin .3s cubic-bezier(.2,.8,.25,1)",
      }}>
        <div style={{ padding: "22px 26px 18px", borderBottom: `1px solid ${C.line}`, background: "#fff" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
              <Tag>{cluster.topic}</Tag>{cluster.marks && <Tag tone="primary">{cluster.marks}</Tag>}
            </div>
            <button onClick={onClose} style={{ width: 34, height: 34, borderRadius: 10, border: `1px solid ${C.line}`, background: "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}><IconClose /></button>
          </div>
          <div style={{ fontFamily: C.font, fontWeight: 600, fontSize: 21, color: C.ink, marginTop: 14, display: "flex", alignItems: "center", gap: 9 }}>
            <IconLayers s={18} c={C.primary} /> {cluster.variants} similar questions
          </div>
          <div style={{ fontFamily: C.font, fontSize: 13, color: C.muted, marginTop: 3 }}>Found across your {paperCount} papers · appears in {cluster.appears} exams</div>
        </div>

        <div style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "20px 26px 8px" }}>
          <div style={{ fontFamily: C.font, fontSize: 11.5, letterSpacing: 0.6, textTransform: "uppercase", color: C.primary, fontWeight: 600, marginBottom: 9 }}>Representative</div>
          <div style={{ background: hexA(C.primary, 0.06), border: `1px solid ${hexA(C.primary, 0.25)}`, borderRadius: 14, padding: 16, display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
            <div style={{ fontFamily: C.font, fontSize: 14.5, fontWeight: 500, lineHeight: 1.5, color: C.ink, textWrap: "pretty" }}>{cluster.q}</div>
            <button onClick={onStar} style={{ background: "none", border: "none", padding: 2, cursor: "pointer", flex: "0 0 auto" }}><IconStar s={20} on={starred} /></button>
          </div>

          <div style={{ fontFamily: C.font, fontSize: 11.5, letterSpacing: 0.6, textTransform: "uppercase", color: C.faint, fontWeight: 600, margin: "22px 0 12px" }}>All variants found</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {cluster.similars.map((s, i) => (
              <div key={i} style={{ background: "#fff", border: `1px solid ${C.line}`, borderRadius: 13, padding: "13px 15px", display: "flex", alignItems: "flex-start", gap: 12, boxShadow: C.shadowSm }}>
                <span style={{ fontFamily: C.font, fontSize: 11.5, fontWeight: 600, color: C.muted, whiteSpace: "nowrap", padding: "4px 9px", background: "#f1f2f8", borderRadius: 8, flex: "0 0 auto", marginTop: 1 }}>{s.src}</span>
                <div style={{ flex: 1, minWidth: 0, fontFamily: C.font, fontSize: 13.5, lineHeight: 1.5, color: C.ink2, textWrap: "pretty" }}>{s.text}</div>
              </div>))}
          </div>
        </div>
      </div>
    </React.Fragment>);
}

// ---- screen ------------------------------------------------------------
export default function AnalysisScreen({ data }) {
  const { ranked, unique, paperCount } = data;
  const [open, setOpen] = React.useState(null);
  const [doneSet, setDoneSet] = React.useState(() => new Set());
  const [starSet, setStarSet] = React.useState(() => new Set());

  const byId = React.useMemo(() => new Map([...ranked, ...unique].map((c) => [c.id, c])), [ranked, unique]);
  const maxV = Math.max(1, ...ranked.map((c) => c.variants));

  const toggle = (setter) => (id) => setter((prev) => {
    const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next;
  });
  const toggleDone = toggle(setDoneSet);
  const toggleStar = toggle(setStarSet);

  const openCluster = open != null ? byId.get(open) : null;
  const isMobile = useIsMobile();

  const row = (c, rank) => (
    <RankRow key={c.id} rank={rank} cluster={c} max={maxV}
      open={open === c.id} onOpen={() => setOpen(c.id)}
      starred={starSet.has(c.id)} done={doneSet.has(c.id)}
      onStar={() => toggleStar(c.id)} onDone={() => toggleDone(c.id)} />
  );

  return (
    <div style={{ position: "relative", flex: 1, minHeight: 0, overflowY: "auto" }}>
      <div style={{ maxWidth: 1040, margin: "0 auto", padding: isMobile ? "24px 16px 48px" : "34px 32px 60px" }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 24, flexWrap: "wrap", marginBottom: 22 }}>
          <div>
            <div style={{ fontFamily: C.font, fontWeight: 600, fontSize: isMobile ? 23 : 28, color: C.ink, letterSpacing: -0.3 }}>Important questions</div>
            <div style={{ fontFamily: C.font, fontSize: 14.5, color: C.muted, marginTop: 5, maxWidth: 520, lineHeight: 1.5 }}>Ranked by how often each concept repeats across your {paperCount} uploaded {paperCount === 1 ? "paper" : "papers"}.</div>
          </div>
          <div style={{ display: "flex", gap: 10, paddingTop: 4 }}>
            <Tag tone="good"><IconCheck s={12} c={C.good} sw={2.6} /> {doneSet.size} done</Tag>
            <Tag tone="gold"><IconStar s={13} on c={C.gold} /> {starSet.size} starred</Tag>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {ranked.length > 0
            ? ranked.map((c, i) => row(c, i + 1))
            : <div style={{ fontFamily: C.font, fontSize: 14.5, color: C.muted, background: "#fff", border: `1px solid ${C.line}`, borderRadius: 16, padding: "20px 22px", lineHeight: 1.5 }}>
                No repeated concepts yet. Upload papers from <strong>two or more years</strong> of the same subject and we'll surface the questions that come back.
              </div>}

          {unique.length > 0 && <React.Fragment>
            <div style={{ display: "flex", alignItems: "center", gap: 14, margin: "8px 4px" }}>
              <div style={{ flex: 1, height: 1, background: C.line }} />
              <span style={{ fontFamily: C.font, fontSize: 12.5, color: C.faint, whiteSpace: "nowrap", fontWeight: 500 }}>Asked once — lower priority</span>
              <div style={{ flex: 1, height: 1, background: C.line }} />
            </div>
            {unique.map((c) => row(c, 0))}
          </React.Fragment>}
        </div>
      </div>

      {openCluster && <SidePanel cluster={openCluster} paperCount={paperCount} onClose={() => setOpen(null)}
        starred={starSet.has(openCluster.id)} onStar={() => toggleStar(openCluster.id)} />}
    </div>);
}
