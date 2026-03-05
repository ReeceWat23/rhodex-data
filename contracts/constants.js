/** Shared theme and config for Rhodex */

export const C = {
  bg: "#0a0c0d",
  panel: "#111416",
  border: "#1e2325",
  border2: "#252a2c",
  teal: "#258ea6",
  sage: "#549f93",
  green: "#9faf90",
  rose: "#e2b1b1",
  lavender: "#e2c2ff",
  text: "#c8d0d4",
  muted: "#5a6468",
  dim: "#2e3538",
  white: "#edf1f3",
};

export const SOURCES = {
  smart: { label: "Smart Adj", color: C.teal, note: "OWID + period-aware corrections" },
  owid: { label: "OWID Raw", color: C.sage, note: "Our World in Data 1980–2024" },
  calibrated: { label: "Industry Cal", color: C.lavender, note: "Gallagher RE & Swiss Re multipliers" },
  emdat: { label: "Raw EM-DAT", color: C.rose, note: "EM-DAT CPI-adjusted, 9,781 events" },
};

export const DISASTER_TYPES = [
  "All", "Flood", "Extreme weather", "Earthquake", "Drought",
  "Wildfire", "Extreme temperature", "Wet mass movement", "Volcanic activity",
];

export const REGIONS = ["All", "Africa", "Americas", "Asia", "Europe", "Oceania"];

/** Expanded strikes for quarterly comparison and finer contract types */
export const DEFAULT_STRIKES = [
  100, 120, 200, 220, 250, 280, 300, 320, 350, 400, 450, 500, 600, 800, 1000, 1500, 2000,
];

export const FEAR_MULT = 1.7;

export const TYPE_C = {
  Flood: C.teal,
  "Extreme weather": C.sage,
  Earthquake: C.rose,
  Drought: C.lavender,
  Wildfire: "#c4956a",
  "Extreme temperature": C.green,
  "Wet mass movement": "#7ba5b0",
  "Volcanic activity": "#b09090",
};

/** Q-Kalshi: per-quarter historical params and default strikes */
export const Q_NAMES = { 1: "Q1 Jan–Mar", 2: "Q2 Apr–Jun", 3: "Q3 Jul–Sep", 4: "Q4 Oct–Dec" };
export const Q_COLORS = { 1: C.teal, 2: C.sage, 3: C.rose, 4: C.lavender };
export const FEAR_Q = 1.7;

export const DEFAULT_Q_STRIKES = {
  1: [10, 20, 30, 50, 75, 100],
  2: [15, 25, 40, 60, 80, 120],
  3: [30, 50, 75, 100, 150, 200, 300],
  4: [10, 15, 25, 40, 60, 80],
};

export const DEFAULT_YTD_STRIKES = {
  1: [15, 30, 50, 80, 120],
  2: [40, 70, 100, 150, 200],
  3: [80, 130, 180, 250, 350],
  4: [100, 180, 260, 350, 500],
};

/** Tab config: [id, label] */
export const TAB_CONFIG = [
  ["market", "Market"],
  ["quarterly", "Quarterly"],
  ["contracts", "Contracts"],
  ["kalshi", "Kalshi"],
  ["qkalshi", "Q-Kalshi"],
  ["hurricane", "Hurricane"],
  ["compare", "Sources"],
  ["live", "Live Earth"],
];
