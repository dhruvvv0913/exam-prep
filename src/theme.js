// Shared hi-fi design tokens for the PYQ-LY app. Ported verbatim from the
// design prototype (prototype-ui.jsx).

export const C = {
  bg: "#edeffa",
  card: "#ffffff",
  ink: "#191c33",
  ink2: "#3a3f5c",
  muted: "#6c7191",
  faint: "#9a9fb8",
  line: "#e5e7f3",
  lineSoft: "#eef0f8",
  primary: "#3f51c4",
  primaryDark: "#2f3fa5",
  primarySoft: "#ecedfb",
  primaryTint: "rgba(63,81,196,0.07)",
  gold: "#d99423",
  goldSoft: "#f9f0db",
  good: "#2f9e6f",
  goodSoft: "#e6f4ee",
  shadowSm: "0 1px 2px rgba(25,28,51,0.05), 0 2px 6px rgba(25,28,51,0.04)",
  shadowMd: "0 4px 14px rgba(25,28,51,0.07), 0 10px 30px rgba(25,28,51,0.06)",
  shadowLg: "0 18px 50px rgba(25,28,51,0.16)",
  font: "'Poppins', system-ui, -apple-system, sans-serif",
  // modern/vibrant accents
  violet: "#7a5cd8",
  grad: "linear-gradient(135deg, #5b6cf0 0%, #3f51c4 56%, #7a5cd8 100%)",
  gradGlow: "0 10px 26px rgba(76,70,196,0.34)",
  // soft colored mesh behind the whole app
  bgMesh: "radial-gradient(820px 460px at 10% -8%, rgba(99,110,240,0.13), transparent 60%), radial-gradient(760px 480px at 100% -2%, rgba(138,108,224,0.12), transparent 55%), radial-gradient(700px 600px at 50% 115%, rgba(99,110,240,0.08), transparent 60%), #edeffa",
};

export function hexA(hex, a) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}
