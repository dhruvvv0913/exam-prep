// Shared UI atoms for PYQ-LY. Ported verbatim from prototype-ui.jsx.
import React from "react";
import { C, hexA } from "../theme.js";
import { useReveal } from "../useReveal.js";

// Animated number: tweens to `to` (from 0 on first mount, then between changes)
// with an easeOutCubic. Used for headline stats / progress so they feel alive.
// Respects reduced-motion by snapping (a near-zero duration).
export function CountUp({ to, dur = 750, suffix = "" }) {
  const [n, setN] = React.useState(0);
  const fromRef = React.useRef(0);
  React.useEffect(() => {
    const reduce = typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches;
    const from = fromRef.current;
    if (reduce || dur <= 0) { setN(to); fromRef.current = to; return; }
    let raf, start;
    const tick = (t) => {
      if (!start) start = t;
      const p = Math.min(1, (t - start) / dur);
      const eased = 1 - Math.pow(1 - p, 3);
      setN(Math.round(from + (to - from) * eased));
      if (p < 1) raf = requestAnimationFrame(tick); else fromRef.current = to;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [to, dur]);
  return <React.Fragment>{n}{suffix}</React.Fragment>;
}

export function Logo({ onClick }) {
  return (
    <div onClick={onClick} style={{ display: "flex", alignItems: "center", gap: 10, cursor: onClick ? "pointer" : "default", userSelect: "none" }}>
      <div style={{ width: 32, height: 32, borderRadius: 9, background: C.grad, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: C.gradGlow }}>
        <div style={{ width: 13, height: 13, borderRadius: "50%", background: "#fff" }} />
      </div>
      <span style={{ fontFamily: C.font, fontWeight: 700, fontSize: 19, letterSpacing: -0.2, background: C.grad, WebkitBackgroundClip: "text", backgroundClip: "text", WebkitTextFillColor: "transparent" }}>PYQ-LY</span>
    </div>);
}

export function Tag({ children, tone = "muted", title }) {
  const map = {
    muted: { bg: C.card2, bd: C.line, fg: C.muted },
    primary: { bg: C.primarySoft, bd: "transparent", fg: C.primary },
    gold: { bg: C.goldSoft, bd: "transparent", fg: C.gold },
    good: { bg: C.goodSoft, bd: "transparent", fg: C.good },
  };
  const t = map[tone] || map.muted;
  return (
    <span title={title} style={{ fontFamily: C.font, fontSize: 12.5, fontWeight: 500, padding: "3px 11px", borderRadius: 999, background: t.bg, border: `1px solid ${t.bd}`, color: t.fg, whiteSpace: "nowrap", display: "inline-flex", alignItems: "center", gap: 5 }}>
      {children}
    </span>);
}

export function HeatBar({ value, max, w = 64 }) {
  const pct = Math.max(12, Math.round((value / (max || 1)) * 100));
  return (
    <div style={{ width: w, height: 6, borderRadius: 999, background: C.track, overflow: "hidden", flex: "0 0 auto" }}>
      <div style={{ width: pct + "%", height: "100%", background: `linear-gradient(90deg, ${C.primary}, #a78bfa)`, borderRadius: 999, transformOrigin: "left", animation: "growx .9s cubic-bezier(.4,0,.2,1) both" }} />
    </div>);
}

export function PrimaryButton({ children, onClick, disabled, glow, shine, w, size = "md" }) {
  const pad = size === "lg" ? "15px 32px" : "12px 26px";
  const fs = size === "lg" ? 17 : 15;
  return (
    <button onClick={disabled ? undefined : onClick} disabled={disabled}
      style={{
        position: "relative", overflow: shine && !disabled ? "hidden" : "visible",
        fontFamily: C.font, fontSize: fs, fontWeight: 600, padding: pad, width: w || "auto",
        display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 9,
        color: "#fff", background: disabled ? C.line2 : C.grad, border: "none",
        borderRadius: 12, cursor: disabled ? "not-allowed" : "pointer",
        boxShadow: disabled ? "none" : C.gradGlow,
        transition: "transform .14s ease, box-shadow .2s, filter .2s",
        ...(glow && !disabled ? { animation: "glow 1.9s ease-in-out infinite" } : {}),
      }}
      onMouseEnter={(e) => { if (!disabled) { e.currentTarget.style.transform = "translateY(-1px)"; e.currentTarget.style.filter = "brightness(1.05)"; } }}
      onMouseDown={(e) => { if (!disabled) e.currentTarget.style.transform = "scale(0.97)"; }}
      onMouseUp={(e) => { if (!disabled) e.currentTarget.style.transform = "translateY(-1px)"; }}
      onMouseLeave={(e) => { e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.filter = "none"; }}>
      {shine && !disabled && (
        <span aria-hidden style={{ position: "absolute", top: "-40%", bottom: "-40%", left: 0, width: "34%", background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.35), transparent)", animation: "shine 2.6s ease-in-out infinite", animationDelay: "1s", pointerEvents: "none" }} />
      )}
      {children}
    </button>);
}

export function GhostButton({ children, onClick }) {
  return (
    <button onClick={onClick}
      onMouseEnter={(e) => { e.currentTarget.style.transform = "translateY(-1px)"; e.currentTarget.style.borderColor = hexA(C.primary, 0.45); e.currentTarget.style.boxShadow = C.shadowMd; e.currentTarget.style.color = C.primary; }}
      onMouseLeave={(e) => { e.currentTarget.style.transform = "none"; e.currentTarget.style.borderColor = C.line; e.currentTarget.style.boxShadow = C.shadowSm; e.currentTarget.style.color = C.ink2; }}
      style={{
        fontFamily: C.font, fontSize: 14, fontWeight: 500, padding: "9px 18px",
        color: C.ink2, background: C.card, border: `1px solid ${C.line}`, borderRadius: 11,
        cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 7, boxShadow: C.shadowSm,
      }}>{children}</button>);
}

// Scroll-triggered entrance: fades/rises `children` in once they cross into
// view (see useReveal.js + .pyq-reveal in index.css), instead of animating
// everything at mount whether or not it's on screen yet.
export function Reveal({ children, delay = 0, style }) {
  const ref = useReveal();
  return <div ref={ref} className="pyq-reveal" style={{ transitionDelay: `${delay}s`, ...style }}>{children}</div>;
}

// Cursor-following ambient glow behind `children` — for hero sections. Tracks
// the pointer via a CSS custom property (no re-render), so it's cheap even
// with a large hero. Falls back to a fixed, centered glow with no listener
// cost until the user actually moves the mouse over it.
export function Spotlight({ children, tint = C.primary, size = 620, style }) {
  const ref = React.useRef(null);
  const onMove = (e) => {
    const el = ref.current; if (!el) return;
    const r = el.getBoundingClientRect();
    el.style.setProperty("--sx", `${e.clientX - r.left}px`);
    el.style.setProperty("--sy", `${e.clientY - r.top}px`);
  };
  return (
    <div ref={ref} onMouseMove={onMove} style={{ position: "relative", ...style }}>
      <div aria-hidden style={{
        position: "absolute", inset: 0, zIndex: 0, pointerEvents: "none", borderRadius: "inherit",
        background: `radial-gradient(${size}px circle at var(--sx,50%) var(--sy,-40px), ${hexA(tint, 0.14)}, transparent 62%)`,
      }} />
      <div style={{ position: "relative", zIndex: 1 }}>{children}</div>
    </div>);
}

// Cursor-reactive card: a subtle 3D tilt (set `max={0}` to disable rotation
// and keep just the glare/edge-glow) plus a glare highlight and a glowing
// border ring that both follow the pointer — all driven by direct style
// mutation on the ref (no re-render per mousemove) and CSS classes in
// index.css (.pyq-tilt / .pyq-glare / .pyq-edge) so the reveal is a plain
// :hover transition, not JS-timed.
export function TiltCard({ children, style, max = 6, tint = C.primary, className = "" }) {
  const ref = React.useRef(null);
  const reduce = React.useRef(false);
  React.useEffect(() => {
    reduce.current = typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches;
  }, []);
  const onMove = (e) => {
    const el = ref.current; if (!el || reduce.current) return;
    const r = el.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width, py = (e.clientY - r.top) / r.height;
    if (max > 0) {
      const rx = ((0.5 - py) * max * 2).toFixed(2), ry = ((px - 0.5) * max * 2).toFixed(2);
      el.style.transform = `perspective(800px) rotateX(${rx}deg) rotateY(${ry}deg)`;
    }
    el.style.setProperty("--mx", `${(px * 100).toFixed(1)}%`);
    el.style.setProperty("--my", `${(py * 100).toFixed(1)}%`);
  };
  const onLeave = () => { const el = ref.current; if (el) el.style.transform = ""; };
  return (
    <div ref={ref} className={`pyq-tilt ${className}`} onMouseMove={onMove} onMouseLeave={onLeave}
      style={{ position: "relative", ...style }}>
      <div aria-hidden className="pyq-glare" style={{ position: "absolute", inset: 0, zIndex: 2, borderRadius: "inherit", pointerEvents: "none", background: `radial-gradient(240px circle at var(--mx,50%) var(--my,50%), rgba(255,255,255,0.09), transparent 60%)` }} />
      <div aria-hidden className="pyq-edge" style={{
        position: "absolute", inset: 0, zIndex: 2, borderRadius: "inherit", padding: 1, pointerEvents: "none",
        background: `radial-gradient(280px circle at var(--mx,50%) var(--my,50%), ${hexA(tint, 0.7)}, transparent 62%)`,
        WebkitMask: "linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)", WebkitMaskComposite: "xor", maskComposite: "exclude",
      }} />
      {children}
    </div>);
}

// Barely-there film-grain texture over the whole app — the 2026 "tactile"
// counterpart to a flat gradient background. Pure SVG data-URI (no network
// request, no external CDN), so it fits the app's self-hosted-only rule.
const GRAIN_SVG = "data:image/svg+xml;utf8," + encodeURIComponent(
  "<svg xmlns='http://www.w3.org/2000/svg' width='140' height='140'>" +
  "<filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/>" +
  "<feColorMatrix type='matrix' values='0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 0.06 0'/></filter>" +
  "<rect width='100%' height='100%' filter='url(#n)'/></svg>"
);
export function Grain() {
  return (
    <div aria-hidden style={{
      position: "fixed", inset: 0, zIndex: 1, pointerEvents: "none",
      backgroundImage: `url("${GRAIN_SVG}")`, backgroundSize: "140px 140px", opacity: 0.035, mixBlendMode: "overlay",
    }} />);
}

// soft drifting background field
export function FloatField({ tint = C.primary }) {
  const shapes = [
    { t: "14%", l: "7%", s: 54, d: 0, k: "fl1" },
    { t: "66%", l: "12%", s: 34, d: 1.6, k: "fl2" },
    { t: "22%", l: "84%", s: 44, d: 0.9, k: "fl3" },
    { t: "72%", l: "80%", s: 28, d: 2.3, k: "fl1" },
    { t: "46%", l: "50%", s: 22, d: 1.2, k: "fl2" },
  ];
  return (
    <div style={{ position: "absolute", inset: 0, overflow: "hidden", pointerEvents: "none" }}>
      {shapes.map((sh, i) => (
        <div key={i} style={{ position: "absolute", top: sh.t, left: sh.l, "--amp": "16px", animation: `${sh.k} 7s ease-in-out ${sh.d}s infinite` }}>
          <svg width={sh.s} height={sh.s} viewBox="0 0 40 40" fill={hexA(tint, 0.05)} stroke={hexA(tint, 0.16)} strokeWidth="1.6">
            {i % 3 === 0 && <circle cx="20" cy="20" r="16" />}
            {i % 3 === 1 && <path d="M20 6 L34 32 L6 32 Z" />}
            {i % 3 === 2 && <rect x="6" y="6" width="28" height="28" rx="6" transform="rotate(12 20 20)" />}
          </svg>
        </div>))}
    </div>);
}
