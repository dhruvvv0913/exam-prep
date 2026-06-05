// Admin console: see published subjects, grant/revoke a student's access to a
// subject by email, and delete subjects. All actions are RLS-protected server
// side — non-admins can't perform them even if they reach this screen.
import React from "react";
import { C } from "../theme.js";
import { IconArrow, IconClose } from "../components/icons.jsx";
import { Tag, PrimaryButton, GhostButton } from "../components/atoms.jsx";
import { useIsMobile } from "../useIsMobile.js";
import { listSubjects, listEntitlements, grantAccess, revokeAccess, deleteSubject } from "../engine/libraryDb.js";

const card = { background: "#fff", border: `1px solid ${C.line}`, borderRadius: 16, padding: 20, boxShadow: C.shadowSm };
const input = { fontFamily: C.font, fontSize: 14, padding: "9px 12px", borderRadius: 10, border: `1px solid ${C.line}`, background: "#fff", color: C.ink, outline: "none" };

export default function AdminScreen({ onBack }) {
  const isMobile = useIsMobile();
  const [subjects, setSubjects] = React.useState([]);
  const [grants, setGrants] = React.useState([]);
  const [email, setEmail] = React.useState("");
  const [subjectId, setSubjectId] = React.useState("");
  const [msg, setMsg] = React.useState(null);
  const [busy, setBusy] = React.useState(false);

  const refresh = React.useCallback(async () => {
    try {
      const [subs, ent] = await Promise.all([listSubjects(), listEntitlements()]);
      setSubjects(subs); setGrants(ent);
      if (subs.length && !subjectId) setSubjectId(subs[0].id);
    } catch (e) { setMsg({ kind: "err", text: e.message }); }
  }, [subjectId]);

  React.useEffect(() => { refresh(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const run = async (fn, ok) => {
    setBusy(true); setMsg(null);
    try { await fn(); setMsg({ kind: "ok", text: ok }); await refresh(); }
    catch (e) { setMsg({ kind: "err", text: e.message }); }
    finally { setBusy(false); }
  };

  const grant = () => {
    if (!email.trim() || !subjectId) return;
    run(() => grantAccess(email, subjectId), `Granted ${email.trim()} access to ${subjectId}.`).then(() => setEmail(""));
  };

  const nameOf = (id) => subjects.find((s) => s.id === id)?.subject || id;

  return (
    <div style={{ position: "relative", flex: 1, minHeight: 0, overflowY: "auto" }}>
      <div style={{ maxWidth: 900, margin: "0 auto", padding: isMobile ? "24px 16px 48px" : "34px 32px 60px" }}>
        <button onClick={onBack} style={{ fontFamily: C.font, fontSize: 13.5, fontWeight: 500, color: C.ink2, background: "none", border: "none", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6, marginBottom: 14 }}>
          <IconArrow s={15} c={C.ink2} dir="left" /> Subjects
        </button>
        <h1 style={{ fontFamily: C.font, fontWeight: 700, fontSize: isMobile ? 24 : 30, color: C.ink, letterSpacing: -0.4, margin: "0 0 22px" }}>Admin · Library</h1>

        {msg && <div style={{ fontFamily: C.font, fontSize: 13.5, padding: "10px 14px", borderRadius: 10, marginBottom: 18, color: msg.kind === "ok" ? C.good : "#c0392b", background: msg.kind === "ok" ? C.goodSoft : "#fdecea" }}>{msg.text}</div>}

        {/* Grant access */}
        <div style={{ ...card, marginBottom: 18 }}>
          <div style={{ fontFamily: C.font, fontWeight: 600, fontSize: 16, color: C.ink, marginBottom: 4 }}>Grant access</div>
          <div style={{ fontFamily: C.font, fontSize: 13, color: C.muted, marginBottom: 14 }}>Unlock a subject for a student once they've paid. Use the exact email of the Google account they sign in with.</div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
            <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="student@email.com" style={{ ...input, flex: "1 1 220px", minWidth: 0 }} />
            <select value={subjectId} onChange={(e) => setSubjectId(e.target.value)} style={{ ...input, cursor: "pointer" }}>
              {subjects.map((s) => <option key={s.id} value={s.id}>{s.subject}</option>)}
            </select>
            <PrimaryButton onClick={grant} disabled={busy || !email.trim() || !subjectId}>Grant</PrimaryButton>
          </div>
        </div>

        {/* Current grants */}
        <div style={{ ...card, marginBottom: 18 }}>
          <div style={{ fontFamily: C.font, fontWeight: 600, fontSize: 16, color: C.ink, marginBottom: 12 }}>Access grants ({grants.length})</div>
          {grants.length === 0
            ? <div style={{ fontFamily: C.font, fontSize: 13.5, color: C.faint }}>No grants yet.</div>
            : <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {grants.map((g) => (
                  <div key={g.email + g.subject_id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 12px", background: "#fbfbfe", border: `1px solid ${C.lineSoft}`, borderRadius: 10 }}>
                    <span style={{ fontFamily: C.font, fontSize: 13.5, color: C.ink, fontWeight: 500, flex: "1 1 auto", minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{g.email}</span>
                    <Tag>{nameOf(g.subject_id)}</Tag>
                    <button onClick={() => run(() => revokeAccess(g.email, g.subject_id), "Access revoked.")} title="Revoke" style={{ background: "none", border: "none", cursor: "pointer", padding: 4 }}><IconClose s={15} c={C.faint} /></button>
                  </div>))}
              </div>}
        </div>

        {/* Published subjects */}
        <div style={card}>
          <div style={{ fontFamily: C.font, fontWeight: 600, fontSize: 16, color: C.ink, marginBottom: 12 }}>Published subjects ({subjects.length})</div>
          {subjects.length === 0
            ? <div style={{ fontFamily: C.font, fontSize: 13.5, color: C.faint }}>None yet — upload papers, then use “Publish to library” on the analysis screen.</div>
            : <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {subjects.map((s) => (
                  <div key={s.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", background: "#fbfbfe", border: `1px solid ${C.lineSoft}`, borderRadius: 10 }}>
                    <div style={{ flex: "1 1 auto", minWidth: 0 }}>
                      <div style={{ fontFamily: C.font, fontSize: 14, fontWeight: 600, color: C.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.subject}</div>
                      <div style={{ fontFamily: C.font, fontSize: 12, color: C.faint }}>{s.id} · {s.question_count} questions</div>
                    </div>
                    {s.is_free && <Tag tone="good">Free</Tag>}
                    <button onClick={() => { if (confirm(`Delete "${s.subject}" from the library?`)) run(() => deleteSubject(s.id), "Subject deleted."); }} style={{ fontFamily: C.font, fontSize: 12.5, color: "#c0392b", background: "none", border: `1px solid ${C.line}`, borderRadius: 8, padding: "5px 10px", cursor: "pointer" }}>Delete</button>
                  </div>))}
              </div>}
        </div>
      </div>
    </div>);
}
