// Analysis screen: each concept group is a card — topic header (with rank,
// stats, star/done, collapse toggle) and the full list of its questions below.
// Data is derived from the editable groups (rank.summarize); the admin review
// screen ("Edit groups") edits those groups directly.
import React from "react";
import { C, hexA } from "../theme.js";
import { IconStar, IconCheck, IconChevron, IconLayers, IconUpload, IconClose, IconFile, IconPlus } from "../components/icons.jsx";
import { Tag, HeatBar, GhostButton, PrimaryButton } from "../components/atoms.jsx";
import Tip from "../components/Tip.jsx";
import { useIsMobile } from "../useIsMobile.js";
import { useDismissable } from "../useDismissable.js";
import { summarize, byPpt } from "../engine/rank.js";
import { NOT_ON_SLIDES } from "../engine/clusterCore.js";
import { publishSubject, saveMySubject, submitContribution, listSubjects } from "../engine/libraryDb.js";

// DOM id for a PPT section, so the "By importance" view can scroll to it.
const deckSlug = (d) => "ppt-" + String(d).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
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

  const dialogRef = useDismissable(onClose);

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
      <div ref={dialogRef} tabIndex={-1} role="dialog" aria-modal="true" aria-label="Publish to library" style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)", width: "min(460px,92vw)", background: "#fff", borderRadius: 18, boxShadow: C.shadowLg, zIndex: 41, padding: 24, outline: "none" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ fontFamily: C.font, fontWeight: 600, fontSize: 18, color: C.ink }}>Publish to library</div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", padding: 4 }}><IconClose s={18} c={C.faint} /></button>
        </div>
        <p style={{ fontFamily: C.font, fontSize: 13, color: C.muted, lineHeight: 1.5, margin: "8px 0 2px" }}>Publishes <strong>live to the library right away</strong> — no review step. (Students send subjects for your review via “Contribute”; those show under Admin → Pending contributions.)</p>
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

// Any signed-in user: submit this analysis to the shared library (for admin
// review). Optionally "pool" it into an existing subject instead of a new one.
function ContributeModal({ defaults, content, onClose }) {
  const [title, setTitle] = React.useState(defaults.subject || "");
  const [code, setCode] = React.useState(defaults.code || "");
  const [target, setTarget] = React.useState(""); // "" = propose new subject
  const [subjects, setSubjects] = React.useState([]);
  const [busy, setBusy] = React.useState(false);
  const [msg, setMsg] = React.useState(null);
  React.useEffect(() => { listSubjects().then(setSubjects).catch(() => {}); }, []);
  const dialogRef = useDismissable(onClose);
  const field = { fontFamily: C.font, fontSize: 14, padding: "9px 12px", borderRadius: 10, border: `1px solid ${C.line}`, background: "#fff", color: C.ink, outline: "none", width: "100%", boxSizing: "border-box" };
  const lab = { fontFamily: C.font, fontSize: 12.5, fontWeight: 600, color: C.ink2, margin: "12px 0 5px" };
  // If the typed name looks like a subject that already exists, nudge the user
  // to *pool* into it instead of spawning a near-duplicate subject.
  const norm = (s) => (s || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  const nt = norm(title);
  const dup = !target && nt.length > 3 ? subjects.find((s) => { const ns = norm(s.subject); return ns === nt || ns.includes(nt) || nt.includes(ns); }) : null;
  const submit = async () => {
    if (!title.trim()) { setMsg({ k: "err", t: "A subject name is required." }); return; }
    setBusy(true); setMsg(null);
    try {
      await submitContribution({ title: title.trim(), code: code.trim() || null, paperCount: defaults.paperCount, questionCount: defaults.questionCount }, content, target || null);
      setMsg({ k: "ok", t: "Thanks! Sent for review — it'll appear in the library once approved." });
    } catch (e) { setMsg({ k: "err", t: e.message }); }
    finally { setBusy(false); }
  };
  return (
    <React.Fragment>
      <div onClick={onClose} style={{ position: "absolute", inset: 0, background: "rgba(20,22,42,0.34)", zIndex: 40, animation: "fadein .2s ease" }} />
      <div ref={dialogRef} tabIndex={-1} role="dialog" aria-modal="true" aria-label="Contribute to the library" style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)", width: "min(460px,92vw)", background: "#fff", borderRadius: 18, boxShadow: C.shadowLg, zIndex: 41, padding: 24, outline: "none" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ fontFamily: C.font, fontWeight: 600, fontSize: 18, color: C.ink }}>Contribute to the library</div>
          <button onClick={onClose} aria-label="Close" style={{ background: "none", border: "none", cursor: "pointer", padding: 4 }}><IconClose s={18} c={C.faint} /></button>
        </div>
        <p style={{ fontFamily: C.font, fontSize: 13, color: C.muted, lineHeight: 1.5, margin: "6px 0 4px" }}>Share these questions so other students of this subject benefit. An admin reviews it before it goes live.</p>
        <div style={lab}>Subject name</div>
        <input value={title} onChange={(e) => setTitle(e.target.value)} style={field} />
        <div style={lab}>Code (optional)</div>
        <input value={code} onChange={(e) => setCode(e.target.value)} style={field} />
        {dup && (
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", fontFamily: C.font, fontSize: 12.5, color: C.ink2, background: C.primarySoft, border: `1px solid ${hexA(C.primary, 0.25)}`, borderRadius: 10, padding: "9px 12px", margin: "12px 0 0", lineHeight: 1.45 }}>
            <span style={{ flex: 1, minWidth: 160 }}>“{dup.subject}” already exists — pooling your papers into it keeps repeats together instead of splitting the subject.</span>
            <button onClick={() => setTarget(dup.id)} style={{ fontFamily: C.font, fontSize: 12.5, fontWeight: 600, color: "#fff", background: C.primary, border: "none", borderRadius: 8, padding: "6px 12px", cursor: "pointer", flex: "0 0 auto" }}>Add to it</button>
          </div>
        )}
        <div style={lab}>Add to an existing subject? (optional)</div>
        <select value={target} onChange={(e) => setTarget(e.target.value)} style={{ ...field, cursor: "pointer" }}>
          <option value="">No — propose it as a new subject</option>
          {subjects.map((s) => <option key={s.id} value={s.id}>Add my papers to “{s.subject}”</option>)}
        </select>
        {msg && <div style={{ fontFamily: C.font, fontSize: 13, padding: "9px 12px", borderRadius: 9, margin: "14px 0 0", color: msg.k === "ok" ? C.good : "#c0392b", background: msg.k === "ok" ? C.goodSoft : "#fdecea" }}>{msg.t}</div>}
        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 16 }}>
          <GhostButton onClick={onClose}>{msg?.k === "ok" ? "Done" : "Cancel"}</GhostButton>
          {msg?.k !== "ok" && <PrimaryButton onClick={submit} disabled={busy}>{busy ? "Sending…" : "Submit"}</PrimaryButton>}
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
function GroupCard({ rank, cluster, max, collapsed, onToggle, starred, done, onStar, onDone, flash, headerChip, onOpenSource }) {
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
            {headerChip}
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
              {onOpenSource && q.pIdx != null
                ? <LinkChip title="Open this paper in a new tab" onClick={() => onOpenSource(q.pIdx)}><IconFile s={10} c={C.muted} /> {q.paperId || q.year || "?"} ↗</LinkChip>
                : <span title="Source paper" style={{ fontFamily: C.font, fontSize: 11, fontWeight: 600, color: C.muted, whiteSpace: "nowrap", padding: "3px 8px", background: "#f1f2f8", borderRadius: 7, flex: "0 0 auto", marginTop: 1, display: "inline-flex", alignItems: "center", gap: 4 }}><IconFile s={10} c={C.muted} /> {q.paperId || q.year || "?"}</span>}
              <div style={{ flex: 1, minWidth: 0, fontFamily: C.font, fontSize: 13.5, lineHeight: 1.5, color: C.ink2, textWrap: "pretty" }}>{q.text}</div>
              <span title={MARKS_HINT} style={{ fontFamily: C.font, fontSize: 11, fontWeight: 600, color: C.primary, whiteSpace: "nowrap", padding: "3px 8px", background: C.primarySoft, borderRadius: 7, flex: "0 0 auto", marginTop: 1 }}>{q.marks} {q.marks === 1 ? "mark" : "marks"}</span>
            </div>
          ))}
        </div>
      )}
    </div>);
}

// ---- one PPT section: a slide deck's header + the question-types under it ----
// (the "By PPT" view). The types themselves are rendered as GroupCards by the
// parent and passed in as `children`, so star/done/collapse behave identically
// across both views.
function PptSection({ deck, children, flash }) {
  const isMobile = useIsMobile();
  const off = deck.deck === NOT_ON_SLIDES;
  const lit = flash === deckSlug(deck.deck);
  return (
    <div id={deckSlug(deck.deck)} style={{ scrollMarginTop: 12, animation: "rise .4s ease backwards" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "4px 6px 12px", borderRadius: 12, transition: "background .3s", background: lit ? hexA(C.primary, 0.07) : "transparent" }}>
        <div style={{ width: 34, height: 34, flex: "0 0 auto", borderRadius: 10, background: off ? "#f1f2f8" : C.primarySoft, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <IconLayers s={17} c={off ? C.faint : C.primary} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: C.font, fontSize: 17, fontWeight: 700, color: off ? C.muted : C.ink, lineHeight: 1.25, textWrap: "pretty" }}>{deck.deck}</div>
          <div style={{ fontFamily: C.font, fontSize: 12.5, color: C.faint, marginTop: 2 }}>
            {off
              ? `${deck.typeCount} ${deck.typeCount === 1 ? "type" : "types"} · didn't match any uploaded slide`
              : `${deck.typeCount} ${deck.typeCount === 1 ? "type" : "types"} · ${deck.questionCount} ${deck.questionCount === 1 ? "question" : "questions"} · ${deck.appears} ${deck.appears === 1 ? "exam" : "exams"} · ${deck.totalMarks} marks`}
          </div>
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10, marginLeft: isMobile ? 0 : 17, paddingLeft: isMobile ? 0 : 16, borderLeft: isMobile ? "none" : `2px solid ${C.lineSoft}` }}>
        {children}
      </div>
    </div>);
}

// Segmented control: importance-grouping vs PPT-grouping.
function ViewToggle({ view, onChange }) {
  const opt = (val, label) => (
    <button onClick={() => onChange(val)} aria-pressed={view === val} style={{ fontFamily: C.font, fontSize: 13, fontWeight: 600, padding: "7px 16px", borderRadius: 999, cursor: "pointer", border: "none", background: view === val ? "#fff" : "transparent", color: view === val ? C.primary : C.muted, boxShadow: view === val ? C.shadowSm : "none", transition: "color .15s, background .15s" }}>{label}</button>
  );
  return (
    <div style={{ display: "inline-flex", gap: 3, padding: 3, background: "#eef0f8", borderRadius: 999, border: `1px solid ${C.line}` }}>
      {opt("importance", "By importance")}{opt("ppt", "By PPT")}
    </div>);
}

// Open an in-memory uploaded File in a new browser tab via an object URL.
// Self-upload only — files aren't persisted (see App), so this is session-scoped.
function openFile(file) {
  try {
    const url = URL.createObjectURL(file);
    window.open(url, "_blank", "noopener,noreferrer");
    setTimeout(() => URL.revokeObjectURL(url), 60000); // let the new tab load first
  } catch (e) { console.error("open file failed", e); }
}

// Build a clean, print-friendly study sheet (the ranked questions) and open it
// in a new tab, where the browser's Print / Save-as-PDF takes over. Self-
// contained HTML, so it needs no print stylesheet on the app itself.
function exportStudySheet({ groups, subject, paperCount }) {
  const { ranked, unique } = summarize(groups || []);
  const esc = (s) => String(s ?? "").replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));
  const sec = (g, n) => `<section><h2>${n ? esc(n + ". ") : ""}${esc(g.topic)}</h2>`
    + `<div class="meta">${g.unique ? "asked once" : `appears in ${g.appears} exams · ${g.variants} questions`} · ${g.totalMarks} marks</div>`
    + `<ul>${g.questions.map((q) => `<li><span class="src">${esc(q.src || q.paperId || q.year || "?")}</span> ${esc(q.text)} <span class="m">[${q.marks}]</span></li>`).join("")}</ul></section>`;
  const title = subject || "Important questions";
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)} — study sheet</title>`
    + `<style>body{font-family:-apple-system,Segoe UI,Roboto,Helvetica,sans-serif;max-width:820px;margin:0 auto;padding:24px 18px 60px;color:#1a1c2e}`
    + `h1{font-size:22px;margin:0 0 2px}h2{font-size:15.5px;margin:18px 0 3px}.meta{font-size:12px;color:#6b7180}`
    + `ul{margin:5px 0 0;padding-left:20px}li{margin:6px 0;font-size:13.5px;line-height:1.5}`
    + `.src{font-weight:600;color:#3f51c4;font-size:11px;margin-right:4px}.m{color:#3f51c4;font-weight:600;font-size:11px}`
    + `section{break-inside:avoid;page-break-inside:avoid}.bar{margin-bottom:14px}`
    + `button{font:inherit;font-size:13px;font-weight:600;color:#fff;background:#3f51c4;border:none;border-radius:8px;padding:8px 14px;cursor:pointer}`
    + `@media print{.bar{display:none}}</style></head><body>`
    + `<div class="bar"><button onclick="window.print()">Print / Save as PDF</button></div>`
    + `<h1>${esc(title)}</h1><div class="meta">${paperCount || 0} papers · ranked by what repeats</div>`
    + ranked.map((g, i) => sec(g, i + 1)).join("")
    + (unique.length ? `<h1 style="margin-top:26px;font-size:15px;color:#8a8fa3">Asked once</h1>` + unique.map((g) => sec(g, 0)).join("") : "")
    + `</body></html>`;
  const w = window.open("", "_blank");
  if (w) { w.document.write(html); w.document.close(); }
  else console.error("Study sheet: popup blocked");
}

// "View uploaded files" disclosure at the top of the results (self-upload only):
// lists the uploaded papers + slides; clicking a name opens that ORIGINAL file
// in a new tab. Hidden for library/saved subjects (no files held in memory).
function SourcesBar({ sources }) {
  const [open, setOpen] = React.useState(false);
  const papers = sources?.papers || [];
  const slides = sources?.slides || [];
  if (!papers.length && !slides.length) return null;
  const lab = { fontFamily: C.font, fontSize: 11.5, fontWeight: 700, letterSpacing: 0.4, textTransform: "uppercase", color: C.faint, margin: "0 0 7px" };
  const link = (file, label, key) => (
    <button key={key} onClick={() => openFile(file)} title={`Open ${file.name} in a new tab`}
      style={{ fontFamily: C.font, fontSize: 12.5, fontWeight: 600, color: C.primary, background: C.primarySoft, border: "none", borderRadius: 8, padding: "5px 10px", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 5, maxWidth: 280 }}>
      <IconFile s={11} c={C.primary} />
      <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{label}</span>
      <span aria-hidden style={{ opacity: 0.7 }}>↗</span>
    </button>
  );
  const counts = `${papers.length} paper${papers.length !== 1 ? "s" : ""}${slides.length ? ` · ${slides.length} slide${slides.length !== 1 ? "s" : ""}` : ""}`;
  return (
    <div style={{ marginBottom: 16 }}>
      <button onClick={() => setOpen((o) => !o)} aria-expanded={open}
        style={{ fontFamily: C.font, fontSize: 13, fontWeight: 600, color: C.ink2, background: "#fff", border: `1px solid ${C.line}`, borderRadius: 999, padding: "8px 14px", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 8 }}>
        <IconFile s={14} c={C.ink2} /> View uploaded files
        <span style={{ color: C.faint, fontWeight: 500 }}>{counts}</span>
        <IconChevron s={14} c={C.faint} dir={open ? "up" : "down"} />
      </button>
      {open && (
        <div style={{ marginTop: 10, background: "#fff", border: `1px solid ${C.line}`, borderRadius: 12, padding: 14, display: "flex", flexDirection: "column", gap: 14 }}>
          {papers.length > 0 && (
            <div>
              <div style={lab}>Papers</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {papers.map((p, i) => {
                  const pages = p.pages || [];
                  const first = pages[0];
                  if (!first) return null;
                  if (pages.length === 1) return link(first, first.name, p.id || i);
                  return (
                    <div key={p.id || i} style={{ display: "inline-flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                      <span style={{ fontFamily: C.font, fontSize: 12.5, color: C.ink2 }}>{first.name} · {pages.length} pages:</span>
                      {pages.map((f, j) => link(f, `p${j + 1}`, `${p.id || i}-${j}`))}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          {slides.length > 0 && (
            <div>
              <div style={lab}>Slides</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {slides.map((f, i) => link(f, f.name, `s${i}`))}
              </div>
            </div>
          )}
          <div style={{ fontFamily: C.font, fontSize: 11.5, color: C.faint }}>Opens the original file in a new tab · available this session only.</div>
        </div>
      )}
    </div>
  );
}

// ---- screen ------------------------------------------------------------
export default function AnalysisScreen({ data, onGroupsChange, canSave, canSaveMine, fromLibrary, sources, done, starred, onToggleDone, onToggleStar }) {
  const paperCount = data.paperCount;
  const [editing, setEditing] = React.useState(false);
  // collapsed by id; default = the "asked once" groups start collapsed.
  const [collapsed, setCollapsed] = React.useState(() => new Set(summarize(data.groups).unique.map((c) => c.id)));
  const [query, setQuery] = React.useState("");
  const [hideDone, setHideDone] = React.useState(false);
  const [starredOnly, setStarredOnly] = React.useState(false);
  const [showPublish, setShowPublish] = React.useState(false);
  const [showContribute, setShowContribute] = React.useState(false);
  const [mineState, setMineState] = React.useState("idle"); // idle | saving | saved | error
  const [view, setView] = React.useState("importance"); // "importance" | "ppt"
  const [flash, setFlash] = React.useState(null);   // id of the card to briefly highlight after a jump
  const pendingScroll = React.useRef(null);

  const { ranked, unique } = React.useMemo(() => summarize(data.groups), [data.groups]);
  const pptView = React.useMemo(() => byPpt(data.groups), [data.groups]);
  // The "By PPT" view only exists when course slides were uploaded (groups carry
  // a deck). Without slides, byPpt is empty and we show only "By importance".
  const hasPpt = pptView.length > 0;
  const effectiveView = hasPpt ? view : "importance";
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

  // Cross-navigation between the two views: a type's PPT chip (importance view)
  // jumps to that PPT; a type's rank chip (PPT view) jumps to its ranked spot.
  const goToPpt = (deck) => { pendingScroll.current = deckSlug(deck); setView("ppt"); };
  const goToImportance = (id) => {
    setCollapsed((prev) => { const n = new Set(prev); n.delete(id); return n; }); // ensure it's open
    pendingScroll.current = `topic-${id}`; setView("importance");
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

  // PPT chip on a card in "By importance" → jump to that PPT in "By PPT".
  const pptChip = (c) => c.deck == null ? null : (
    <LinkChip tone="muted" title={`From ${c.deck} — open this PPT`} onClick={() => goToPpt(c.deck)}>
      <IconLayers s={10} c={C.muted} /> {c.deck.length > 26 ? c.deck.slice(0, 25) + "…" : c.deck}
    </LinkChip>
  );
  // Rank chip on a card in "By PPT" → jump to where it ranks overall.
  const rankChipBack = (c) => c.unique ? null : (
    <LinkChip tone="primary" title="See where this ranks overall" onClick={() => goToImportance(c.id)}>
      <IconLayers s={10} c={C.primary} /> Ranked #{rankOf.get(c.id)}
    </LinkChip>
  );
  // Open the source paper behind a question (its uploaded file), if we still
  // have it in memory (self-upload session). sources.papers is pIdx-aligned.
  const openSource = (pIdx) => { const p = (sources?.papers || [])[pIdx]; if (p?.pages?.[0]) openFile(p.pages[0]); };
  const renderCard = (c, rank, headerChip) => (
    <GroupCard key={c.id} rank={rank} cluster={c} max={maxMarks}
      collapsed={collapsed.has(c.id)} onToggle={() => toggleCollapse(c.id)}
      starred={starred.has(c.id)} done={done.has(c.id)}
      onStar={() => onToggleStar(c.id)} onDone={() => onToggleDone(c.id)}
      flash={flash} headerChip={headerChip} onOpenSource={sources ? openSource : null} />
  );
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

  // Signed-in users can save this analysis to their own (private) library.
  const saveMine = async () => {
    setMineState("saving");
    try {
      await saveMySubject(
        { title: subject || "My subject", code: publishDefaults.code, paperCount: data.paperCount, questionCount: data.questionCount, topicCount: ranked.length + unique.length },
        publishContent
      );
      setMineState("saved");
    } catch (e) { console.error(e); setMineState("error"); }
  };

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
          <div style={{ display: "flex", alignItems: "center", gap: 10, paddingTop: 4, flexWrap: "wrap" }}>
            <Tag tone="gold"><IconStar s={13} on c={C.gold} /> {starred.size} starred</Tag>
            <GhostButton onClick={() => exportStudySheet({ groups: data.groups, subject, paperCount })}><IconFile s={15} c={C.ink2} /> Study sheet</GhostButton>
            {canSaveMine && (
              <GhostButton onClick={mineState === "saved" ? undefined : saveMine}>
                {mineState === "saved"
                  ? <React.Fragment><IconCheck s={14} c={C.good} sw={2.6} /> Saved to My Library</React.Fragment>
                  : <React.Fragment><IconPlus s={14} c={C.ink2} /> {mineState === "saving" ? "Saving…" : mineState === "error" ? "Retry save" : "Save to My Library"}</React.Fragment>}
              </GhostButton>
            )}
            {canSaveMine && !canSave && <GhostButton onClick={() => setShowContribute(true)}><IconUpload s={15} c={C.ink2} /> Contribute to library</GhostButton>}
            <GhostButton onClick={() => setEditing(true)}><IconLayers s={15} c={C.ink2} /> Edit groups</GhostButton>
            {canSave && <GhostButton onClick={() => setShowPublish(true)}><IconUpload s={15} c={C.ink2} /> Publish to library</GhostButton>}
          </div>
        </div>

        {sources && <SourcesBar sources={sources} />}

        {data.skipped?.length > 0 && (
          <div style={{ fontFamily: C.font, fontSize: 13, color: C.ink2, background: C.goldSoft, border: `1px solid ${hexA(C.gold, 0.3)}`, borderRadius: 12, padding: "11px 14px", marginBottom: 16, lineHeight: 1.5 }}>
            <strong>{data.skipped.length} {data.skipped.length === 1 ? "file" : "files"} skipped</strong> — we couldn't read questions from {data.skipped.map((s) => s.name).join(", ")}. The rest were analysed below.
          </div>
        )}

        {data.warnings?.length > 0 && (
          <div style={{ fontFamily: C.font, fontSize: 13, color: C.ink2, background: C.goldSoft, border: `1px solid ${hexA(C.gold, 0.3)}`, borderRadius: 12, padding: "11px 14px", marginBottom: 16, lineHeight: 1.5 }}>
            <strong>{data.warnings.length === 1 ? "This looks like an answer key" : `${data.warnings.length} files look like answer keys`}</strong> — {data.warnings.map((w) => w.name).join(", ")}. We've analysed {data.warnings.length === 1 ? "it" : "them"} anyway, but model answers can blur the grouping — for the sharpest repeats, upload the <strong>question paper</strong> instead.
          </div>
        )}

        {hasPpt && (
          <Tip id="analysis-views" title="Two ways to study these">
            Switch between <strong>By importance</strong> (every question type, ranked by what repeats) and <strong>By PPT</strong> (each slide deck with the question types asked from it). Tap a card's PPT or rank chip to jump between the two.
          </Tip>
        )}

        {/* importance vs PPT view toggle (only when slides produced a PPT view) */}
        {hasPpt && (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: 16 }}>
            <ViewToggle view={effectiveView} onChange={setView} />
            <span style={{ fontFamily: C.font, fontSize: 12.5, color: C.faint }}>
              {effectiveView === "importance" ? "Grouped by concept · ranked by repeats" : `${pptView.length} ${pptView.length === 1 ? "PPT" : "PPTs"} · every question type`}
            </span>
          </div>
        )}

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

        {effectiveView === "importance" && <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {ranked.length === 0
            ? <div style={{ fontFamily: C.font, fontSize: 14.5, color: C.muted, background: "#fff", border: `1px solid ${C.line}`, borderRadius: 16, padding: "20px 22px", lineHeight: 1.5 }}>
                No repeated concepts yet. Upload papers from <strong>two or more years</strong> of the same subject and we'll surface the questions that come back.
              </div>
            : rankedF.length > 0
              ? rankedF.map((c) => renderCard(c, rankOf.get(c.id), pptChip(c)))
              : <div style={noteStyle}>No repeated topics match your search/filters.</div>}

          {uniqueF.length > 0 && <React.Fragment>
            <div style={{ display: "flex", alignItems: "center", gap: 14, margin: "8px 4px" }}>
              <div style={{ flex: 1, height: 1, background: C.line }} />
              <span style={{ fontFamily: C.font, fontSize: 12.5, color: C.faint, whiteSpace: "nowrap", fontWeight: 500 }}>Asked once — lower priority</span>
              <div style={{ flex: 1, height: 1, background: C.line }} />
            </div>
            {uniqueF.map((c) => renderCard(c, 0, pptChip(c)))}
          </React.Fragment>}
        </div>}

        {effectiveView === "ppt" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
            {pptView.map((d) => {
              const types = d.types.filter(match);
              if (types.length === 0) return null;
              return (
                <PptSection key={d.deck} deck={d} flash={flash}>
                  {types.map((t) => renderCard(t, t.unique ? 0 : rankOf.get(t.id), rankChipBack(t)))}
                </PptSection>
              );
            })}
            {pptView.every((d) => d.types.filter(match).length === 0) && (
              <div style={noteStyle}>No question types match your search/filters.</div>
            )}
          </div>
        )}
      </div>

      {showPublish && <PublishModal defaults={publishDefaults} content={publishContent} onClose={() => setShowPublish(false)} />}
      {showContribute && <ContributeModal defaults={publishDefaults} content={publishContent} onClose={() => setShowContribute(false)} />}
    </div>);
}
