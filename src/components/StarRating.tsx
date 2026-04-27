"use client";

import { getScoreBand } from "@/lib/scoring";

type StarRatingProps = {
  score: number;
  className?: string;
  filledColor?: string;
  emptyColor?: string;
};

export function StarRating({ score, className, filledColor, emptyColor }: StarRatingProps) {
  const band = getScoreBand(score);
  const filledStars = band.stars;
  const emptyStars = 5 - filledStars;
  const color = filledColor || band.color;
  const emptyStarColor = emptyColor || color;

  return (
    <div className={`flex items-center gap-0.5 ${className || ""}`} aria-label={`${filledStars} out of 5 stars`}>
      {Array.from({ length: filledStars }).map((_, i) => (
        <span key={`filled-${i}`} className="text-xl" style={{ color }}>★</span>
      ))}
      {Array.from({ length: emptyStars }).map((_, i) => (
        <span key={`empty-${i}`} className="text-xl" style={{ color: emptyStarColor, opacity: emptyColor ? 1 : 0.3 }}>★</span>
      ))}
    </div>
  );
}
