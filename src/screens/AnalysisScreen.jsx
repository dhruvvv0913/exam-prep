// Analysis screen: each concept group is a card — topic header (with rank,
// stats, star/done, collapse toggle) and the full list of its questions below.
// Data is derived from the editable groups (rank.summarize); the admin review
// screen ("Edit groups") edits those groups directly.
import React from "react";
import { C } from "../theme.js";
import { IconStar, IconCheck, IconChevron, IconLayers } from "../components/icons.jsx";
import { Tag, HeatBar, GhostButton } from "../components/atoms.jsx";
import { useIsMobile } from "../useIsMobile.js";
import { summarize } from "../engine/rank.js";
import ReviewScreen from "./ReviewScreen.jsx";

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

// ---- one group card: topic header + collapsible question list -----------
function GroupCard({ rank, cluster, max, collapsed, onToggle, starred, done, onStar, onDone }) {
  const unique = cluster.unique;
  const isMobile = useIsMobile();
  return (
    <div style={{ background: "#fff", borderRadius: 16, border: `1px solid ${C.line}`, boxShadow: C.shadowSm, overflow: "hidden" }}>
      {/* header (click anywhere to collapse/expand) */}
      <div onClick={onToggle} style={{ display: "flex", alignItems: "flex-start", gap: 14, padding: "15px 18px", cursor: "pointer" }}>
        <div style={{
          width: 30, height: 30, flex: "0 0 auto", borderRadius: "50%", marginTop: 1,
          background: unique ? "#f1f2f8" : (rank === 1 ? C.primary : C.primarySoft),
          color: unique ? C.faint : (rank === 1 ? "#fff" : C.primary),
          display: "flex", alignItems: "center", justifyContent: "center",
          fontFamily: C.font, fontWeight: 700, fontSize: 13.5,
        }}>{unique ? "·" : rank}</div>

        <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={{ fontFamily: C.font, fontSize: 16, fontWeight: 600, lineHeight: 1.35, color: C.ink, textWrap: "pretty" }}>{cluster.topic}</div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <Tag tone="primary">{cluster.totalMarks} {cluster.totalMarks === 1 ? "mark" : "marks"}</Tag>
            {unique
              ? <span style={{ fontFamily: C.font, fontSize: 12.5, color: C.faint }}>asked once · 1 question</span>
              : <React.Fragment>
                  <span style={{ fontFamily: C.font, fontSize: 12.5, color: C.muted }}>appears in {cluster.appears} exams · {cluster.variants} questions</span>
                  <HeatBar value={cluster.totalMarks} max={max} />
                </React.Fragment>}
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8, flex: "0 0 auto" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }} onClick={(e) => e.stopPropagation()}>
            <StarBtn on={starred} onClick={onStar} />
            <MiniCheck on={done} onClick={onDone} />
          </div>
          <IconChevron s={18} c={C.faint} dir={collapsed ? "down" : "up"} />
        </div>
      </div>

      {/* question list */}
      {!collapsed && (
        <div style={{ padding: isMobile ? "0 14px 14px 14px" : "0 18px 16px 62px", display: "flex", flexDirection: "column", gap: 8 }}>
          {cluster.questions.map((q, i) => (
            <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "11px 13px", background: "#fbfbfe", border: `1px solid ${C.lineSoft}`, borderRadius: 11 }}>
              <span style={{ fontFamily: C.font, fontSize: 11, fontWeight: 600, color: C.muted, whiteSpace: "nowrap", padding: "3px 8px", background: "#f1f2f8", borderRadius: 7, flex: "0 0 auto", marginTop: 1 }}>{q.year ?? "?"}</span>
              <div style={{ flex: 1, minWidth: 0, fontFamily: C.font, fontSize: 13.5, lineHeight: 1.5, color: C.ink2, textWrap: "pretty" }}>{q.text}</div>
              <span style={{ fontFamily: C.font, fontSize: 11, fontWeight: 600, color: C.primary, whiteSpace: "nowrap", padding: "3px 8px", background: C.primarySoft, borderRadius: 7, flex: "0 0 auto", marginTop: 1 }}>{q.marks} {q.marks === 1 ? "mark" : "marks"}</span>
            </div>
          ))}
        </div>
      )}
    </div>);
}

// ---- screen ------------------------------------------------------------
export default function AnalysisScreen({ data, onGroupsChange, done, starred, onToggleDone, onToggleStar }) {
  const paperCount = data.paperCount;
  const [editing, setEditing] = React.useState(false);
  // collapsed by id; default = the "asked once" groups start collapsed.
  const [collapsed, setCollapsed] = React.useState(() => new Set(summarize(data.groups).unique.map((c) => c.id)));

  const { ranked, unique } = React.useMemo(() => summarize(data.groups), [data.groups]);
  const maxMarks = Math.max(1, ...ranked.map((c) => c.totalMarks));
  const isMobile = useIsMobile();

  const toggleCollapse = (id) => setCollapsed((prev) => {
    const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next;
  });

  const card = (c, rank) => (
    <GroupCard key={c.id} rank={rank} cluster={c} max={maxMarks}
      collapsed={collapsed.has(c.id)} onToggle={() => toggleCollapse(c.id)}
      starred={starred.has(c.id)} done={done.has(c.id)}
      onStar={() => onToggleStar(c.id)} onDone={() => onToggleDone(c.id)} />
  );

  // Review/edit mode replaces the ranked view (all hooks above run regardless).
  if (editing) {
    return (
      <ReviewScreen
        groups={data.groups}
        onSave={(g) => { onGroupsChange(g); setEditing(false); }}
        onCancel={() => setEditing(false)}
      />
    );
  }

  return (
    <div style={{ position: "relative", flex: 1, minHeight: 0, overflowY: "auto" }}>
      <div style={{ maxWidth: 1040, margin: "0 auto", padding: isMobile ? "24px 16px 48px" : "34px 32px 60px" }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 24, flexWrap: "wrap", marginBottom: 22 }}>
          <div>
            <div style={{ fontFamily: C.font, fontWeight: 600, fontSize: isMobile ? 23 : 28, color: C.ink, letterSpacing: -0.3 }}>Important questions</div>
            <div style={{ fontFamily: C.font, fontSize: 14.5, color: C.muted, marginTop: 5, maxWidth: 520, lineHeight: 1.5 }}>Grouped by topic and ranked by how often each repeats across your {paperCount} uploaded {paperCount === 1 ? "paper" : "papers"}.</div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, paddingTop: 4 }}>
            <Tag tone="good"><IconCheck s={12} c={C.good} sw={2.6} /> {done.size} done</Tag>
            <Tag tone="gold"><IconStar s={13} on c={C.gold} /> {starred.size} starred</Tag>
            <GhostButton onClick={() => setEditing(true)}><IconLayers s={15} c={C.ink2} /> Edit groups</GhostButton>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {ranked.length > 0
            ? ranked.map((c, i) => card(c, i + 1))
            : <div style={{ fontFamily: C.font, fontSize: 14.5, color: C.muted, background: "#fff", border: `1px solid ${C.line}`, borderRadius: 16, padding: "20px 22px", lineHeight: 1.5 }}>
                No repeated concepts yet. Upload papers from <strong>two or more years</strong> of the same subject and we'll surface the questions that come back.
              </div>}

          {unique.length > 0 && <React.Fragment>
            <div style={{ display: "flex", alignItems: "center", gap: 14, margin: "8px 4px" }}>
              <div style={{ flex: 1, height: 1, background: C.line }} />
              <span style={{ fontFamily: C.font, fontSize: 12.5, color: C.faint, whiteSpace: "nowrap", fontWeight: 500 }}>Asked once — lower priority</span>
              <div style={{ flex: 1, height: 1, background: C.line }} />
            </div>
            {unique.map((c) => card(c, 0))}
          </React.Fragment>}
        </div>
      </div>
    </div>);
}
