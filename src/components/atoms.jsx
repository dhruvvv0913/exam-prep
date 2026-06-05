// Shared UI atoms for PYQ-LY. Ported verbatim from prototype-ui.jsx.
import { C, hexA } from "../theme.js";

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
    muted: { bg: "#f1f2f8", bd: C.line, fg: C.muted },
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
    <div style={{ width: w, height: 6, borderRadius: 999, background: "#e9eaf4", overflow: "hidden", flex: "0 0 auto" }}>
      <div style={{ width: pct + "%", height: "100%", background: `linear-gradient(90deg, ${C.primary}, #5b6cdb)`, borderRadius: 999 }} />
    </div>);
}

export function PrimaryButton({ children, onClick, disabled, glow, w, size = "md" }) {
  const pad = size === "lg" ? "15px 32px" : "12px 26px";
  const fs = size === "lg" ? 17 : 15;
  return (
    <button onClick={disabled ? undefined : onClick} disabled={disabled}
      style={{
        fontFamily: C.font, fontSize: fs, fontWeight: 600, padding: pad, width: w || "auto",
        display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 9,
        color: "#fff", background: disabled ? "#c2c6dd" : C.grad, border: "none",
        borderRadius: 12, cursor: disabled ? "not-allowed" : "pointer",
        boxShadow: disabled ? "none" : C.gradGlow,
        transition: "transform .14s ease, box-shadow .2s, filter .2s",
        ...(glow && !disabled ? { animation: "glow 1.9s ease-in-out infinite" } : {}),
      }}
      onMouseEnter={(e) => { if (!disabled) { e.currentTarget.style.transform = "translateY(-1px)"; e.currentTarget.style.filter = "brightness(1.05)"; } }}
      onMouseDown={(e) => { if (!disabled) e.currentTarget.style.transform = "scale(0.97)"; }}
      onMouseUp={(e) => { if (!disabled) e.currentTarget.style.transform = "translateY(-1px)"; }}
      onMouseLeave={(e) => { e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.filter = "none"; }}>
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
        color: C.ink2, background: "#fff", border: `1px solid ${C.line}`, borderRadius: 11,
        cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 7, boxShadow: C.shadowSm,
      }}>{children}</button>);
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
