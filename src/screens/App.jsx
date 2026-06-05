// App shell + screen state machine. Holds uploaded files in memory and the
// analysis result (persisted so a returning user sees it again). Subjects can
// also come from the bundled library; star/done progress is kept per subject.
import React from "react";
import { C } from "../theme.js";
import { IconUpload, IconLayers, IconArrow } from "../components/icons.jsx";
import { Logo, GhostButton } from "../components/atoms.jsx";
import { useIsMobile } from "../useIsMobile.js";
import LandingScreen from "./LandingScreen.jsx";
import LoadingScreen from "./LoadingScreen.jsx";
import AnalysisScreen from "./AnalysisScreen.jsx";
import LibraryScreen from "./LibraryScreen.jsx";
import AdminScreen from "./AdminScreen.jsx";
import { getSubjectContent } from "../engine/libraryDb.js";
import { useAuth } from "../auth.jsx";

// Sign-in / account control (hidden until Supabase is configured).
function Account({ auth }) {
  if (!auth.enabled) return null;
  if (!auth.user) {
    return (
      <button onClick={auth.signInWithGoogle} style={{ fontFamily: C.font, fontSize: 14, fontWeight: 600, padding: "8px 16px", borderRadius: 10, border: "none", color: "#fff", background: C.primary, cursor: "pointer", boxShadow: "0 4px 12px rgba(63,81,196,0.28)" }}>Sign in</button>
    );
  }
  const label = auth.user.email || "Account";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <span title={label + (auth.isAdmin ? " (admin)" : "")} style={{ fontFamily: C.font, fontSize: 13, color: C.ink2, maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {auth.isAdmin ? "★ " : ""}{label}
      </span>
      <button onClick={auth.signOut} title="Sign out" style={{ fontFamily: C.font, fontSize: 13, fontWeight: 500, padding: "6px 12px", borderRadius: 9, border: `1px solid ${C.line}`, background: "#fff", color: C.ink2, cursor: "pointer" }}>Sign out</button>
    </div>);
}

// ======================================================================
// TOP BAR
// ======================================================================
function TopBar({ screen, summary, fromLibrary, auth, onHome, onReupload, onBrowse, onAdmin }) {
  const isMobile = useIsMobile();
  return (
    <div style={{ flex: "0 0 auto", height: 66, display: "flex", alignItems: "center", justifyContent: "space-between", padding: isMobile ? "0 16px" : "0 32px", borderBottom: `1px solid ${C.line}`, background: "rgba(255,255,255,0.78)", backdropFilter: "blur(10px)", zIndex: 10 }}>
      <Logo onClick={onHome} />
      <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
        {screen === "analysis"
          ? <React.Fragment>
              {!isMobile && summary && <span style={{ fontFamily: C.font, fontSize: 13.5, color: C.muted }}>{summary.paperCount} papers · {summary.questionCount} questions</span>}
              {fromLibrary
                ? <GhostButton onClick={onBrowse}><IconArrow s={16} c={C.ink2} dir="left" /> Subjects</GhostButton>
                : <GhostButton onClick={onReupload}><IconUpload s={16} c={C.ink2} /> Re-upload</GhostButton>}
            </React.Fragment>
          : <React.Fragment>
              {screen !== "library" && <span onClick={onBrowse} style={{ fontFamily: C.font, fontSize: 14, fontWeight: 500, color: C.ink2, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6 }}><IconLayers s={15} c={C.ink2} /> Subjects</span>}
              {auth.isAdmin && screen !== "admin" && <span onClick={onAdmin} style={{ fontFamily: C.font, fontSize: 14, fontWeight: 600, color: C.primary, cursor: "pointer" }}>Admin</span>}
              {!isMobile && !auth.enabled && (
                <span style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "6px 13px", border: `1px solid ${C.line}`, borderRadius: 999, background: "#fff", fontFamily: C.font, fontSize: 12.5, fontWeight: 500, color: C.muted }}>
                  <span style={{ width: 7, height: 7, borderRadius: "50%", background: C.good }} /> Free · runs in your browser
                </span>)}
            </React.Fragment>}
        <Account auth={auth} />
      </div>
    </div>);
}

// ======================================================================
// APP
// ======================================================================
const LS = "pyqly-proto-v1";
const PROGRESS_LS = "pyqly-progress"; // { [key]: { done: [], starred: [] } }

const readProgress = (key) => {
  try { return (JSON.parse(localStorage.getItem(PROGRESS_LS)) || {})[key] || { done: [], starred: [] }; }
  catch { return { done: [], starred: [] }; }
};
const writeProgress = (key, done, starred) => {
  try {
    const all = JSON.parse(localStorage.getItem(PROGRESS_LS)) || {};
    all[key] = { done: [...done], starred: [...starred] };
    localStorage.setItem(PROGRESS_LS, JSON.stringify(all));
  } catch (e) {}
};

export default function App() {
  const auth = useAuth();
  const saved = (() => { try { return JSON.parse(localStorage.getItem(LS)) || {}; } catch (e) { return {}; } })();
  const [screen, setScreen] = React.useState(saved.result ? saved.screen || "analysis" : "landing");
  const [papers, setPapers] = React.useState([]);   // File objects (not persisted)
  const [handouts, setHandouts] = React.useState([]);
  const [result, setResult] = React.useState(saved.result || null); // analysis output
  const [progressKey, setProgressKey] = React.useState(saved.progressKey || "upload");
  const [done, setDone] = React.useState(() => new Set(readProgress(saved.progressKey || "upload").done));
  const [starred, setStarred] = React.useState(() => new Set(readProgress(saved.progressKey || "upload").starred));

  // Persist the result + screen + which progress bucket is active.
  React.useEffect(() => {
    try { localStorage.setItem(LS, JSON.stringify({ screen, result, progressKey })); } catch (e) {}
  }, [screen, result, progressKey]);
  // Persist progress under its bucket key.
  React.useEffect(() => { writeProgress(progressKey, done, starred); }, [progressKey, done, starred]);

  const toggleIn = (setter) => (id) => setter((prev) => {
    const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next;
  });

  const fromLibrary = progressKey.startsWith("lib:");
  const home = () => setScreen("landing");
  const browse = () => setScreen("library");
  const reupload = () => { setPapers([]); setHandouts([]); setScreen("landing"); };
  const start = () => setScreen("loading");

  // A fresh upload analysis: own progress bucket, reset.
  const onDone = (r) => { setResult(r); setProgressKey("upload"); setDone(new Set()); setStarred(new Set()); setScreen("analysis"); };
  const onGroupsChange = (groups) => setResult((r) => ({ ...r, groups }));

  const openAdmin = () => setScreen("admin");

  // Open a library subject — content comes from the backend (RLS-gated).
  const openSubject = async (id) => {
    try {
      const r = await getSubjectContent(id);
      if (!r) return; // locked / not found (the library screen normally prevents this)
      const key = `lib:${id}`;
      const p = readProgress(key);
      setResult(r);
      setProgressKey(key);
      setDone(new Set(p.done));
      setStarred(new Set(p.starred));
      setScreen("analysis");
    } catch (e) { console.error(e); }
  };

  return (
    <div style={{ position: "fixed", inset: 0, display: "flex", flexDirection: "column", background: C.bg, fontFamily: C.font }}>
      <TopBar screen={screen} summary={result} fromLibrary={fromLibrary} auth={auth} onHome={home} onReupload={reupload} onBrowse={browse} onAdmin={openAdmin} />
      {screen === "landing" && <LandingScreen papers={papers} handouts={handouts} setPapers={setPapers} setHandouts={setHandouts} onStart={start} onBrowse={browse} />}
      {screen === "library" && <LibraryScreen onOpen={openSubject} onUpload={reupload} />}
      {screen === "admin" && (auth.isAdmin ? <AdminScreen onBack={browse} /> : <LibraryScreen onOpen={openSubject} onUpload={reupload} />)}
      {screen === "loading" && <LoadingScreen papers={papers.map((p) => p.pages)} onDone={onDone} onError={reupload} />}
      {screen === "analysis" && (result
        ? <AnalysisScreen data={result} onGroupsChange={onGroupsChange} canSave={auth.isAdmin && !fromLibrary}
            done={done} starred={starred} onToggleDone={toggleIn(setDone)} onToggleStar={toggleIn(setStarred)} />
        : <LandingScreen papers={papers} handouts={handouts} setPapers={setPapers} setHandouts={setHandouts} onStart={start} onBrowse={browse} />)}
    </div>);
}
