/**
 * Single source of truth for audit score thresholds, labels, colors, and legends.
 *
 * Anywhere in the app (dashboard, audit pages, PDF, overlays) that needs to map
 * a 0-100 score to a star count, color, label, or legend group should consume
 * helpers from this module instead of re-implementing the rubric inline.
 */

/** Brand palette for score visualizations. */
export const SCORE_COLORS = {
  red: "#c96858",
  orange: "#d4a248",
  yellow: "#FFD700",
  green: "#57a587",
} as const;

export type ScoreColor = (typeof SCORE_COLORS)[keyof typeof SCORE_COLORS];

export type ScoreBand = {
  /** Inclusive lower bound (0-100). */
  minScore: number;
  /** Exclusive upper bound; the top band uses 101 so 100 is included. */
  maxScore: number;
  /** Stars shown for scores in this band (1-5). */
  stars: number;
  /** Single-band label displayed alongside the score. */
  label: string;
  /** Hex color used for stars, indicators, and bar segments in this band. */
  color: ScoreColor;
  /** Which legend grouping this band belongs to. */
  legendGroup: LegendGroupId;
};

export type LegendGroupId = "needsAttention" | "goodProgress" | "excellence";

/**
 * The five score bands. Order matters: helpers iterate in ascending order.
 * Edit thresholds here and every consumer (web + PDF) updates automatically.
 */
export const SCORE_BANDS: readonly ScoreBand[] = [
  {
    minScore: 0,
    maxScore: 60,
    stars: 1,
    label: "At Risk",
    color: SCORE_COLORS.red,
    legendGroup: "needsAttention",
  },
  {
    minScore: 60,
    maxScore: 70,
    stars: 2,
    label: "Needs Work",
    color: SCORE_COLORS.red,
    legendGroup: "needsAttention",
  },
  {
    minScore: 70,
    maxScore: 80,
    stars: 3,
    label: "Competitive",
    color: SCORE_COLORS.yellow,
    legendGroup: "goodProgress",
  },
  {
    minScore: 80,
    maxScore: 90,
    stars: 4,
    label: "Strong",
    color: SCORE_COLORS.yellow,
    legendGroup: "goodProgress",
  },
  {
    minScore: 90,
    maxScore: 101,
    stars: 5,
    label: "Best-in-Class",
    color: SCORE_COLORS.green,
    legendGroup: "excellence",
  },
] as const;

/** Look up the band a 0-100 score falls into. Out-of-range scores are clamped. */
export function getScoreBand(score: number | null | undefined): ScoreBand {
  const clamped = Math.max(0, Math.min(100, score ?? 0));
  for (const band of SCORE_BANDS) {
    if (clamped < band.maxScore) return band;
  }
  return SCORE_BANDS[SCORE_BANDS.length - 1];
}

export function getScoreLabel(score: number | null | undefined): string {
  return getScoreBand(score).label;
}

export function getScoreColor(score: number | null | undefined): ScoreColor {
  return getScoreBand(score).color;
}

export function getStarCount(score: number | null | undefined): number {
  return getScoreBand(score).stars;
}

export type LegendCard = {
  id: LegendGroupId;
  title: string;
  /** Human-readable star range, e.g. "1-2 stars". */
  starsRange: string;
  /** Human-readable score range, e.g. "0-69". */
  scoreRange: string;
  /** Stars shown filled in this card's preview. */
  filledStars: number;
  color: ScoreColor;
  description: string;
};

/**
 * Cards shown in "How to Read Your Scores" (cover page in PDF, overlay in dashboard).
 * Generated from SCORE_BANDS so it can never drift.
 */
export const SCORE_LEGEND: readonly LegendCard[] = (() => {
  const groups: Record<LegendGroupId, ScoreBand[]> = {
    needsAttention: [],
    goodProgress: [],
    excellence: [],
  };
  for (const band of SCORE_BANDS) groups[band.legendGroup].push(band);

  const meta: Record<LegendGroupId, { title: string; starsRange: string; description: string }> = {
    needsAttention: {
      title: "Needs Attention",
      starsRange: "0-2 stars",
      description:
        "Critical gaps requiring immediate action. These areas may be impacting business performance.",
    },
    goodProgress: {
      title: "Good Progress",
      starsRange: "3-4 stars",
      description:
        "Solid foundation with room for optimization. Strategic improvements can unlock significant value.",
    },
    excellence: {
      title: "Excellence",
      starsRange: "5 stars",
      description:
        "Best-in-class performance. Maintain momentum and explore innovation opportunities.",
    },
  };

  return (Object.keys(groups) as LegendGroupId[]).map((id) => {
    const bands = groups[id];
    const maxStars = Math.max(...bands.map((b) => b.stars));
    const minScore = Math.min(...bands.map((b) => b.minScore));
    const maxScore = Math.max(...bands.map((b) => Math.min(100, b.maxScore)));
    return {
      id,
      title: meta[id].title,
      starsRange: meta[id].starsRange,
      scoreRange: `${minScore}-${maxScore}`,
      filledStars: maxStars,
      color: bands[0].color,
      description: meta[id].description,
    };
  });
})();

export type HealthBarSegment = {
  label: string;
  scoreRange: string;
  /** Width as a fraction of the total bar (sums to 1 across all segments). */
  weight: number;
  color: ScoreColor;
};

/**
 * Five proportionally-accurate segments for the "Brand Health Scale" bar.
 * Width matches the actual score range covered (0-60 is 60% wide, etc.) so
 * the bar visually represents the rubric correctly.
 */
export const HEALTH_BAR_SEGMENTS: readonly HealthBarSegment[] = SCORE_BANDS.map(
  (band) => ({
    label: band.label,
    scoreRange: `${band.minScore}-${Math.min(100, band.maxScore)}`,
    weight: (Math.min(100, band.maxScore) - band.minScore) / 100,
    color: band.color,
  })
);
