/**
 * Color, type, and scoring tokens for the v2 snapshot PDF template.
 * Hex values resolved from the Enid brand system doc (react-pdf can't
 * resolve CSS variables or Tailwind classes, so everything here is a
 * literal, final value). Kept separate from src/lib/scoring.ts, which the
 * v1 template and the full audit PDF still depend on.
 */

export const IN = 72; // 1in = 72pt, react-pdf's native unit
export const in2pt = (inches: number) => inches * IN;

export const colors = {
  signalWhite: "#F8F8F8",
  midnightLens: "#253D4D",
  enidTeal: "#00A4A6",
  insightPurple: "#9D3D85",
  clarityGold: "#D49C35",
  pureWhite: "#FFFFFF",
  softGrey: "#EEEEEE",
  quietSlate: "#526373",
  hairline: "#C5CDD4",
  alert: "#EF4444",
  /**
   * Solid pre-blend of white-at-15%-opacity over Midnight Lens, for border
   * colors on dark sheets. react-pdf's border rendering doesn't reliably
   * respect rgba() alpha the way its fills/text do — using a translucent
   * color there rendered as a solid, wrong-hued line in testing.
   */
  hairlineOnDark: "#465A68",
};

export type BandKey = "at-risk" | "needs-work" | "competitive" | "strong" | "leading";

export interface Band {
  key: BandKey;
  label: string;
  /** Ring/stroke color for the ScoreDial. */
  dialColor: string;
  /** Solid chip background + text. */
  chipBg: string;
  chipText: string;
  /** Soft/tinted chip background + text. */
  softBg: string;
  softText: string;
}

const BANDS: Band[] = [
  {
    key: "at-risk",
    label: "At Risk",
    dialColor: colors.alert,
    chipBg: colors.alert,
    chipText: colors.pureWhite,
    softBg: "rgba(239, 68, 68, 0.1)",
    softText: colors.alert,
  },
  {
    key: "needs-work",
    label: "Needs Work",
    dialColor: colors.clarityGold,
    chipBg: colors.clarityGold,
    chipText: colors.pureWhite,
    softBg: "rgba(212, 156, 53, 0.15)",
    softText: colors.clarityGold,
  },
  {
    key: "competitive",
    label: "Competitive",
    dialColor: colors.quietSlate,
    chipBg: "rgba(37, 61, 77, 0.7)",
    chipText: colors.signalWhite,
    softBg: "rgba(37, 61, 77, 0.1)",
    softText: "rgba(37, 61, 77, 0.7)",
  },
  {
    key: "strong",
    label: "Strong",
    dialColor: colors.enidTeal,
    chipBg: colors.enidTeal,
    chipText: colors.pureWhite,
    softBg: "rgba(0, 164, 166, 0.12)",
    softText: colors.enidTeal,
  },
  {
    key: "leading",
    label: "Leading",
    dialColor: colors.midnightLens,
    chipBg: colors.midnightLens,
    chipText: colors.pureWhite,
    softBg: "rgba(37, 61, 77, 0.1)",
    softText: colors.midnightLens,
  },
];

export const BAND_RANGES: { band: Band; range: string }[] = [
  { band: BANDS[0], range: "0–19" },
  { band: BANDS[1], range: "20–39" },
  { band: BANDS[2], range: "40–59" },
  { band: BANDS[3], range: "60–79" },
  { band: BANDS[4], range: "80–100" },
];

export const bandForScore = (score: number): Band => {
  const s = Math.max(0, Math.min(100, score));
  if (s < 20) return BANDS[0];
  if (s < 40) return BANDS[1];
  if (s < 60) return BANDS[2];
  if (s < 80) return BANDS[3];
  return BANDS[4];
};

/** Half-star count, 0..5. */
export const starsForScore = (score: number): number => {
  const s = Math.max(0, Math.min(100, score));
  return Math.round((s / 20) * 2) / 2;
};

export const SCORE_CONTEXT: Record<BandKey, string> = {
  "at-risk":
    "Your brand presence has critical gaps that are likely limiting growth and market confidence.",
  "needs-work":
    "Your brand shows foundational elements but requires focused attention across several key areas.",
  competitive:
    "Your brand is performing at a market-competitive level with clear opportunities to stand out.",
  strong:
    "Your brand demonstrates strong fundamentals and is well-positioned to reach best-in-class status.",
  leading:
    "Your brand is operating at an elite level — a powerful foundation for sustained growth.",
};
