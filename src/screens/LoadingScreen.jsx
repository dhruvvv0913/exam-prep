// Loading screen: runs the real analysis pipeline and shows live progress,
// AND plays a small auto-advancing "feature tour" so the wait teaches the user
// what they'll be able to do once the results are ready.
import React from "react";
import { C, hexA } from "../theme.js";
import { IconCheck, IconStar, IconSparkle, IconLayers, IconArrow } from "../components/icons.jsx";
import { FloatField } from "../components/atoms.jsx";
import { useIsMobile } from "../useIsMobile.js";
import { analyze } from "../engine/pipeline.js";

function ScanDoc() {
  const card = (extra) => ({ position: "absolute", width: 112, height: 138, borderRadius: 14, background: C.card, border: `1px solid ${C.line}`, boxShadow: C.shadowMd, ...extra });
  return (
    <div style={{ position: "relative", width: 170, height: 162 }}>
      <div style={card({ left: 14, top: 18, transform: "rotate(-8deg)", opacity: 0.5 })} />
      <div style={card({ left: 40, top: 12, transform: "rotate(6deg)", opacity: 0.8 })} />
      <div style={{ ...card({ left: 28, top: 14 }), overflow: "hidden", display: "flex", flexDirection: "column", gap: 8, padding: 16 }}>
        <div style={{ width: "55%", height: 8, background: C.primary, borderRadius: 5 }} />
        {[1, 0.9, 1, 0.6].map((w, i) => <div key={i} style={{ width: `${w * 100}%`, height: 6, background: C.track, borderRadius: 5 }} />)}
        <div style={{ position: "absolute", left: 0, right: 0, top: 0, height: 3, background: `linear-gradient(90deg, transparent, ${C.primary}, transparent)`, boxShadow: `0 0 14px ${C.primary}`, animation: "scan 2s ease-in-out infinite" }} />
      </div>
    </div>);
}

function StepIcon({ state }) {
  if (state === "done") return <div style={{ width: 24, height: 24, borderRadius: "50%", background: C.good, display: "flex", alignItems: "center", justifyContent: "center", flex: "0 0 auto" }}><IconCheck s={13} sw={2.6} /></div>;
  if (state === "active") return <div className="pyq-spin" style={{ width: 24, height: 24, borderRadius: "50%", border: `3px solid ${hexA(C.primary, 0.22)}`, borderTopColor: C.primary, flex: "0 0 auto" }} />;
  return <div style={{ width: 24, height: 24, borderRadius: "50%", border: `2px solid ${C.line2}`, flex: "0 0 auto" }} />;
}

// ---- feature-tour illustrations (pure CSS/SVG, replay on slide change) ------

function RankViz() {
  const row = (rank, topic, w, reps, delay) => (
    <div style={{ display: "flex", alignItems: "center", gap: 10, animation: `tourin .5s ${delay}s both` }}>
      <div style={{ width: 24, height: 24, flex: "0 0 auto", borderRadius: "50%", background: rank === 1 ? C.grad : C.primarySoft, color: rank === 1 ? "#fff" : C.primary, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: C.font, fontWeight: 700, fontSize: 12, boxShadow: rank === 1 ? C.gradGlow : "none" }}>{rank}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontFamily: C.font, fontSize: 11.5, fontWeight: 600, color: C.ink2, marginBottom: 5, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{topic}</div>
        <div style={{ height: 6, borderRadius: 999, background: C.track, overflow: "hidden" }}>
          <div style={{ height: "100%", width: `${w}%`, background: `linear-gradient(90deg, ${C.primary}, ${C.violet})`, borderRadius: 999, transformOrigin: "left", animation: `growx .9s ${delay + 0.25}s both cubic-bezier(.4,0,.2,1)` }} />
        </div>
      </div>
      <span style={{ fontFamily: C.font, fontSize: 10.5, fontWeight: 700, color: C.faint, flex: "0 0 auto" }}>×{reps}</span>
    </div>
  );
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 13, width: "100%" }}>
      {row(1, "Booth's multiplication", 92, 5, 0)}
      {row(2, "Cache hit-ratio numericals", 64, 3, 0.16)}
      {row(3, "Addressing modes", 44, 2, 0.32)}
    </div>);
}

function ViewsViz() {
  const chip = (t, delay) => (
    <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 11px", background: C.card2, border: `1px solid ${C.lineSoft}`, borderRadius: 10, animation: `tourin .5s ${delay}s both` }}>
      <div style={{ width: 6, height: 6, borderRadius: "50%", background: C.violet, flex: "0 0 auto" }} />
      <div style={{ fontFamily: C.font, fontSize: 11.5, color: C.ink2 }}>{t}</div>
    </div>
  );
  return (
    <div style={{ width: "100%" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 11, animation: "tourin .5s both" }}>
        <div style={{ width: 34, height: 34, borderRadius: 10, background: C.primarySoft, display: "flex", alignItems: "center", justifyContent: "center", flex: "0 0 auto" }}>
          <IconLayers s={17} c={C.primary} />
        </div>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontFamily: C.font, fontSize: 13, fontWeight: 700, color: C.ink }}>Cache Memory.pptx</div>
          <div style={{ fontFamily: C.font, fontSize: 11, color: C.faint }}>3 question types · 18 marks</div>
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 7, marginLeft: 17, paddingLeft: 16, borderLeft: `2px solid ${C.lineSoft}` }}>
        {chip("Direct-mapping hit ratio", 0.15)}
        {chip("Write-back vs write-through", 0.3)}
        {chip("Associative mapping", 0.45)}
      </div>
    </div>);
}

function OriginalViz() {
  return (
    <div style={{ position: "relative", width: "100%", maxWidth: 280, height: 116, margin: "0 auto" }}>
      <div style={{ position: "absolute", inset: 0, background: C.card, border: `1px solid ${C.line}`, borderRadius: 12, padding: 14, animation: "fadeout .6s 2s both" }}>
        <div style={{ fontFamily: "ui-monospace, monospace", fontSize: 12, color: C.danger, lineHeight: 1.7 }}>Wh@t i$ th3 h!t r@ti0 0f<br />th3 c@ch3 m3m0ry 1f th3...</div>
        <div style={{ fontFamily: C.font, fontSize: 10.5, color: C.faint, marginTop: 10 }}>garbled scanned text</div>
      </div>
      <div style={{ position: "absolute", inset: 0, background: C.card, border: `1px solid ${hexA(C.primary, 0.4)}`, borderRadius: 12, padding: 14, opacity: 0, animation: "tourin .55s 2.15s both", boxShadow: C.shadowMd }}>
        <div style={{ fontFamily: "Georgia, 'Times New Roman', serif", fontSize: 12.5, color: C.ink, lineHeight: 1.55 }}>What is the hit ratio of the cache memory if the access time is 5 ns…</div>
        <div style={{ marginTop: 10, display: "flex", gap: 6, alignItems: "center" }}>
          <div style={{ width: 28, height: 18, border: `1.5px solid ${C.primary}`, borderRadius: 3 }} />
          <div style={{ width: 18, height: 18, border: `1.5px solid ${C.primary}`, borderRadius: "50%" }} />
          <span style={{ fontFamily: C.font, fontSize: 10, color: C.primary, fontWeight: 700, marginLeft: 2 }}>exact image ✓</span>
        </div>
      </div>
    </div>);
}

function ProgressViz() {
  const tile = (bg, bd, delay, icon, label, fg) => (
    <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 8, padding: "9px 11px", background: bg, border: `1px solid ${bd}`, borderRadius: 10 }}>
      <span style={{ display: "inline-flex", animation: `pop .5s ${delay}s both` }}>{icon}</span>
      <span style={{ fontFamily: C.font, fontSize: 11, color: fg, fontWeight: 600 }}>{label}</span>
    </div>
  );
  return (
    <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: 13 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontFamily: C.font, fontSize: 12, fontWeight: 600, color: C.ink2 }}>Studied 58%</span>
        <span style={{ fontFamily: C.font, fontSize: 11.5, color: C.faint }}>7 of 12 topics</span>
      </div>
      <div style={{ height: 8, borderRadius: 999, background: C.track, overflow: "hidden" }}>
        <div style={{ height: "100%", width: "58%", background: `linear-gradient(90deg, ${C.good}, #43c08a)`, borderRadius: 999, transformOrigin: "left", animation: "growx 1.1s .2s both cubic-bezier(.4,0,.2,1)" }} />
      </div>
      <div style={{ display: "flex", gap: 9 }}>
        {tile(C.card2, C.lineSoft, 0.8, <IconStar s={15} on c={C.gold} />, "Starred", C.muted)}
        {tile(C.goodSoft, hexA(C.good, 0.25), 1.1, <span style={{ width: 16, height: 16, borderRadius: "50%", background: C.good, display: "inline-flex", alignItems: "center", justifyContent: "center" }}><IconCheck s={10} sw={3} /></span>, "Done", C.good)}
      </div>
    </div>);
}

function SheetViz() {
  return (
    <div style={{ width: "100%", display: "flex", justifyContent: "center" }}>
      <div style={{ width: 152, background: C.card, border: `1px solid ${C.line}`, borderRadius: 10, padding: "13px 14px 15px", boxShadow: C.shadowMd, animation: "floaty 3s ease-in-out infinite" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 11 }}>
          <div style={{ width: "45%", height: 8, background: C.primary, borderRadius: 4 }} />
          <span style={{ fontFamily: C.font, fontSize: 9, fontWeight: 700, color: "#fff", background: C.grad, borderRadius: 5, padding: "2px 6px" }}>PDF</span>
        </div>
        {[90, 70, 82, 60, 75].map((w, n) => (
          <div key={n} style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 7, animation: `tourin .4s ${0.1 + n * 0.1}s both` }}>
            <div style={{ width: 5, height: 5, borderRadius: "50%", background: C.violet, flex: "0 0 auto" }} />
            <div style={{ height: 5, width: `${w}%`, background: C.track, borderRadius: 4 }} />
          </div>
        ))}
      </div>
    </div>);
}

const SLIDES = [
  { t: "Ranked by what repeats", c: "Questions are grouped by concept and ordered by how often they come back — so you study the top ones first.", V: RankViz },
  { t: "Two views, one tap apart", c: "Flip between By importance and By PPT to see exactly which chapter each question comes from.", V: ViewsViz },
  { t: "See the original, not garble", c: "Scanned text or a diagram? Tap “View original” for the exact image cropped from your paper.", V: OriginalViz },
  { t: "Star it, tick it, track it", c: "Star the important ones and check them off as you revise — your progress is saved on this device.", V: ProgressViz },
  { t: "One-tap study sheet", c: "Export a clean, printable study sheet (or the 1-mark list) to revise offline.", V: SheetViz },
];

function FeatureTour() {
  const [i, setI] = React.useState(0);
  const [paused, setPaused] = React.useState(false);
  React.useEffect(() => {
    if (paused) return;
    const t = setInterval(() => setI((x) => (x + 1) % SLIDES.length), 3000);
    return () => clearInterval(t);
  }, [paused, i]);
  const go = (d) => setI((x) => (x + d + SLIDES.length) % SLIDES.length);
  const arrowBtn = { width: 30, height: 30, flex: "0 0 auto", borderRadius: "50%", border: `1px solid ${C.line}`, background: C.card2, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", padding: 0, transition: "border-color .15s, background .15s" };
  const arrowHover = (e, on) => { e.currentTarget.style.borderColor = on ? hexA(C.primary, 0.5) : C.line; e.currentTarget.style.background = on ? C.primarySoft : C.card2; };
  const S = SLIDES[i];
  const Viz = S.V;
  return (
    <div onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}
      style={{ width: "100%", background: C.card, border: `1px solid ${C.line}`, borderRadius: 18, boxShadow: C.shadowMd, padding: "16px 20px 18px", overflow: "hidden", position: "relative" }}>
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: C.grad }} />
      <div style={{ fontFamily: C.font, fontSize: 10.5, fontWeight: 700, letterSpacing: 0.6, textTransform: "uppercase", color: C.primary, marginBottom: 14, display: "flex", alignItems: "center", gap: 7 }}>
        <IconSparkle s={13} c={C.primary} /> While you wait — what you’ll get
      </div>
      <div key={i} style={{ animation: "tourin .55s ease both" }}>
        <div style={{ minHeight: 124, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 14 }}>
          <Viz />
        </div>
        <div style={{ fontFamily: C.font, fontSize: 16, fontWeight: 600, color: C.ink, marginBottom: 4 }}>{S.t}</div>
        <div style={{ fontFamily: C.font, fontSize: 13, color: C.muted, lineHeight: 1.5, minHeight: 38 }}>{S.c}</div>
      </div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 12, marginTop: 14 }}>
        <button onClick={() => go(-1)} aria-label="Previous feature" style={arrowBtn}
          onMouseEnter={(e) => arrowHover(e, true)} onMouseLeave={(e) => arrowHover(e, false)}>
          <IconArrow s={15} c={C.muted} dir="left" />
        </button>
        <div style={{ display: "flex", gap: 6 }}>
          {SLIDES.map((_, n) => (
            <button key={n} onClick={() => setI(n)} aria-label={`Show feature ${n + 1}`}
              style={{ width: n === i ? 20 : 7, height: 7, borderRadius: 999, border: "none", padding: 0, cursor: "pointer", background: n === i ? C.primary : C.line2, transition: "width .3s ease, background .3s ease" }} />
          ))}
        </div>
        <button onClick={() => go(1)} aria-label="Next feature" style={arrowBtn}
          onMouseEnter={(e) => arrowHover(e, true)} onMouseLeave={(e) => arrowHover(e, false)}>
          <IconArrow s={15} c={C.muted} dir="right" />
        </button>
      </div>
    </div>);
}

export default function LoadingScreen({ papers, slides, aiGroup, aiScan, onDone, onError }) {
  const hasSlides = !!(slides && slides.length);
  // With slides we group AGAINST their topics, so the steps differ.
  const stepDefs = hasSlides
    ? [
        { label: "Reading your papers" },
        { label: "Extracting questions" },
        { label: "Reading your slides" },
        { label: "Grouping by slide topic" },
        { label: "Ranking by importance" },
      ]
    : [
        { label: "Reading your papers" },
        { label: "Extracting questions" },
        { label: "Grouping similar questions" },
        { label: "Ranking by importance" },
      ];
  // Map a pipeline progress event to a step index.
  const STAGE_STEP = hasSlides
    ? { reading: 0, ocr: 0, extracted: 1, slides: 2, topics: 3, clustering: 3, ranking: 4 }
    : { reading: 0, ocr: 0, extracted: 1, clustering: 2, ranking: 3 };
  const GROUP_STEP = hasSlides ? 3 : 2;

  const [active, setActive] = React.useState(0);
  const [notes, setNotes] = React.useState(() => stepDefs.map(() => ""));
  const isMobile = useIsMobile();

  React.useEffect(() => {
    let cancelled = false;
    const setNote = (i, text) => setNotes((n) => { const c = n.slice(); c[i] = text; return c; });

    analyze(papers, {
      slideFiles: hasSlides ? slides : undefined,
      aiGroup,
      aiScan,
      onProgress: (p) => {
        if (cancelled) return;
        const step = STAGE_STEP[p.stage] ?? 0;
        if (p.stage === "ai-fallback") { setNote(GROUP_STEP, "AI busy — using built-in grouping"); return; }
        if (p.stage === "ai-scan") { setActive(0); setNote(0, "hard to read — using AI scan…"); return; }
        if (p.stage === "paper-skipped") { setNote(0, `skipped ${p.paper} — unreadable`); return; }
        setActive(step);
        if (p.stage === "reading") setNote(0, `${p.index + 1} of ${p.total}`);
        else if (p.stage === "ocr") setNote(0, `scanning page ${p.done}/${p.total}…`);
        else if (p.stage === "extracted") setNote(1, `${p.questions} found`);
        else if (p.stage === "slides") setNote(2, `${p.index + 1} of ${p.total}`);
        else if (p.stage === "topics") setNote(3, `${p.topics} topic${p.topics === 1 ? "" : "s"} found`);
        else if (p.stage === "clustering") setNote(GROUP_STEP, p.ai ? "grouping with AI…" : p.anchored ? "matching to topics…" : "grouping…");
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
        // Roll straight back to the upload screen with the reason, rather than
        // sitting on a dead loading screen or showing a partial result.
        onError(err?.message || "Something went wrong while analysing your papers.");
      });

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pct = Math.min(100, (active / stepDefs.length) * 100 + 8);

  return (
    <div style={{ position: "relative", flex: 1, minHeight: 0, display: "flex", overflowY: "auto", padding: isMobile ? "20px 16px" : "28px 24px" }}>
      <FloatField />
      <div style={{ position: "relative", zIndex: 1, width: "100%", maxWidth: 540, margin: "auto", display: "flex", flexDirection: "column", alignItems: "center" }}>
        <ScanDoc />
        <div style={{ fontFamily: C.font, fontWeight: 600, fontSize: isMobile ? 24 : 28, color: C.ink, marginTop: 18, letterSpacing: -0.3, textAlign: "center" }}>Analysing your papers</div>
        <div style={{ fontFamily: C.font, fontSize: 14, color: C.muted, marginTop: 6, textAlign: "center", lineHeight: 1.5 }}>
          Finding the questions that actually repeat. Scanned PDFs take a little longer.
        </div>

        <React.Fragment>
            {/* overall progress */}
            <div style={{ width: "100%", height: 8, borderRadius: 999, background: C.track, overflow: "hidden", marginTop: 22, position: "relative" }}>
              <div style={{ height: "100%", borderRadius: 999, background: `linear-gradient(90deg, ${C.primary}, #a78bfa)`, width: `${pct}%`, transition: "width .6s cubic-bezier(.4,0,.2,1)" }} />
            </div>

            {/* the feature tour — the focal point while waiting */}
            <div style={{ width: "100%", marginTop: 20 }}>
              <FeatureTour />
            </div>

            {/* compact stage checklist */}
            <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: 11, marginTop: 18 }}>
              {stepDefs.map((s, i) => {
                const state = i < active ? "done" : i === active ? "active" : "pending";
                return (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, opacity: state === "pending" ? 0.45 : 1, transition: "opacity .3s" }}>
                    <StepIcon state={state} />
                    <span style={{ fontFamily: C.font, fontSize: 14, fontWeight: state === "active" ? 600 : 500, color: C.ink }}>{s.label}</span>
                    {notes[i] && <span style={{ fontFamily: C.font, fontSize: 12.5, color: state === "active" ? C.primary : C.faint, marginLeft: "auto" }}>{notes[i]}</span>}
                  </div>);
              })}
            </div>
        </React.Fragment>
      </div>
    </div>);
}
