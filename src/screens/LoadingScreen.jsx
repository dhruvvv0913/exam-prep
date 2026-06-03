// Loading screen: runs the real analysis pipeline and shows live progress
// through its four stages, then hands the result to the analysis screen.
import React from "react";
import { C, hexA } from "../theme.js";
import { IconCheck } from "../components/icons.jsx";
import { FloatField, PrimaryButton } from "../components/atoms.jsx";
import { analyze } from "../engine/pipeline.js";

function ScanDoc() {
  const card = (extra) => ({ position: "absolute", width: 128, height: 158, borderRadius: 14, background: "#fff", border: `1px solid ${C.line}`, boxShadow: C.shadowMd, ...extra });
  return (
    <div style={{ position: "relative", width: 190, height: 184 }}>
      <div style={card({ left: 16, top: 20, transform: "rotate(-8deg)", opacity: 0.5 })} />
      <div style={card({ left: 44, top: 14, transform: "rotate(6deg)", opacity: 0.8 })} />
      <div style={{ ...card({ left: 30, top: 16 }), overflow: "hidden", display: "flex", flexDirection: "column", gap: 9, padding: 18 }}>
        <div style={{ width: "55%", height: 9, background: C.primary, borderRadius: 5 }} />
        {[1, 0.9, 1, 0.6].map((w, i) => <div key={i} style={{ width: `${w * 100}%`, height: 7, background: "#e6e8f2", borderRadius: 5 }} />)}
        <div style={{ position: "absolute", left: 0, right: 0, top: 0, height: 3, background: `linear-gradient(90deg, transparent, ${C.primary}, transparent)`, boxShadow: `0 0 14px ${C.primary}`, animation: "scan 2s ease-in-out infinite" }} />
      </div>
    </div>);
}

function StepIcon({ state }) {
  if (state === "done") return <div style={{ width: 26, height: 26, borderRadius: "50%", background: C.good, display: "flex", alignItems: "center", justifyContent: "center", flex: "0 0 auto" }}><IconCheck s={14} sw={2.6} /></div>;
  if (state === "active") return <div className="pyq-spin" style={{ width: 26, height: 26, borderRadius: "50%", border: `3px solid ${hexA(C.primary, 0.22)}`, borderTopColor: C.primary, flex: "0 0 auto" }} />;
  return <div style={{ width: 26, height: 26, borderRadius: "50%", border: `2px solid #d3d6e6`, flex: "0 0 auto" }} />;
}

// Map a pipeline progress event to a step index + short note.
const STAGE_STEP = { reading: 0, ocr: 0, extracted: 1, clustering: 2, ranking: 3 };

export default function LoadingScreen({ papers, onDone, onError }) {
  const stepDefs = [
    { label: "Reading your papers" },
    { label: "Extracting questions" },
    { label: "Grouping similar questions" },
    { label: "Ranking by importance" },
  ];
  const [active, setActive] = React.useState(0);
  const [notes, setNotes] = React.useState(["", "", "", ""]);
  const [error, setError] = React.useState(null);

  React.useEffect(() => {
    let cancelled = false;
    const setNote = (i, text) => setNotes((n) => { const c = n.slice(); c[i] = text; return c; });

    analyze(papers, {
      onProgress: (p) => {
        if (cancelled) return;
        const step = STAGE_STEP[p.stage] ?? 0;
        setActive(step);
        if (p.stage === "reading") setNote(0, `${p.index + 1} of ${p.total}`);
        else if (p.stage === "ocr") setNote(0, `scanning page ${p.done}/${p.total}…`);
        else if (p.stage === "extracted") setNote(1, `${p.questions} found`);
        else if (p.stage === "clustering") setNote(2, "grouping…");
      },
    })
      .then((result) => {
        if (cancelled) return;
        setActive(stepDefs.length); // all done
        setTimeout(() => !cancelled && onDone(result), 400);
      })
      .catch((err) => {
        if (cancelled) return;
        console.error(err);
        setError(err?.message || "Something went wrong while analysing your papers.");
      });

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div style={{ position: "relative", flex: 1, minHeight: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "0 32px", overflow: "hidden" }}>
      <FloatField />
      <div style={{ position: "relative", zIndex: 1, width: "100%", maxWidth: 500, display: "flex", flexDirection: "column", alignItems: "center" }}>
        <ScanDoc />
        <div style={{ fontFamily: C.font, fontWeight: 600, fontSize: 30, color: C.ink, marginTop: 26, letterSpacing: -0.3 }}>Analysing your papers</div>
        <div style={{ fontFamily: C.font, fontSize: 14.5, color: C.muted, marginTop: 7, textAlign: "center", lineHeight: 1.5 }}>
          Finding the questions that actually repeat. Scanned PDFs take a little longer.
        </div>

        {error ? (
          <div style={{ marginTop: 28, width: "100%", display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
            <div style={{ fontFamily: C.font, fontSize: 14.5, color: "#c0392b", textAlign: "center", lineHeight: 1.5 }}>{error}</div>
            <PrimaryButton onClick={onError}>Back to upload</PrimaryButton>
          </div>
        ) : (
          <React.Fragment>
            <div style={{ width: "100%", height: 9, borderRadius: 999, background: "#e3e5f1", overflow: "hidden", marginTop: 28 }}>
              <div style={{ height: "100%", borderRadius: 999, background: `linear-gradient(90deg, ${C.primary}, #5b6cdb)`, width: `${Math.min(100, (active / stepDefs.length) * 100 + 8)}%`, transition: "width .6s cubic-bezier(.4,0,.2,1)" }} />
            </div>

            <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: 14, marginTop: 22 }}>
              {stepDefs.map((s, i) => {
                const state = i < active ? "done" : i === active ? "active" : "pending";
                return (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 14, opacity: state === "pending" ? 0.45 : 1, transition: "opacity .3s" }}>
                    <StepIcon state={state} />
                    <span style={{ fontFamily: C.font, fontSize: 15, fontWeight: state === "active" ? 600 : 500, color: C.ink }}>{s.label}</span>
                    {notes[i] && <span style={{ fontFamily: C.font, fontSize: 12.5, color: state === "active" ? C.primary : C.faint, marginLeft: "auto" }}>{notes[i]}</span>}
                  </div>);
              })}
            </div>
          </React.Fragment>
        )}
      </div>
    </div>);
}
