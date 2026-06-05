// Subject library browse screen (backend-driven). Lists subjects from Supabase;
// shows which are open to the current user (free / entitled / admin) vs locked.
// Locked subjects show a paywall explaining how to get access.
import React from "react";
import { C, hexA } from "../theme.js";
import { IconArrow, IconUpload, IconLayers, IconLock, IconClose } from "../components/icons.jsx";
import { Tag, PrimaryButton, GhostButton, FloatField } from "../components/atoms.jsx";
import { useIsMobile } from "../useIsMobile.js";
import { useAuth } from "../auth.jsx";
import { listSubjects, myEntitlements } from "../engine/libraryDb.js";

function SubjectCard({ s, locked, onClick, index = 0 }) {
  const [hover, setHover] = React.useState(false);
  return (
    <div onClick={onClick} onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      style={{
        background: "#fff", border: `1px solid ${hover ? hexA(C.primary, 0.5) : C.line}`, borderRadius: 16,
        padding: 20, cursor: "pointer", boxShadow: hover ? "0 8px 24px rgba(63,81,196,0.14)" : C.shadowSm,
        transition: "border-color .15s, box-shadow .15s, transform .15s", transform: hover ? "translateY(-2px)" : "none",
        display: "flex", flexDirection: "column", gap: 12, minWidth: 0, opacity: locked ? 0.92 : 1,
        animation: "rise .45s ease backwards", animationDelay: `${Math.min(index * 0.05, 0.4)}s`,
      }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontFamily: C.font, fontWeight: 600, fontSize: 17, color: C.ink, lineHeight: 1.3, textWrap: "pretty" }}>{s.subject}</div>
          {s.code && <div style={{ fontFamily: C.font, fontSize: 12.5, color: C.faint, marginTop: 2 }}>{s.code}</div>}
        </div>
        <div style={{ width: 38, height: 38, flex: "0 0 auto", borderRadius: 11, background: locked ? "#f1f2f8" : C.grad, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: locked ? "none" : C.gradGlow }}>
          {locked ? <IconLock s={18} c={C.muted} /> : <IconLayers s={18} c="#fff" />}
        </div>
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
        <Tag>{s.paper_count} papers</Tag>
        <Tag>{s.question_count} questions</Tag>
        <Tag tone="primary">{s.topic_count} topics</Tag>
        {s.is_free && <Tag tone="good">Free</Tag>}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 6, fontFamily: C.font, fontSize: 13.5, fontWeight: 600, color: locked ? C.muted : C.primary, marginTop: 2 }}>
        {locked ? <React.Fragment><IconLock s={14} c={C.muted} /> Locked</React.Fragment> : <React.Fragment>Open <IconArrow s={16} /></React.Fragment>}
      </div>
    </div>);
}

// Paywall shown when a locked subject is clicked.
function Paywall({ subject, auth, onClose }) {
  return (
    <React.Fragment>
      <div onClick={onClose} style={{ position: "absolute", inset: 0, background: "rgba(20,22,42,0.34)", zIndex: 40, animation: "fadein .2s ease" }} />
      <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)", width: "min(440px, 92vw)", background: "#fff", borderRadius: 18, boxShadow: C.shadowLg, zIndex: 41, padding: 26 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
          <div style={{ width: 44, height: 44, borderRadius: 12, background: "#f1f2f8", display: "flex", alignItems: "center", justifyContent: "center" }}><IconLock s={22} c={C.muted} /></div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", padding: 4 }}><IconClose s={18} c={C.faint} /></button>
        </div>
        <div style={{ fontFamily: C.font, fontWeight: 600, fontSize: 19, color: C.ink, marginTop: 14 }}>{subject.subject} is locked</div>
        {!auth.user
          ? <React.Fragment>
              <p style={{ fontFamily: C.font, fontSize: 14, color: C.muted, lineHeight: 1.55, margin: "8px 0 18px" }}>
                Sign in first, then get this subject unlocked.
              </p>
              <PrimaryButton w="100%" onClick={auth.signInWithGoogle}>Sign in to continue</PrimaryButton>
            </React.Fragment>
          : <React.Fragment>
              <p style={{ fontFamily: C.font, fontSize: 14, color: C.muted, lineHeight: 1.55, margin: "8px 0 14px" }}>
                This is a premium subject. To unlock it, complete payment and we'll grant access to your account.
              </p>
              <div style={{ fontFamily: C.font, fontSize: 13, color: C.ink2, background: "#f7f8fc", border: `1px solid ${C.line}`, borderRadius: 10, padding: "10px 12px", marginBottom: 16 }}>
                Your account: <strong>{auth.user.email}</strong>
              </div>
              <GhostButton onClick={onClose}>Got it</GhostButton>
            </React.Fragment>}
      </div>
    </React.Fragment>);
}

export default function LibraryScreen({ onOpen, onUpload }) {
  const auth = useAuth();
  const isMobile = useIsMobile();
  const [subjects, setSubjects] = React.useState(null); // null = loading
  const [owned, setOwned] = React.useState([]);
  const [locked, setLocked] = React.useState(null);

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      const [subs, ent] = await Promise.all([listSubjects(), auth.user ? myEntitlements() : Promise.resolve([])]);
      if (!cancelled) { setSubjects(subs); setOwned(ent); }
    })();
    return () => { cancelled = true; };
  }, [auth.user]);

  const isOpen = (s) => auth.isAdmin || s.is_free || owned.includes(s.id);
  const handle = (s) => (isOpen(s) ? onOpen(s.id) : setLocked(s));

  return (
    <div style={{ position: "relative", flex: 1, minHeight: 0, overflowY: "auto" }}>
      <FloatField />
      <div style={{ position: "relative", zIndex: 1, maxWidth: 940, margin: "0 auto", padding: isMobile ? "34px 18px 48px" : "48px 32px 60px" }}>
        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 16, flexWrap: "wrap", marginBottom: 26 }}>
          <div>
            <h1 style={{ fontFamily: C.font, fontWeight: 700, fontSize: isMobile ? 28 : 38, letterSpacing: -0.5, margin: 0, background: C.grad, WebkitBackgroundClip: "text", backgroundClip: "text", WebkitTextFillColor: "transparent" }}>Subject library</h1>
            <p style={{ fontFamily: C.font, fontSize: isMobile ? 14.5 : 16, color: C.muted, margin: "10px 0 0", maxWidth: 460, lineHeight: 1.5 }}>
              Curated, high-accuracy subjects — open one to see its important, repeated questions.
            </p>
          </div>
          <PrimaryButton onClick={onUpload}><IconUpload s={17} /> Upload your own</PrimaryButton>
        </div>

        {subjects === null
          ? <div style={{ fontFamily: C.font, color: C.muted, padding: "40px 0", textAlign: "center" }}>Loading subjects…</div>
          : subjects.length === 0
            ? <div style={{ fontFamily: C.font, color: C.muted, background: "#fff", border: `1px solid ${C.line}`, borderRadius: 16, padding: "28px 24px", textAlign: "center", lineHeight: 1.6 }}>
                No subjects published yet.<br /><span style={{ fontSize: 13.5, color: C.faint }}>{auth.isAdmin ? "Upload papers and use “Publish to library” to add one." : "Check back soon."}</span>
              </div>
            : <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(auto-fill, minmax(260px, 1fr))", gap: 16 }}>
                {subjects.map((s, i) => <SubjectCard key={s.id} s={s} index={i} locked={!isOpen(s)} onClick={() => handle(s)} />)}
              </div>}
      </div>

      {locked && <Paywall subject={locked} auth={auth} onClose={() => setLocked(null)} />}
    </div>);
}
