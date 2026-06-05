// SVG icon set for PYQ-LY. Ported verbatim from prototype-ui.jsx.
import { C } from "../theme.js";

const Svg = ({ s = 24, children, fill = "none", stroke, sw = 1.8, vb = "0 0 24 24", style }) => (
  <svg width={s} height={s} viewBox={vb} fill={fill} stroke={stroke} strokeWidth={sw}
    strokeLinecap="round" strokeLinejoin="round" style={style}>{children}</svg>
);

export const IconUpload = ({ s = 24, c = C.ink }) => (
  <Svg s={s} stroke={c}><path d="M12 16V4" /><path d="M7 9l5-5 5 5" /><path d="M4 17v2a1 1 0 001 1h14a1 1 0 001-1v-2" /></Svg>
);
export const IconFile = ({ s = 16, c = C.muted }) => (
  <Svg s={s} stroke={c} sw={1.7}><path d="M6 2h7l5 5v15H6z" /><path d="M13 2v5h5" /></Svg>
);
export const IconStar = ({ s = 20, on, c = C.gold }) => (
  <Svg s={s} fill={on ? c : "none"} stroke={on ? c : C.faint} sw={1.7}>
    <path d="M12 3.2l2.6 5.5 6 .8-4.4 4.2 1.1 6L12 17l-5.3 2.7 1.1-6L3.4 9.5l6-.8z" /></Svg>
);
export const IconCheck = ({ s = 14, c = "#fff", sw = 2.4 }) => (
  <Svg s={s} stroke={c} sw={sw} vb="0 0 16 16"><path d="M3 8.5l3.2 3.2L13 4.5" /></Svg>
);
export const IconChevron = ({ s = 16, c = C.muted, dir = "down" }) => (
  <Svg s={s} stroke={c} sw={2} style={{ transform: dir === "up" ? "rotate(180deg)" : "none", transition: "transform .18s" }}>
    <path d="M6 9l6 6 6-6" /></Svg>
);
export const IconArrow = ({ s = 18, c = "#fff", dir = "right" }) => (
  <Svg s={s} stroke={c} sw={2} style={{ transform: dir === "left" ? "rotate(180deg)" : "none" }}><path d="M5 12h14" /><path d="M13 6l6 6-6 6" /></Svg>
);
export const IconClose = ({ s = 18, c = C.muted }) => (
  <Svg s={s} stroke={c} sw={2}><path d="M6 6l12 12M18 6L6 18" /></Svg>
);
export const IconPlus = ({ s = 15, c = C.primary }) => (
  <Svg s={s} stroke={c} sw={2}><path d="M12 5v14M5 12h14" /></Svg>
);
export const IconSparkle = ({ s = 18, c = C.primary }) => (
  <Svg s={s} stroke={c} sw={1.7}><path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z" /></Svg>
);
export const IconLayers = ({ s = 16, c = C.muted }) => (
  <Svg s={s} stroke={c} sw={1.7}><path d="M12 3l9 5-9 5-9-5 9-5z" /><path d="M3 13l9 5 9-5" /></Svg>
);
export const IconLock = ({ s = 16, c = C.muted }) => (
  <Svg s={s} stroke={c} sw={1.8}><rect x="4.5" y="10.5" width="15" height="9.5" rx="2.2" /><path d="M8 10.5V7.5a4 4 0 018 0v3" /></Svg>
);
