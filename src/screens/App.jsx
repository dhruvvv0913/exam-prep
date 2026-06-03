// App shell + screen state machine + localStorage persistence.
// Ported from prototype-app.jsx.
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
function TopBar({ screen, onHome, onReupload }) {
  const isMobile = useIsMobile();
  return (
    <div style={{ flex: "0 0 auto", height: 66, display: "flex", alignItems: "center", justifyContent: "space-between", padding: isMobile ? "0 16px" : "0 32px", borderBottom: `1px solid ${C.line}`, background: "rgba(255,255,255,0.78)", backdropFilter: "blur(10px)", zIndex: 10 }}>
      <Logo onClick={onHome} />
      <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
        {screen === "analysis"
          ? <React.Fragment>
              {!isMobile && <span style={{ fontFamily: C.font, fontSize: 13.5, color: C.muted }}>4 papers · 86 questions</span>}
              <GhostButton onClick={onReupload}><IconUpload s={16} c={C.ink2} /> Re-upload</GhostButton>
            </React.Fragment>
          : <nav style={{ display: "flex", alignItems: "center", gap: isMobile ? 14 : 26, fontFamily: C.font, fontSize: 14, color: C.muted }}>
              {!isMobile && <React.Fragment><span>How it works</span><span>Subjects</span></React.Fragment>}
              <span style={{ padding: "8px 18px", border: `1px solid ${C.line}`, borderRadius: 10, color: C.ink2, fontWeight: 500 }}>Sign in</span>
            </nav>}
      </div>
    </div>);
}

// ======================================================================
// APP
// ======================================================================
const LS = "pyqly-proto-v1";

export default function App() {
  const saved = (() => { try { return JSON.parse(localStorage.getItem(LS)) || {}; } catch (e) { return {}; } })();
  const [screen, setScreen] = React.useState(saved.screen || "landing");
  const [papers, setPapers] = React.useState(saved.papers || []);
  const [handouts, setHandouts] = React.useState(saved.handouts || []);

  React.useEffect(() => {
    try { localStorage.setItem(LS, JSON.stringify({ screen, papers, handouts })); } catch (e) {}
  }, [screen, papers, handouts]);

  const home = () => setScreen("landing");
  const reupload = () => setScreen("landing");

  return (
    <div style={{ position: "fixed", inset: 0, display: "flex", flexDirection: "column", background: C.bg, fontFamily: C.font }}>
      <TopBar screen={screen} onHome={home} onReupload={reupload} />
      {screen === "landing" && <LandingScreen papers={papers} handouts={handouts} setPapers={setPapers} setHandouts={setHandouts} onStart={() => setScreen("loading")} />}
      {screen === "loading" && <LoadingScreen onDone={() => setScreen("analysis")} />}
      {screen === "analysis" && <AnalysisScreen />}
    </div>);
}
