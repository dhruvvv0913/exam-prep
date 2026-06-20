// Shared hi-fi design tokens for the PYQ-LY app.
// DARK theme — deep blue-black base, layered surfaces, low-opacity borders,
// a vibrant indigo→violet accent, and soft ambient colored glows (the kind of
// premium dark UI you see on Linear / Vercel / Raycast).

export const C = {
  bg: "#0a0b11",          // app base — deep blue-black
  card: "#14161f",        // primary surface (cards, modals, top bar)
  card2: "#1b1e29",       // elevated / nested surface (question rows, chip fills)
  ink: "#edeefb",         // primary text
  ink2: "#c3c7dd",        // secondary text
  muted: "#9499b6",       // tertiary text
  faint: "#6a6f88",       // faint text / uppercase labels
  line: "#272a39",        // hairline borders
  lineSoft: "#1e2130",    // softer borders / very subtle fills
  track: "#2a2d3c",       // progress / heat-bar tracks
  line2: "#3a3e52",       // mid UI gray: inactive dots, pending rings, disabled, dashed borders
  primary: "#828dff",     // accent (bright indigo — pops on dark)
  primaryDark: "#5b6cf0",
  primarySoft: "#1e2138", // dark indigo surface (chips, soft buttons)
  primaryTint: "rgba(130,141,255,0.12)",
  gold: "#e7b24e",
  goldSoft: "#2a2417",
  good: "#34d399",
  goodSoft: "#102a20",
  danger: "#ff6b6b",
  dangerSoft: "rgba(255,99,99,0.13)",
  dangerBorder: "rgba(255,99,99,0.32)",
  shadowSm: "0 1px 2px rgba(0,0,0,0.5), 0 2px 8px rgba(0,0,0,0.35)",
  shadowMd: "0 8px 24px rgba(0,0,0,0.5), 0 14px 44px rgba(0,0,0,0.4)",
  shadowLg: "0 28px 80px rgba(0,0,0,0.65)",
  font: "'Poppins', system-ui, -apple-system, sans-serif",
  // modern/vibrant accents
  violet: "#a78bfa",
  grad: "linear-gradient(135deg, #6e7bf7 0%, #5b6cf0 50%, #a78bfa 100%)",
  gradGlow: "0 10px 30px rgba(110,100,255,0.5)",
  // soft colored ambient glow behind the whole app, on near-black
  bgMesh: "radial-gradient(900px 520px at 8% -10%, rgba(110,100,255,0.16), transparent 60%), radial-gradient(820px 520px at 100% -4%, rgba(150,110,250,0.14), transparent 55%), radial-gradient(760px 640px at 50% 118%, rgba(90,100,240,0.10), transparent 60%), #0a0b11",
};

export function hexA(hex, a) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}
