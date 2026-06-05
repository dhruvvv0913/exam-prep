// Analysis screen: each concept group is a card — topic header (with rank,
// stats, star/done, collapse toggle) and the full list of its questions below.
// Data is derived from the editable groups (rank.summarize); the admin review
// screen ("Edit groups") edits those groups directly.
import React from "react";
import { C } from "../theme.js";
import { IconStar, IconCheck, IconChevron, IconLayers, IconUpload } from "../components/icons.jsx";
import { Tag, HeatBar, GhostButton } from "../components/atoms.jsx";
import { useIsMobile } from "../useIsMobile.js";
import { summarize } from "../engine/rank.js";
import ReviewScreen from "./ReviewScreen.jsx";

// Marks aren't read off the (often garbled) paper — they're assigned from the
// standard scheme, so we label them as estimates.
const MARKS_HINT = "Estimated from the standard exam scheme (compulsory Q1 parts = 1 mark, others = 5)";

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

function ToggleChip({ active, onClick, children }) {
  return (
    <button onClick={onClick} style={{
      fontFamily: C.font, fontSize: 13, fontWeight: 600, padding: "8px 14px", borderRadius: 999, cursor: "pointer",
      border: `1px solid ${active ? "transparent" : C.line}`, color: active ? "#fff" : C.ink2,
      background: active ? C.primary : "#fff", display: "inline-flex", alignItems: "center", gap: 6, whiteSpace: "nowrap",
    }}>{children}</button>);
}

// ---- one group card: topic header + collapsible question list -----------
function GroupCard({ rank, cluster, max, collapsed, onToggle, starred, done, onStar, onDone }) {
  const unique = cluster.unique;
  const isMobile = useIsMobile();
  return (
    <div style={{ background: "#fff", borderRadius: 16, border: `1px solid ${C.line}`, borderLeft: done ? `4px solid ${C.good}` : `1px solid ${C.line}`, boxShadow: C.shadowSm, overflow: "hidden", opacity: done ? 0.6 : 1, transition: "opacity .2s" }}>
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
            <Tag tone="primary" title={MARKS_HINT}>{cluster.totalMarks} {cluster.totalMarks === 1 ? "mark" : "marks"}</Tag>
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
              <span title="Source paper" style={{ fontFamily: C.font, fontSize: 11, fontWeight: 600, color: C.muted, whiteSpace: "nowrap", padding: "3px 8px", background: "#f1f2f8", borderRadius: 7, flex: "0 0 auto", marginTop: 1 }}>{q.paperId || q.year || "?"}</span>
              <div style={{ flex: 1, minWidth: 0, fontFamily: C.font, fontSize: 13.5, lineHeight: 1.5, color: C.ink2, textWrap: "pretty" }}>{q.text}</div>
              <span title={MARKS_HINT} style={{ fontFamily: C.font, fontSize: 11, fontWeight: 600, color: C.primary, whiteSpace: "nowrap", padding: "3px 8px", background: C.primarySoft, borderRadius: 7, flex: "0 0 auto", marginTop: 1 }}>{q.marks} {q.marks === 1 ? "mark" : "marks"}</span>
            </div>
          ))}
        </div>
      )}
    </div>);
}

// ---- screen ------------------------------------------------------------
export default function AnalysisScreen({ data, onGroupsChange, canSave, done, starred, onToggleDone, onToggleStar }) {
  const paperCount = data.paperCount;
  const [editing, setEditing] = React.useState(false);
  // collapsed by id; default = the "asked once" groups start collapsed.
  const [collapsed, setCollapsed] = React.useState(() => new Set(summarize(data.groups).unique.map((c) => c.id)));
  const [query, setQuery] = React.useState("");
  const [hideDone, setHideDone] = React.useState(false);
  const [starredOnly, setStarredOnly] = React.useState(false);

  const { ranked, unique } = React.useMemo(() => summarize(data.groups), [data.groups]);
  const maxMarks = Math.max(1, ...ranked.map((c) => c.totalMarks));
  const isMobile = useIsMobile();

  // Most common detected subject across the uploaded papers (for the header).
  const subject = React.useMemo(() => {
    const counts = new Map();
    for (const p of data.papers || []) {
      const s = (p.subject || "").trim();
      if (s) counts.set(s, (counts.get(s) || 0) + 1);
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || null;
  }, [data.papers]);

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

  // study progress (over all groups) + search/filter
  const rankOf = new Map(ranked.map((c, i) => [c.id, i + 1]));
  const allGroups = [...ranked, ...unique];
  const allCollapsed = allGroups.length > 0 && allGroups.every((c) => collapsed.has(c.id));
  const toggleAll = () => setCollapsed(allCollapsed ? new Set() : new Set(allGroups.map((c) => c.id)));
  const doneGroups = allGroups.filter((c) => done.has(c.id));
  const donePct = allGroups.length ? Math.round((doneGroups.length / allGroups.length) * 100) : 0;
  const doneMarks = doneGroups.reduce((s, c) => s + c.totalMarks, 0);
  const totalMarksAll = allGroups.reduce((s, c) => s + c.totalMarks, 0);

  const q = query.trim().toLowerCase();
  const match = (c) => {
    if (starredOnly && !starred.has(c.id)) return false;
    if (hideDone && done.has(c.id)) return false;
    if (q && !c.topic.toLowerCase().includes(q) && !c.questions.some((x) => x.text.toLowerCase().includes(q))) return false;
    return true;
  };
  const rankedF = ranked.filter(match);
  const uniqueF = unique.filter(match);
  const noteStyle = { fontFamily: C.font, fontSize: 14, color: C.muted, padding: "4px 4px" };

  // Admin only: export this analysis as a library subject JSON (to bundle/ship).
  const saveToLibrary = () => {
    const slug = (subject || "subject").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "subject";
    const payload = { papers: data.papers, groups: data.groups, questionCount: data.questionCount, paperCount: data.paperCount };
    const url = URL.createObjectURL(new Blob([JSON.stringify(payload)], { type: "application/json" }));
    const a = document.createElement("a");
    a.href = url; a.download = `${slug}.json`; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div style={{ position: "relative", flex: 1, minHeight: 0, overflowY: "auto" }}>
      <div style={{ maxWidth: 1040, margin: "0 auto", padding: isMobile ? "24px 16px 48px" : "34px 32px 60px" }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 24, flexWrap: "wrap", marginBottom: 18 }}>
          <div>
            {subject && <div style={{ fontFamily: C.font, fontSize: 12.5, fontWeight: 600, letterSpacing: 0.3, textTransform: "uppercase", color: C.primary, marginBottom: 4 }}>{subject}</div>}
            <div style={{ fontFamily: C.font, fontWeight: 600, fontSize: isMobile ? 23 : 28, color: C.ink, letterSpacing: -0.3 }}>Important questions</div>
            <div style={{ fontFamily: C.font, fontSize: 14.5, color: C.muted, marginTop: 5, maxWidth: 520, lineHeight: 1.5 }}>Grouped by topic and ranked by how often each repeats across your {paperCount} uploaded {paperCount === 1 ? "paper" : "papers"}.</div>
            <div title={MARKS_HINT} style={{ fontFamily: C.font, fontSize: 12, color: C.faint, marginTop: 6 }}>Marks are estimated from the standard exam scheme.</div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, paddingTop: 4 }}>
            <Tag tone="gold"><IconStar s={13} on c={C.gold} /> {starred.size} starred</Tag>
            <GhostButton onClick={() => setEditing(true)}><IconLayers s={15} c={C.ink2} /> Edit groups</GhostButton>
            {canSave && <GhostButton onClick={saveToLibrary}><IconUpload s={15} c={C.ink2} /> Save to library</GhostButton>}
          </div>
        </div>

        {/* study progress */}
        {allGroups.length > 0 && (
          <div style={{ marginBottom: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontFamily: C.font, fontSize: 12.5, color: C.muted, marginBottom: 6 }}>
              <span style={{ fontWeight: 600, color: C.ink2 }}>Studied {donePct}%</span>
              <span>{doneGroups.length} of {allGroups.length} topics · {doneMarks}/{totalMarksAll} marks done</span>
            </div>
            <div style={{ height: 8, borderRadius: 999, background: "#e3e5f1", overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${donePct}%`, background: `linear-gradient(90deg, ${C.good}, #43c08a)`, borderRadius: 999, transition: "width .3s" }} />
            </div>
          </div>
        )}

        {/* search + filters */}
        {allGroups.length > 0 && (
          <div style={{ display: "flex", gap: 10, marginBottom: 18, flexWrap: "wrap", alignItems: "center" }}>
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search topics or questions…"
              style={{ flex: "1 1 240px", minWidth: 0, fontFamily: C.font, fontSize: 14, padding: "9px 14px", borderRadius: 10, border: `1px solid ${C.line}`, background: "#fff", color: C.ink, outline: "none" }} />
            <ToggleChip active={starredOnly} onClick={() => setStarredOnly((v) => !v)}><IconStar s={13} on c={starredOnly ? "#fff" : C.gold} /> Starred</ToggleChip>
            <ToggleChip active={hideDone} onClick={() => setHideDone((v) => !v)}><IconCheck s={12} c={hideDone ? "#fff" : C.good} sw={2.6} /> Hide done</ToggleChip>
            <ToggleChip active={false} onClick={toggleAll}><IconChevron s={14} c={C.ink2} dir={allCollapsed ? "down" : "up"} /> {allCollapsed ? "Expand all" : "Collapse all"}</ToggleChip>
          </div>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {ranked.length === 0
            ? <div style={{ fontFamily: C.font, fontSize: 14.5, color: C.muted, background: "#fff", border: `1px solid ${C.line}`, borderRadius: 16, padding: "20px 22px", lineHeight: 1.5 }}>
                No repeated concepts yet. Upload papers from <strong>two or more years</strong> of the same subject and we'll surface the questions that come back.
              </div>
            : rankedF.length > 0
              ? rankedF.map((c) => card(c, rankOf.get(c.id)))
              : <div style={noteStyle}>No repeated topics match your search/filters.</div>}

          {uniqueF.length > 0 && <React.Fragment>
            <div style={{ display: "flex", alignItems: "center", gap: 14, margin: "8px 4px" }}>
              <div style={{ flex: 1, height: 1, background: C.line }} />
              <span style={{ fontFamily: C.font, fontSize: 12.5, color: C.faint, whiteSpace: "nowrap", fontWeight: 500 }}>Asked once — lower priority</span>
              <div style={{ flex: 1, height: 1, background: C.line }} />
            </div>
            {uniqueF.map((c) => card(c, 0))}
          </React.Fragment>}
        </div>
      </div>
    </div>);
}
