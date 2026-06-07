// One-time, dismissible tip banner. Each tip has a stable `id`; once dismissed
// it's remembered in localStorage and never shown again. Kept intentionally few
// (just the key features) so onboarding doesn't get annoying.
import React from "react";
import { C, hexA } from "../theme.js";
import { IconSparkle, IconClose } from "./icons.jsx";

const KEY = "pyqly-tips";
const seenSet = () => { try { return new Set(JSON.parse(localStorage.getItem(KEY)) || []); } catch { return new Set(); } };
export const tipSeen = (id) => seenSet().has(id);
export const markTipSeen = (id) => { try { const s = seenSet(); s.add(id); localStorage.setItem(KEY, JSON.stringify([...s])); } catch (e) {} };

export default function Tip({ id, title, children }) {
  const [show, setShow] = React.useState(() => !tipSeen(id));
  if (!show) return null;
  const dismiss = () => { markTipSeen(id); setShow(false); };
  return (
    <div style={{ display: "flex", alignItems: "flex-start", gap: 12, background: "#fff", border: `1px solid ${hexA(C.primary, 0.3)}`, borderRadius: 14, padding: "13px 15px", boxShadow: C.shadowSm, marginBottom: 18, animation: "rise .4s ease backwards", width: "100%", boxSizing: "border-box" }}>
      <div style={{ width: 32, height: 32, flex: "0 0 auto", borderRadius: 9, background: C.grad, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: C.gradGlow }}>
        <IconSparkle s={16} c="#fff" />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontFamily: C.font, fontWeight: 600, fontSize: 14, color: C.ink, marginBottom: 2 }}>{title}</div>
        <div style={{ fontFamily: C.font, fontSize: 13, color: C.muted, lineHeight: 1.5 }}>{children}</div>
      </div>
      <button onClick={dismiss} title="Got it" style={{ background: "none", border: "none", padding: 4, cursor: "pointer", display: "flex", flex: "0 0 auto" }}>
        <IconClose s={16} c={C.faint} />
      </button>
    </div>);
}
