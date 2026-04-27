"use client";

import { AnimatePresence, motion } from "framer-motion";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { StarRating } from "./StarRating";

export type PresentationItem = {
  id: string;
  title: string;
  subtitle?: React.ReactNode;
  content: React.ReactNode;
  rightMeta?: React.ReactNode;
  score?: number; // 0-100
  wide?: boolean;
};

type PresentationProps = {
  items: PresentationItem[];
  className?: string;
  initialIndex?: number;
};

export function Presentation({ items, className, initialIndex = 0 }: PresentationProps) {
  const [index, setIndex] = useState(initialIndex);
  const [direction, setDirection] = useState(0);

  const count = items.length;
  const current = useMemo(() => items[(index % count + count) % count], [items, index, count]);
  const currentSlideNumber = ((index % count + count) % count) + 1;
  
  // Get previous and next items for preview
  const prevIndex = ((index - 1) % count + count) % count;
  const nextIndex = ((index + 1) % count + count) % count;
  const prevItem = items[prevIndex];
  const nextItem = items[nextIndex];

  const paginate = useCallback(
    (delta: number) => {
      setDirection(delta);
      setIndex((i) => {
        const next = i + delta;
        // Loop back to first or last
        if (next < 0) return count - 1;
        if (next >= count) return 0;
        return next;
      });
    },
    [count]
  );

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") {
        paginate(-1);
      } else if (e.key === "ArrowRight") {
        paginate(1);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [paginate]);

  const variants = {
    enter: (dir: number) => ({
      x: dir > 0 ? 100 : -100,
      opacity: 0,
    }),
    center: { x: 0, opacity: 1 },
    exit: (dir: number) => ({
      x: dir < 0 ? 100 : -100,
      opacity: 0,
    }),
  };

  const palette = {
    navy: "#25394b",
    navyFaded: "#00BCC8", // Teal color for side cards
    gold: "#d5a349",
    white: "#ffffff",
  };

  return (
    <div className={["relative mx-auto w-full max-w-7xl", className].filter(Boolean).join(" ")}>
      <div className="relative flex items-center justify-center gap-4">
        {/* Previous Card Preview */}
        <motion.button
          type="button"
          onClick={() => paginate(-1)}
          initial={{ opacity: 0.7 }}
          animate={{ opacity: 0.8 }}
          whileHover={{ opacity: 0.9 }}
          className="hidden md:block w-52 lg:w-60 xl:w-64 flex-shrink-0 cursor-pointer group"
        >
          <div className="overflow-hidden rounded-xl shadow-lg transition-all group-hover:shadow-xl h-[35vh] flex items-center justify-center" style={{ backgroundColor: palette.navyFaded }}>
            <div className="p-4 lg:p-6 text-center">
              <h4 className="text-lg lg:text-xl xl:text-2xl font-semibold leading-tight" style={{ color: palette.white }}>
                {prevItem?.title}
              </h4>
              {prevItem?.score !== undefined && (
                <div className="mt-4">
                  <div className="text-2xl lg:text-3xl font-bold" style={{ color: palette.white }}>
                    {prevItem.score}
                  </div>
                  <div className="mt-1 flex justify-center">
                    <StarRating score={prevItem.score} filledColor="#ffffff" emptyColor="#5B5B5B" />
                  </div>
                </div>
              )}
            </div>
          </div>
        </motion.button>

        {/* Main Card */}
        <div className={`flex-1 relative ${current?.wide ? "max-w-7xl" : "max-w-6xl"}`}>
          <AnimatePresence custom={direction} mode="wait" initial={false}>
            <motion.div
              key={current?.id ?? index}
              custom={direction}
              variants={variants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
              className="w-full"
            >
              <div className={`overflow-hidden rounded-xl shadow-2xl flex flex-col ${current?.wide ? "h-[52vh]" : "h-[60vh]"}`} style={{ backgroundColor: palette.navy }}>
                <div className="relative p-7 sm:p-9 md:p-12 h-full flex flex-col">
                  {/* Header */}
                  <div className="flex items-start justify-between gap-6 mb-6 flex-shrink-0">
                    <div className="flex-1">
                      <h2 className="text-xl sm:text-2xl md:text-3xl font-semibold" style={{ color: palette.white }}>
                        {current?.title}
                      </h2>
                      {current?.subtitle && (
                        <div className="mt-1 text-sm" style={{ color: "rgba(255,255,255,0.5)" }}>
                          {current.subtitle}
                        </div>
                      )}
                      {current?.score !== undefined && (
                        <StarRating score={current.score} className="mt-2" />
                      )}
                    </div>
                    {current?.rightMeta && (
                      <div className="shrink-0 text-right text-xs sm:text-sm md:text-base" style={{ color: palette.white }}>
                        {current.rightMeta}
                      </div>
                    )}
                  </div>

                  {/* Scrollable Content */}
                  <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar min-h-0 flex flex-col">
                    <div className="text-sm sm:text-[15px] md:text-base leading-6 sm:leading-7 flex-1 flex flex-col" style={{ color: palette.white }}>
                      {current?.content}
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Next Card Preview */}
        <motion.button
          type="button"
          onClick={() => paginate(1)}
          initial={{ opacity: 0.7 }}
          animate={{ opacity: 0.8 }}
          whileHover={{ opacity: 0.9 }}
          className="hidden md:block w-52 lg:w-60 xl:w-64 flex-shrink-0 cursor-pointer group"
        >
          <div className="overflow-hidden rounded-xl shadow-lg transition-all group-hover:shadow-xl h-[35vh] flex items-center justify-center" style={{ backgroundColor: palette.navyFaded }}>
            <div className="p-4 lg:p-6 text-center">
              <h4 className="text-lg lg:text-xl xl:text-2xl font-semibold leading-tight" style={{ color: palette.white }}>
                {nextItem?.title}
              </h4>
              {nextItem?.score !== undefined && (
                <div className="mt-4">
                  <div className="text-2xl lg:text-3xl font-bold" style={{ color: palette.white }}>
                    {nextItem.score}
                  </div>
                  <div className="mt-1 flex justify-center">
                    <StarRating score={nextItem.score} filledColor="#ffffff" emptyColor="#5B5B5B" />
                  </div>
                </div>
              )}
            </div>
          </div>
        </motion.button>
      </div>

      {/* Progress Indicator */}
      <div className="mt-6 flex items-center justify-center">
        <div className="bg-white/90 backdrop-blur-sm rounded-full px-4 sm:px-6 py-2 shadow-lg">
          <span className="text-sm sm:text-base font-medium text-zinc-700">
            {currentSlideNumber} / {count}
          </span>
        </div>
      </div>

      {/* Mobile Navigation Arrows */}
      <div className="mt-4 flex items-center justify-center gap-4 md:hidden">
        <button
          type="button"
          aria-label="Previous"
          onClick={() => paginate(-1)}
          className="rounded-full bg-white/90 hover:bg-white shadow-lg p-3 text-zinc-800 hover:text-zinc-900 transition-colors"
        >
          <svg
            className="w-6 h-6"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 19l-7-7 7-7"
            />
          </svg>
        </button>
        <button
          type="button"
          aria-label="Next"
          onClick={() => paginate(1)}
          className="rounded-full bg-white/90 hover:bg-white shadow-lg p-3 text-zinc-800 hover:text-zinc-900 transition-colors"
        >
          <svg
            className="w-6 h-6"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 5l7 7-7 7"
            />
          </svg>
        </button>
      </div>

      <style jsx>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 8px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.3);
          border-radius: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(255, 255, 255, 0.5);
        }
      `}</style>
    </div>
  );
}
