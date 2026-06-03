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
};

export function hexA(hex, a) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}
