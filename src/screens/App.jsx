// App shell + screen state machine. Holds uploaded files in memory and the
// analysis result (which is persisted so a returning user sees it again).
import React from "react";
import { C } from "../theme.js";
import { IconUpload } from "../components/icons.jsx";
import { Logo, GhostButton } from "../components/atoms.jsx";
import { useIsMobile } from "../useIsMobile.js";
import LandingScreen from "./LandingScreen.jsx";
import LoadingScreen from "./LoadingScreen.jsx";
import AnalysisScreen from "./AnalysisScreen.jsx";

// ======================================================================
// TOP BAR
// ======================================================================
function TopBar({ screen, summary, onHome, onReupload }) {
  const isMobile = useIsMobile();
  return (
    <div style={{ flex: "0 0 auto", height: 66, display: "flex", alignItems: "center", justifyContent: "space-between", padding: isMobile ? "0 16px" : "0 32px", borderBottom: `1px solid ${C.line}`, background: "rgba(255,255,255,0.78)", backdropFilter: "blur(10px)", zIndex: 10 }}>
      <Logo onClick={onHome} />
      <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
        {screen === "analysis"
          ? <React.Fragment>
              {!isMobile && summary && <span style={{ fontFamily: C.font, fontSize: 13.5, color: C.muted }}>{summary.paperCount} papers · {summary.questionCount} questions</span>}
              <GhostButton onClick={onReupload}><IconUpload s={16} c={C.ink2} /> Re-upload</GhostButton>
            </React.Fragment>
          : !isMobile && (
              <span style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "6px 13px", border: `1px solid ${C.line}`, borderRadius: 999, background: "#fff", fontFamily: C.font, fontSize: 12.5, fontWeight: 500, color: C.muted }}>
                <span style={{ width: 7, height: 7, borderRadius: "50%", background: C.good }} /> Free · runs in your browser
              </span>
            )}
      </div>
    </div>);
}

// ======================================================================
// APP
// ======================================================================
const LS = "pyqly-proto-v1";

export default function App() {
  const saved = (() => { try { return JSON.parse(localStorage.getItem(LS)) || {}; } catch (e) { return {}; } })();
  const [screen, setScreen] = React.useState(saved.result ? saved.screen || "analysis" : "landing");
  const [papers, setPapers] = React.useState([]);   // File objects (not persisted)
  const [handouts, setHandouts] = React.useState([]);
  const [result, setResult] = React.useState(saved.result || null); // analysis output
  // Star/done progress survives reloads (keyed by group id).
  const [done, setDone] = React.useState(() => new Set(saved.done || []));
  const [starred, setStarred] = React.useState(() => new Set(saved.starred || []));

  // Persist the analysis result + progress + screen (File objects can't be).
  React.useEffect(() => {
    try { localStorage.setItem(LS, JSON.stringify({ screen, result, done: [...done], starred: [...starred] })); } catch (e) {}
  }, [screen, result, done, starred]);

  const toggleIn = (setter) => (id) => setter((prev) => {
    const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next;
  });

  const home = () => setScreen("landing");
  const reupload = () => { setPapers([]); setHandouts([]); setScreen("landing"); };
  const start = () => setScreen("loading");
  // A fresh analysis means new groups — reset progress.
  const onDone = (r) => { setResult(r); setDone(new Set()); setStarred(new Set()); setScreen("analysis"); };
  const onGroupsChange = (groups) => setResult((r) => ({ ...r, groups }));

  return (
    <div style={{ position: "fixed", inset: 0, display: "flex", flexDirection: "column", background: C.bg, fontFamily: C.font }}>
      <TopBar screen={screen} summary={result} onHome={home} onReupload={reupload} />
      {screen === "landing" && <LandingScreen papers={papers} handouts={handouts} setPapers={setPapers} setHandouts={setHandouts} onStart={start} />}
      {screen === "loading" && <LoadingScreen papers={papers.map((p) => p.pages)} onDone={onDone} onError={reupload} />}
      {screen === "analysis" && (result
        ? <AnalysisScreen data={result} onGroupsChange={onGroupsChange}
            done={done} starred={starred} onToggleDone={toggleIn(setDone)} onToggleStar={toggleIn(setStarred)} />
        : <LandingScreen papers={papers} handouts={handouts} setPapers={setPapers} setHandouts={setHandouts} onStart={start} />)}
    </div>);
}
