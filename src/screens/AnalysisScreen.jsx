// Analysis screen: 5 / 1 / combined toggle, ranked clusters with live
// star/done, and a slide-out cluster panel. Ported from prototype-analysis.jsx.
import React from "react";
import { C, hexA } from "../theme.js";
import { IconStar, IconCheck, IconChevron, IconClose, IconArrow, IconLayers } from "../components/icons.jsx";
import { Tag, HeatBar } from "../components/atoms.jsx";
import { Q, MODES, DEFAULT_DONE, DEFAULT_STAR } from "../data/clusters.js";

// ---- toggle ------------------------------------------------------------
function Toggle({ active, onChange }) {
  const opts = [["5", "5 marker"], ["1", "1 marker"], ["combined", "Combined"]];
  return (
    <div style={{ display: "inline-flex", padding: 4, gap: 3, background: "#fff", border: `1px solid ${C.line}`, borderRadius: 999, boxShadow: C.shadowSm }}>
      {opts.map(([k, label]) => {
        const on = k === active;
        return (
          <button key={k} onClick={() => onChange(k)} style={{
            fontFamily: C.font, fontSize: 14, fontWeight: on ? 600 : 500, padding: "8px 22px",
            border: "none", borderRadius: 999, cursor: "pointer", whiteSpace: "nowrap",
            color: on ? "#fff" : C.muted, background: on ? C.primary : "transparent",
            boxShadow: on ? "0 4px 12px rgba(63,81,196,0.28)" : "none",
          }}>{label}</button>);
      })}
    </div>);
}

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
          <Tag tone="primary">{cluster.marks}</Tag>
          {unique
            ? <span style={{ fontFamily: C.font, fontSize: 12.5, color: C.faint }}>asked once · no variants</span>
            : <React.Fragment>
                <span style={{ fontFamily: C.font, fontSize: 12.5, color: C.muted }}>appears {cluster.appears}× · {cluster.variants} variants</span>
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
function SidePanel({ cluster, onClose, starred, onStar }) {
  return (
    <React.Fragment>
      <div onClick={onClose} style={{ position: "absolute", inset: 0, background: "rgba(20,22,42,0.34)", zIndex: 40, animation: "fadein .2s ease" }} />
      <div style={{
        position: "absolute", top: 0, right: 0, bottom: 0, width: "min(540px, 60%)", background: "#fbfbfe",
        boxShadow: "-20px 0 60px rgba(20,22,42,0.22)", zIndex: 41, display: "flex", flexDirection: "column",
        animation: "panelin .3s cubic-bezier(.2,.8,.25,1)",
      }}>
        <div style={{ padding: "22px 26px 18px", borderBottom: `1px solid ${C.line}`, background: "#fff" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
              <Tag>{cluster.topic}</Tag><Tag tone="primary">{cluster.marks}</Tag>
            </div>
            <button onClick={onClose} style={{ width: 34, height: 34, borderRadius: 10, border: `1px solid ${C.line}`, background: "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}><IconClose /></button>
          </div>
          <div style={{ fontFamily: C.font, fontWeight: 600, fontSize: 21, color: C.ink, marginTop: 14, display: "flex", alignItems: "center", gap: 9 }}>
            <IconLayers s={18} c={C.primary} /> {cluster.variants} similar questions
          </div>
          <div style={{ fontFamily: C.font, fontSize: 13, color: C.muted, marginTop: 3 }}>Found across your 4 papers · appears {cluster.appears} times</div>
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
                <IconStar s={17} on={!!s.starred} />
              </div>))}
          </div>
        </div>

        <div style={{ padding: "16px 26px", borderTop: `1px solid ${C.line}`, background: "#fff" }}>
          <button onClick={onClose} style={{ width: "100%", fontFamily: C.font, fontSize: 16, fontWeight: 600, padding: "14px 0", color: "#fff", background: C.primary, border: "none", borderRadius: 12, cursor: "pointer", boxShadow: "0 8px 22px rgba(63,81,196,0.3)", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
            Practice all {cluster.variants} <IconArrow s={18} />
          </button>
        </div>
      </div>
    </React.Fragment>);
}

// ---- screen ------------------------------------------------------------
export default function AnalysisScreen() {
  const [mode, setMode] = React.useState("combined");
  const [open, setOpen] = React.useState(null);
  const [doneSet, setDoneSet] = React.useState(() => new Set(DEFAULT_DONE));
  const [starSet, setStarSet] = React.useState(() => new Set(DEFAULT_STAR));

  const data = MODES[mode];
  const rankedIds = data.ranked;
  const uniqueIds = data.unique;
  const maxV = Math.max.apply(null, rankedIds.map((id) => Q[id].variants));

  const toggle = (setter) => (id) => setter((prev) => {
    const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next;
  });
  const toggleDone = toggle(setDoneSet);
  const toggleStar = toggle(setStarSet);

  React.useEffect(() => { setOpen(null); }, [mode]);

  const openCluster = open != null ? Q[open] : null;

  return (
    <div style={{ position: "relative", flex: 1, minHeight: 0, overflowY: "auto" }}>
      <div style={{ maxWidth: 1040, margin: "0 auto", padding: "34px 32px 60px" }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 24, flexWrap: "wrap", marginBottom: 22 }}>
          <div>
            <div style={{ fontFamily: C.font, fontWeight: 600, fontSize: 28, color: C.ink, letterSpacing: -0.3 }}>Important questions</div>
            <div style={{ fontFamily: C.font, fontSize: 14.5, color: C.muted, marginTop: 5, maxWidth: 520, lineHeight: 1.5 }}>Ranked by repetition × number of similar questions, across your 4 uploaded papers.</div>
          </div>
          <div style={{ display: "flex", gap: 10, paddingTop: 4 }}>
            <Tag tone="good"><IconCheck s={12} c={C.good} sw={2.6} /> {doneSet.size} done</Tag>
            <Tag tone="gold"><IconStar s={13} on c={C.gold} /> {starSet.size} starred</Tag>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10, marginBottom: 24 }}>
          <Toggle active={mode} onChange={setMode} />
          <div style={{ fontFamily: C.font, fontSize: 13, color: C.muted, textAlign: "center" }}>{data.blurb}</div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {rankedIds.map((id, i) => {
            const c = Q[id];
            return <RankRow key={id} rank={i + 1} cluster={c} max={maxV}
              open={open === id} onOpen={() => setOpen(id)}
              starred={starSet.has(id)} done={doneSet.has(id)}
              onStar={() => toggleStar(id)} onDone={() => toggleDone(id)} />;
          })}

          <div style={{ display: "flex", alignItems: "center", gap: 14, margin: "8px 4px" }}>
            <div style={{ flex: 1, height: 1, background: C.line }} />
            <span style={{ fontFamily: C.font, fontSize: 12.5, color: C.faint, whiteSpace: "nowrap", fontWeight: 500 }}>Asked once — lower priority</span>
            <div style={{ flex: 1, height: 1, background: C.line }} />
          </div>

          {uniqueIds.map((id) => {
            const c = Q[id];
            return <RankRow key={id} rank={0} cluster={c} max={maxV}
              open={false} onOpen={() => {}}
              starred={starSet.has(id)} done={doneSet.has(id)}
              onStar={() => toggleStar(id)} onDone={() => toggleDone(id)} />;
          })}
        </div>
      </div>

      {openCluster && <SidePanel cluster={openCluster} onClose={() => setOpen(null)}
        starred={starSet.has(openCluster.id)} onStar={() => toggleStar(openCluster.id)} />}
    </div>);
}
