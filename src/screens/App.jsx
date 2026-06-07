// App shell + screen state machine. Holds uploaded files in memory and the
// analysis result (persisted so a returning user sees it again). Subjects can
// also come from the bundled library; star/done progress is kept per subject.
import React from "react";
import { C, hexA } from "../theme.js";
import { IconUpload, IconLayers, IconArrow } from "../components/icons.jsx";
import { Logo, GhostButton } from "../components/atoms.jsx";
import { useIsMobile } from "../useIsMobile.js";
import LandingScreen from "./LandingScreen.jsx"; // eager: first paint
// The rest are lazy so the heavy analysis engine (transformers, tesseract,
// pdfjs — pulled in via LoadingScreen) loads only when it's actually needed,
// keeping the initial bundle small.
const LoadingScreen = React.lazy(() => import("./LoadingScreen.jsx"));
const AnalysisScreen = React.lazy(() => import("./AnalysisScreen.jsx"));
const LibraryScreen = React.lazy(() => import("./LibraryScreen.jsx"));
const AdminScreen = React.lazy(() => import("./AdminScreen.jsx"));
import { getSubjectContent } from "../engine/libraryDb.js";
import { groupViaApi } from "../engine/aiGroup.js";
import { useAuth } from "../auth.jsx";

// Minimal centered spinner shown while a lazy screen's chunk loads.
function ScreenFallback() {
  return (
    <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div className="pyq-spin" style={{ width: 34, height: 34, borderRadius: "50%", border: `3px solid ${hexA(C.primary, 0.2)}`, borderTopColor: C.primary }} />
    </div>);
}

// Sign-in / account control (hidden until Supabase is configured).
function Account({ auth }) {
  const isMobile = useIsMobile();
  if (!auth.enabled) return null;
  if (!auth.user) {
    return (
      <button onClick={auth.signInWithGoogle} style={{ fontFamily: C.font, fontSize: 14, fontWeight: 600, padding: "8px 16px", borderRadius: 10, border: "none", color: "#fff", background: C.primary, cursor: "pointer", boxShadow: "0 4px 12px rgba(63,81,196,0.28)" }}>Sign in</button>
    );
  }
  const label = auth.user.email || "Account";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      {/* on phones just show ★ (if admin) to save space; full email on desktop */}
      {isMobile
        ? (auth.isAdmin ? <span title={label} style={{ color: C.gold, fontSize: 15 }}>★</span> : null)
        : <span title={label + (auth.isAdmin ? " (admin)" : "")} style={{ fontFamily: C.font, fontSize: 13, color: C.ink2, maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{auth.isAdmin ? "★ " : ""}{label}</span>}
      <button onClick={auth.signOut} title="Sign out" style={{ fontFamily: C.font, fontSize: 13, fontWeight: 500, padding: "6px 12px", borderRadius: 9, border: `1px solid ${C.line}`, background: "#fff", color: C.ink2, cursor: "pointer" }}>Sign out</button>
    </div>);
}

// Slow-drifting colored blobs behind everything (subtle, GPU-friendly).
function AuroraBg() {
  const blob = (s) => <div style={{ position: "absolute", borderRadius: "50%", filter: "blur(64px)", ...s }} />;
  return (
    <div style={{ position: "absolute", inset: 0, overflow: "hidden", pointerEvents: "none", zIndex: 0 }}>
      {blob({ width: 440, height: 440, top: -140, left: -90, background: "radial-gradient(circle, rgba(99,110,240,0.40), transparent 70%)", animation: "aurora1 19s ease-in-out infinite" })}
      {blob({ width: 400, height: 400, top: -70, right: -110, background: "radial-gradient(circle, rgba(138,108,224,0.36), transparent 70%)", animation: "aurora2 23s ease-in-out infinite" })}
      {blob({ width: 380, height: 380, bottom: -160, left: "32%", background: "radial-gradient(circle, rgba(91,108,240,0.28), transparent 70%)", animation: "aurora3 27s ease-in-out infinite" })}
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
  const [useAi, setUseAi] = React.useState(true); // signed-in users get LLM grouping (with local fallback)
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
    <div style={{ position: "fixed", inset: 0, display: "flex", flexDirection: "column", background: C.bgMesh, fontFamily: C.font }}>
      <AuroraBg />
      <TopBar screen={screen} summary={result} fromLibrary={fromLibrary} auth={auth} onHome={home} onReupload={reupload} onBrowse={browse} onAdmin={openAdmin} />
      <div style={{ position: "relative", zIndex: 1, flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>
        <React.Suspense fallback={<ScreenFallback />}>
          {screen === "landing" && <LandingScreen papers={papers} handouts={handouts} setPapers={setPapers} setHandouts={setHandouts} onStart={start} onBrowse={browse} auth={auth} useAi={useAi} setUseAi={setUseAi} />}
          {screen === "library" && <LibraryScreen onOpen={openSubject} onUpload={reupload} />}
          {screen === "admin" && (auth.isAdmin ? <AdminScreen onBack={browse} /> : <LibraryScreen onOpen={openSubject} onUpload={reupload} />)}
          {screen === "loading" && <LoadingScreen papers={papers.map((p) => p.pages)} slides={handouts} aiGroup={auth.user && useAi ? groupViaApi : undefined} onDone={onDone} onError={reupload} />}
          {screen === "analysis" && (result
            ? <AnalysisScreen data={result} onGroupsChange={onGroupsChange} canSave={auth.isAdmin && !fromLibrary} fromLibrary={fromLibrary}
                done={done} starred={starred} onToggleDone={toggleIn(setDone)} onToggleStar={toggleIn(setStarred)} />
            : <LandingScreen papers={papers} handouts={handouts} setPapers={setPapers} setHandouts={setHandouts} onStart={start} onBrowse={browse} auth={auth} useAi={useAi} setUseAi={setUseAi} />)}
        </React.Suspense>
      </div>
    </div>);
}
