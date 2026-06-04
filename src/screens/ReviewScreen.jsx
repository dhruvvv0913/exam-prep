// Admin review: hand-correct the auto-grouping before it's final.
// One primitive — "move a question to another group / a new group" — covers
// both splitting (move out to a new group) and merging (move all of a group's
// questions into another). Plus rename a group's topic and delete junk.
import React from "react";
import { C } from "../theme.js";
import { IconClose } from "../components/icons.jsx";
import { PrimaryButton, GhostButton, Tag } from "../components/atoms.jsx";
import { topicLabel } from "../engine/rank.js";
import { useIsMobile } from "../useIsMobile.js";

const selStyle = {
  fontFamily: C.font, fontSize: 12.5, color: C.ink2, padding: "5px 8px",
  borderRadius: 8, border: `1px solid ${C.line}`, background: "#fff", cursor: "pointer", flex: "0 0 auto",
};

export default function ReviewScreen({ groups: initial, onSave, onCancel }) {
  // Edit a local copy so "Cancel" discards everything.
  const [groups, setGroups] = React.useState(() => initial.map((g) => ({ ...g, items: [...g.items] })));
  const counter = React.useRef(0);
  const isMobile = useIsMobile();

  const dropEmpty = (gs) => gs.filter((g) => g.items.length > 0);

  const rename = (gid, topic) => setGroups((gs) => gs.map((g) => (g.id === gid ? { ...g, topic } : g)));

  const moveItem = (uid, target) => setGroups((gs) => {
    let moved = null;
    let next = gs.map((g) => {
      if (g.items.some((it) => it.uid === uid)) {
        moved = g.items.find((it) => it.uid === uid);
        return { ...g, items: g.items.filter((it) => it.uid !== uid) };
      }
      return g;
    });
    if (!moved) return gs;
    if (target === "__new__") next = [...next, { id: `gx${counter.current++}`, topic: topicLabel([moved]), items: [moved] }];
    else next = next.map((g) => (g.id === target ? { ...g, items: [...g.items, moved] } : g));
    return dropEmpty(next);
  });

  const removeItem = (uid) =>
    setGroups((gs) => dropEmpty(gs.map((g) => ({ ...g, items: g.items.filter((it) => it.uid !== uid) }))));

  const mergeInto = (srcId, targetId) => setGroups((gs) => {
    const src = gs.find((g) => g.id === srcId);
    if (!src || srcId === targetId) return gs;
    return gs.map((g) => (g.id === targetId ? { ...g, items: [...g.items, ...src.items] } : g)).filter((g) => g.id !== srcId);
  });

  const exams = (g) => new Set(g.items.map((it) => it.paperId)).size;

  return (
    <div style={{ position: "relative", flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>
      <div style={{ flex: "0 0 auto", padding: isMobile ? "16px" : "20px 32px", borderBottom: `1px solid ${C.line}`, background: "#fff", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
        <div>
          <div style={{ fontFamily: C.font, fontWeight: 600, fontSize: isMobile ? 20 : 24, color: C.ink }}>Review &amp; edit groups</div>
          <div style={{ fontFamily: C.font, fontSize: 13.5, color: C.muted, marginTop: 3 }}>
            Merge related groups, split off questions that don't belong, rename topics · {groups.length} groups
          </div>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <GhostButton onClick={onCancel}>Cancel</GhostButton>
          <PrimaryButton onClick={() => onSave(groups)}>Save changes</PrimaryButton>
        </div>
      </div>

      <div style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: isMobile ? "16px" : "24px 32px" }}>
        <div style={{ maxWidth: 920, margin: "0 auto", display: "flex", flexDirection: "column", gap: 14 }}>
          {groups.map((g) => {
            const others = groups.filter((o) => o.id !== g.id);
            return (
              <div key={g.id} style={{ background: "#fff", border: `1px solid ${C.line}`, borderRadius: 16, boxShadow: C.shadowSm, padding: 16 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12, flexWrap: "wrap" }}>
                  <input value={g.topic} onChange={(e) => rename(g.id, e.target.value)}
                    style={{ fontFamily: C.font, fontWeight: 600, fontSize: 15, color: C.ink, border: `1px solid ${C.line}`, borderRadius: 8, padding: "6px 10px", flex: "1 1 200px", minWidth: 0 }} />
                  <Tag>{g.items.length} {g.items.length === 1 ? "question" : "questions"} · {exams(g)} {exams(g) === 1 ? "exam" : "exams"}</Tag>
                  {others.length > 0 &&
                    <select value="" onChange={(e) => e.target.value && mergeInto(g.id, e.target.value)} style={selStyle}>
                      <option value="">Merge into…</option>
                      {others.map((o) => <option key={o.id} value={o.id}>{o.topic}</option>)}
                    </select>}
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {g.items.map((it) => (
                    <div key={it.uid} style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "10px 12px", background: "#fbfbfe", border: `1px solid ${C.lineSoft}`, borderRadius: 11 }}>
                      <span style={{ fontFamily: C.font, fontSize: 11, fontWeight: 600, color: C.muted, whiteSpace: "nowrap", padding: "3px 8px", background: "#f1f2f8", borderRadius: 7, flex: "0 0 auto", marginTop: 1 }}>{it.year ?? "?"}</span>
                      <div style={{ flex: 1, minWidth: 0, fontFamily: C.font, fontSize: 13.5, lineHeight: 1.5, color: C.ink2, textWrap: "pretty" }}>{it.text}</div>
                      <span style={{ fontFamily: C.font, fontSize: 11, fontWeight: 600, color: C.primary, whiteSpace: "nowrap", padding: "3px 8px", background: C.primarySoft, borderRadius: 7, flex: "0 0 auto", marginTop: 1 }}>{it.marks ?? 5} {(it.marks ?? 5) === 1 ? "mark" : "marks"}</span>
                      <select value="" onChange={(e) => e.target.value && moveItem(it.uid, e.target.value)} style={selStyle}>
                        <option value="">Move to…</option>
                        {others.map((o) => <option key={o.id} value={o.id}>{o.topic}</option>)}
                        <option value="__new__">➕ New group</option>
                      </select>
                      <button onClick={() => removeItem(it.uid)} title="Remove question" style={{ background: "none", border: "none", padding: 4, cursor: "pointer", flex: "0 0 auto" }}><IconClose s={15} c={C.faint} /></button>
                    </div>
                  ))}
                </div>
              </div>);
          })}
          {groups.length === 0 && <div style={{ fontFamily: C.font, color: C.muted }}>No groups left.</div>}
        </div>
      </div>
    </div>);
}
