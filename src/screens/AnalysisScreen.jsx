// Analysis screen: each concept group is a card — topic header (with rank,
// stats, star/done, collapse toggle) and the full list of its questions below.
// Data is derived from the editable groups (rank.summarize); the admin review
// screen ("Edit groups") edits those groups directly.
import React from "react";
import { C, hexA } from "../theme.js";
import { IconStar, IconCheck, IconChevron, IconLayers, IconUpload, IconClose, IconFile } from "../components/icons.jsx";
import { Tag, HeatBar, GhostButton, PrimaryButton } from "../components/atoms.jsx";
import Tip from "../components/Tip.jsx";
import { useIsMobile } from "../useIsMobile.js";
import { summarize, byPaper } from "../engine/rank.js";
import { publishSubject } from "../engine/libraryDb.js";
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

// Admin: publish the current analysis to the backend library.
function PublishModal({ defaults, content, onClose }) {
  const [id, setId] = React.useState(defaults.id);
  const [subject, setSubject] = React.useState(defaults.subject);
  const [code, setCode] = React.useState(defaults.code);
  const [isFree, setIsFree] = React.useState(true); // free by default while launching
  const [busy, setBusy] = React.useState(false);
  const [msg, setMsg] = React.useState(null);
  const field = { fontFamily: C.font, fontSize: 14, padding: "9px 12px", borderRadius: 10, border: `1px solid ${C.line}`, background: "#fff", color: C.ink, outline: "none", width: "100%", boxSizing: "border-box" };
  const lab = { fontFamily: C.font, fontSize: 12.5, fontWeight: 600, color: C.ink2, margin: "12px 0 5px" };

  const publish = async () => {
    if (!id.trim() || !subject.trim()) { setMsg({ k: "err", t: "ID and subject are required." }); return; }
    setBusy(true); setMsg(null);
    try {
      await publishSubject({ id: id.trim(), subject: subject.trim(), code: code.trim() || null, paper_count: defaults.paperCount, question_count: defaults.questionCount, topic_count: defaults.topicCount, is_free: isFree }, content);
      setMsg({ k: "ok", t: "Published! It's now in the library." });
    } catch (e) { setMsg({ k: "err", t: e.message }); }
    finally { setBusy(false); }
  };

  return (
    <React.Fragment>
      <div onClick={onClose} style={{ position: "absolute", inset: 0, background: "rgba(20,22,42,0.34)", zIndex: 40, animation: "fadein .2s ease" }} />
      <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)", width: "min(460px,92vw)", background: "#fff", borderRadius: 18, boxShadow: C.shadowLg, zIndex: 41, padding: 24 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ fontFamily: C.font, fontWeight: 600, fontSize: 18, color: C.ink }}>Publish to library</div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", padding: 4 }}><IconClose s={18} c={C.faint} /></button>
        </div>
        <div style={lab}>Subject name</div>
        <input value={subject} onChange={(e) => setSubject(e.target.value)} style={field} />
        <div style={lab}>ID (used in the link — lowercase, no spaces)</div>
        <input value={id} onChange={(e) => setId(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-"))} style={field} />
        <div style={lab}>Code (optional)</div>
        <input value={code} onChange={(e) => setCode(e.target.value)} style={field} />
        <label style={{ display: "flex", alignItems: "center", gap: 8, fontFamily: C.font, fontSize: 13.5, color: C.ink2, margin: "14px 0 4px", cursor: "pointer" }}>
          <input type="checkbox" checked={isFree} onChange={(e) => setIsFree(e.target.checked)} /> Free — anyone can open it (recommended while launching)
        </label>
        <div style={{ fontFamily: C.font, fontSize: 12.5, color: C.faint, marginBottom: 16 }}>{defaults.paperCount} papers · {defaults.questionCount} questions · {defaults.topicCount} topics</div>
        {msg && <div style={{ fontFamily: C.font, fontSize: 13, padding: "9px 12px", borderRadius: 9, marginBottom: 14, color: msg.k === "ok" ? C.good : "#c0392b", background: msg.k === "ok" ? C.goodSoft : "#fdecea" }}>{msg.t}</div>}
        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <GhostButton onClick={onClose}>{msg?.k === "ok" ? "Done" : "Cancel"}</GhostButton>
          {msg?.k !== "ok" && <PrimaryButton onClick={publish} disabled={busy}>{busy ? "Publishing…" : "Publish"}</PrimaryButton>}
        </div>
      </div>
    </React.Fragment>);
}

function ToggleChip({ active, onClick, children }) {
  return (
    <button onClick={onClick} aria-pressed={active} style={{
      fontFamily: C.font, fontSize: 13, fontWeight: 600, padding: "8px 14px", borderRadius: 999, cursor: "pointer",
      border: `1px solid ${active ? "transparent" : C.line}`, color: active ? "#fff" : C.ink2,
      background: active ? C.primary : "#fff", display: "inline-flex", alignItems: "center", gap: 6, whiteSpace: "nowrap",
    }}>{children}</button>);
}

// A small clickable chip linking a question to the "other" view (paper⇄topic).
function LinkChip({ children, title, onClick, tone = "muted" }) {
  const c = tone === "primary" ? { bg: C.primarySoft, fg: C.primary } : { bg: "#f1f2f8", fg: C.muted };
  return (
    <button onClick={(e) => { e.stopPropagation(); onClick(); }} title={title}
      onMouseEnter={(e) => { e.currentTarget.style.filter = "brightness(0.96)"; e.currentTarget.style.textDecoration = "underline"; }}
      onMouseLeave={(e) => { e.currentTarget.style.filter = "none"; e.currentTarget.style.textDecoration = "none"; }}
      style={{ fontFamily: C.font, fontSize: 11, fontWeight: 600, color: c.fg, whiteSpace: "nowrap", padding: "3px 8px", background: c.bg, border: "none", borderRadius: 7, flex: "0 0 auto", marginTop: 1, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 4 }}>
      {children}
    </button>);
}

// ---- one group card: topic header + collapsible question list -----------
function GroupCard({ rank, cluster, max, collapsed, onToggle, starred, done, onStar, onDone, onPaperClick, flash }) {
  const unique = cluster.unique;
  const isMobile = useIsMobile();
  const delay = Math.min((rank || 0) * 0.035, 0.45);
  const lit = flash === `topic-${cluster.id}`;
  return (
    <div id={`topic-${cluster.id}`}
      onMouseEnter={(e) => { if (!lit) e.currentTarget.style.boxShadow = C.shadowMd; }}
      onMouseLeave={(e) => { if (!lit) e.currentTarget.style.boxShadow = C.shadowSm; }}
      style={{ background: "#fff", borderRadius: 16, border: `1px solid ${lit ? hexA(C.primary, 0.6) : C.line}`, borderLeft: done ? `4px solid ${C.good}` : `1px solid ${lit ? hexA(C.primary, 0.6) : C.line}`, boxShadow: lit ? `0 0 0 3px ${hexA(C.primary, 0.25)}` : C.shadowSm, overflow: "hidden", opacity: done ? 0.6 : 1, transition: "opacity .2s, box-shadow .2s, border-color .2s", animation: "rise .4s ease backwards", animationDelay: `${delay}s`, scrollMarginTop: 12 }}>
      {/* header (click / Enter / Space to collapse/expand) */}
      <div onClick={onToggle} role="button" tabIndex={0} aria-expanded={!collapsed}
        aria-label={`${cluster.topic} — ${collapsed ? "expand" : "collapse"}`}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onToggle(); } }}
        style={{ display: "flex", alignItems: "flex-start", gap: 14, padding: "15px 18px", cursor: "pointer" }}>
        <div style={{
          width: 30, height: 30, flex: "0 0 auto", borderRadius: "50%", marginTop: 1,
          background: unique ? "#f1f2f8" : (rank === 1 ? C.grad : C.primarySoft),
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
              {q.pIdx != null && onPaperClick
                ? <LinkChip title="See this whole paper" onClick={() => onPaperClick(q.pIdx)}><IconFile s={10} c={C.muted} /> {q.paperId || q.year || "?"}</LinkChip>
                : <span title="Source paper" style={{ fontFamily: C.font, fontSize: 11, fontWeight: 600, color: C.muted, whiteSpace: "nowrap", padding: "3px 8px", background: "#f1f2f8", borderRadius: 7, flex: "0 0 auto", marginTop: 1 }}>{q.paperId || q.year || "?"}</span>}
              <div style={{ flex: 1, minWidth: 0, fontFamily: C.font, fontSize: 13.5, lineHeight: 1.5, color: C.ink2, textWrap: "pretty" }}>{q.text}</div>
              <span title={MARKS_HINT} style={{ fontFamily: C.font, fontSize: 11, fontWeight: 600, color: C.primary, whiteSpace: "nowrap", padding: "3px 8px", background: C.primarySoft, borderRadius: 7, flex: "0 0 auto", marginTop: 1 }}>{q.marks} {q.marks === 1 ? "mark" : "marks"}</span>
            </div>
          ))}
        </div>
      )}
    </div>);
}

// ---- one paper card: a source exam + its questions (the "By paper" view) ----
function PaperCard({ paper, label, collapsed, onToggle, onTopicClick, flash }) {
  const isMobile = useIsMobile();
  const lit = flash === `paper-${paper.pIdx}`;
  return (
    <div id={`paper-${paper.pIdx}`}
      onMouseEnter={(e) => { if (!lit) e.currentTarget.style.boxShadow = C.shadowMd; }}
      onMouseLeave={(e) => { if (!lit) e.currentTarget.style.boxShadow = C.shadowSm; }}
      style={{ background: "#fff", borderRadius: 16, border: `1px solid ${lit ? hexA(C.primary, 0.6) : C.line}`, boxShadow: lit ? `0 0 0 3px ${hexA(C.primary, 0.25)}` : C.shadowSm, overflow: "hidden", transition: "box-shadow .2s, border-color .2s", animation: "rise .4s ease backwards", scrollMarginTop: 12 }}>
      <div onClick={onToggle} role="button" tabIndex={0} aria-expanded={!collapsed}
        aria-label={`${label} — ${collapsed ? "expand" : "collapse"}`}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onToggle(); } }}
        style={{ display: "flex", alignItems: "center", gap: 14, padding: "15px 18px", cursor: "pointer" }}>
        <div style={{ width: 34, height: 34, flex: "0 0 auto", borderRadius: 10, background: C.primarySoft, display: "flex", alignItems: "center", justifyContent: "center" }}><IconFile s={17} c={C.primary} /></div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: C.font, fontSize: 16, fontWeight: 600, color: C.ink, lineHeight: 1.3, textWrap: "pretty" }}>{label}</div>
          <div style={{ fontFamily: C.font, fontSize: 12.5, color: C.muted, marginTop: 3 }}>{paper.count} {paper.count === 1 ? "question" : "questions"} · {paper.totalMarks} marks</div>
        </div>
        <IconChevron s={18} c={C.faint} dir={collapsed ? "down" : "up"} />
      </div>
      {!collapsed && (
        <div style={{ padding: isMobile ? "0 14px 14px 14px" : "0 18px 16px 62px", display: "flex", flexDirection: "column", gap: 8 }}>
          {paper.questions.map((q, i) => (
            <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "11px 13px", background: "#fbfbfe", border: `1px solid ${C.lineSoft}`, borderRadius: 11 }}>
              <LinkChip tone="primary" title={`Topic: ${q.topic} — jump to it across all papers`} onClick={() => onTopicClick(q.topicId)}>
                <IconLayers s={10} c={C.primary} /> {q.topic.length > 30 ? q.topic.slice(0, 29) + "…" : q.topic}
              </LinkChip>
              <div style={{ flex: 1, minWidth: 0, fontFamily: C.font, fontSize: 13.5, lineHeight: 1.5, color: C.ink2, textWrap: "pretty" }}>{q.text}</div>
              <span title={MARKS_HINT} style={{ fontFamily: C.font, fontSize: 11, fontWeight: 600, color: C.primary, whiteSpace: "nowrap", padding: "3px 8px", background: C.primarySoft, borderRadius: 7, flex: "0 0 auto", marginTop: 1 }}>{q.marks} {q.marks === 1 ? "mark" : "marks"}</span>
            </div>
          ))}
        </div>
      )}
    </div>);
}

// Segmented control: topic-grouping vs paper-grouping.
function ViewToggle({ view, onChange }) {
  const opt = (val, label) => (
    <button onClick={() => onChange(val)} aria-pressed={view === val} style={{ fontFamily: C.font, fontSize: 13, fontWeight: 600, padding: "7px 16px", borderRadius: 999, cursor: "pointer", border: "none", background: view === val ? "#fff" : "transparent", color: view === val ? C.primary : C.muted, boxShadow: view === val ? C.shadowSm : "none", transition: "color .15s, background .15s" }}>{label}</button>
  );
  return (
    <div style={{ display: "inline-flex", gap: 3, padding: 3, background: "#eef0f8", borderRadius: 999, border: `1px solid ${C.line}` }}>
      {opt("topic", "By topic")}{opt("paper", "By paper")}
    </div>);
}

// ---- screen ------------------------------------------------------------
export default function AnalysisScreen({ data, onGroupsChange, canSave, fromLibrary, done, starred, onToggleDone, onToggleStar }) {
  const paperCount = data.paperCount;
  const [editing, setEditing] = React.useState(false);
  // collapsed by id; default = the "asked once" groups start collapsed.
  const [collapsed, setCollapsed] = React.useState(() => new Set(summarize(data.groups).unique.map((c) => c.id)));
  const [query, setQuery] = React.useState("");
  const [hideDone, setHideDone] = React.useState(false);
  const [starredOnly, setStarredOnly] = React.useState(false);
  const [showPublish, setShowPublish] = React.useState(false);
  const [view, setView] = React.useState("topic"); // "topic" | "paper"
  const [flash, setFlash] = React.useState(null);   // id of the card to briefly highlight after a jump
  const pendingScroll = React.useRef(null);

  const { ranked, unique } = React.useMemo(() => summarize(data.groups), [data.groups]);
  const papersView = React.useMemo(() => byPaper(data.groups), [data.groups]);
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

  // Build a readable paper label from the detected meta (falls back to paperId).
  const paperLabelOf = (p) => {
    const meta = (data.papers || [])[p.pIdx];
    const ex = meta?.examType ? (meta.examType === "MID" ? "Mid-Sem" : "End-Sem") : null;
    const bits = [meta?.session, ex, meta?.year ?? p.year].filter(Boolean);
    return bits.length ? bits.join(" ") : (p.paperId || `Paper ${p.pIdx + 1}`);
  };

  // Cross-navigation between the two views (click a paper chip ⇄ a topic chip).
  const goToPaper = (pIdx) => { pendingScroll.current = `paper-${pIdx}`; setView("paper"); };
  const goToTopic = (topicId) => {
    setCollapsed((prev) => { const n = new Set(prev); n.delete(topicId); return n; }); // ensure it's open
    pendingScroll.current = `topic-${topicId}`; setView("topic");
  };
  React.useEffect(() => {
    const target = pendingScroll.current;
    if (!target) return;
    pendingScroll.current = null;
    const t = setTimeout(() => {
      const el = document.getElementById(target);
      if (el) { el.scrollIntoView({ behavior: "smooth", block: "start" }); setFlash(target); setTimeout(() => setFlash(null), 1500); }
    }, 70);
    return () => clearTimeout(t);
  }, [view]);

  const card = (c, rank) => (
    <GroupCard key={c.id} rank={rank} cluster={c} max={maxMarks}
      collapsed={collapsed.has(c.id)} onToggle={() => toggleCollapse(c.id)}
      starred={starred.has(c.id)} done={done.has(c.id)}
      onStar={() => onToggleStar(c.id)} onDone={() => onToggleDone(c.id)}
      onPaperClick={goToPaper} flash={flash} />
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

  // Admin only: defaults for the "Publish to library" modal.
  const publishDefaults = {
    id: (subject || "subject").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "subject",
    subject: subject || "",
    code: (data.papers || []).map((p) => p.code).find(Boolean) || "",
    paperCount, questionCount: data.questionCount, topicCount: ranked.length + unique.length,
  };
  const publishContent = { papers: data.papers, groups: data.groups, questionCount: data.questionCount, paperCount: data.paperCount };

  return (
    <div style={{ position: "relative", flex: 1, minHeight: 0, overflowY: "auto" }}>
      <div style={{ maxWidth: 1040, margin: "0 auto", padding: isMobile ? "24px 16px 48px" : "34px 32px 60px" }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 24, flexWrap: "wrap", marginBottom: 18 }}>
          <div>
            {subject && <div style={{ fontFamily: C.font, fontSize: 12.5, fontWeight: 600, letterSpacing: 0.3, textTransform: "uppercase", color: C.primary, marginBottom: 4 }}>{subject}</div>}
            <div style={{ fontFamily: C.font, fontWeight: 600, fontSize: isMobile ? 23 : 28, color: C.ink, letterSpacing: -0.3 }}>Important questions</div>
            <div style={{ fontFamily: C.font, fontSize: 14.5, color: C.muted, marginTop: 5, maxWidth: 520, lineHeight: 1.5 }}>Grouped by topic and ranked by how often each repeats across {fromLibrary ? `${paperCount} ${paperCount === 1 ? "paper" : "papers"}` : `your ${paperCount} uploaded ${paperCount === 1 ? "paper" : "papers"}`}.</div>
            <div title={MARKS_HINT} style={{ fontFamily: C.font, fontSize: 12, color: C.faint, marginTop: 6 }}>Marks are estimated from the standard exam scheme.</div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, paddingTop: 4 }}>
            <Tag tone="gold"><IconStar s={13} on c={C.gold} /> {starred.size} starred</Tag>
            <GhostButton onClick={() => setEditing(true)}><IconLayers s={15} c={C.ink2} /> Edit groups</GhostButton>
            {canSave && <GhostButton onClick={() => setShowPublish(true)}><IconUpload s={15} c={C.ink2} /> Publish to library</GhostButton>}
          </div>
        </div>

        {data.skipped?.length > 0 && (
          <div style={{ fontFamily: C.font, fontSize: 13, color: C.ink2, background: C.goldSoft, border: `1px solid ${hexA(C.gold, 0.3)}`, borderRadius: 12, padding: "11px 14px", marginBottom: 16, lineHeight: 1.5 }}>
            <strong>{data.skipped.length} {data.skipped.length === 1 ? "file" : "files"} skipped</strong> — we couldn't read questions from {data.skipped.map((s) => s.name).join(", ")}. The rest were analysed below.
          </div>
        )}

        {allGroups.length > 0 && (
          <Tip id="analysis-views" title="Two ways to study these">
            Use the toggle to switch between <strong>By topic</strong> (ranked by what repeats) and <strong>By paper</strong> (each exam in full). Tap the paper or topic chip on any question to jump between the two.
          </Tip>
        )}

        {/* topic vs paper view toggle */}
        {allGroups.length > 0 && (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: 16 }}>
            <ViewToggle view={view} onChange={setView} />
            <span style={{ fontFamily: C.font, fontSize: 12.5, color: C.faint }}>
              {view === "topic" ? "Grouped by concept · ranked by repeats" : `${papersView.length} ${papersView.length === 1 ? "paper" : "papers"} · questions in order`}
            </span>
          </div>
        )}

        {/* study progress */}
        {view === "topic" && allGroups.length > 0 && (
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
        {view === "topic" && allGroups.length > 0 && (
          <div style={{ display: "flex", gap: 10, marginBottom: 18, flexWrap: "wrap", alignItems: "center" }}>
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search topics or questions…"
              style={{ flex: "1 1 240px", minWidth: 0, fontFamily: C.font, fontSize: 14, padding: "9px 14px", borderRadius: 10, border: `1px solid ${C.line}`, background: "#fff", color: C.ink, outline: "none" }} />
            <ToggleChip active={starredOnly} onClick={() => setStarredOnly((v) => !v)}><IconStar s={13} on c={starredOnly ? "#fff" : C.gold} /> Starred</ToggleChip>
            <ToggleChip active={hideDone} onClick={() => setHideDone((v) => !v)}><IconCheck s={12} c={hideDone ? "#fff" : C.good} sw={2.6} /> Hide done</ToggleChip>
            <ToggleChip active={false} onClick={toggleAll}><IconChevron s={14} c={C.ink2} dir={allCollapsed ? "down" : "up"} /> {allCollapsed ? "Expand all" : "Collapse all"}</ToggleChip>
          </div>
        )}

        {view === "topic" && <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
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
        </div>}

        {view === "paper" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {papersView.length === 0
              ? <div style={noteStyle}>No questions to show.</div>
              : papersView.map((p) => (
                  <PaperCard key={p.pIdx} paper={p} label={paperLabelOf(p)}
                    collapsed={collapsed.has(`paper-${p.pIdx}`)} onToggle={() => toggleCollapse(`paper-${p.pIdx}`)}
                    onTopicClick={goToTopic} flash={flash} />
                ))}
          </div>
        )}
      </div>

      {showPublish && <PublishModal defaults={publishDefaults} content={publishContent} onClose={() => setShowPublish(false)} />}
    </div>);
}
