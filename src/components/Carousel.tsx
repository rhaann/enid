"use client";

import { AnimatePresence, motion, PanInfo } from "framer-motion";
import React, { useCallback, useMemo, useState } from "react";

export type CarouselItem = {
  id: string;
  title: string;
  content: React.ReactNode;
  rightMeta?: React.ReactNode;
  stars?: number; // 0-5
};

type CarouselProps = {
  items: CarouselItem[];
  className?: string;
  initialIndex?: number;
};

export function Carousel({ items, className, initialIndex = 0 }: CarouselProps) {
  const [index, setIndex] = useState(initialIndex);
  const [direction, setDirection] = useState(0);

  const count = items.length;
  const current = useMemo(() => items[(index % count + count) % count], [items, index, count]);

  const paginate = useCallback(
    (delta: number) => {
      setDirection(delta);
      setIndex((i) => i + delta);
    },
    []
  );

  const onDragEnd = useCallback(
    (_: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
      const threshold = 100;
      if (info.offset.x > threshold) paginate(-1);
      else if (info.offset.x < -threshold) paginate(1);
    },
    [paginate]
  );

  const variants = {
    enter: (dir: number) => ({
      x: dir > 0 ? 320 : -320,
      opacity: 0,
      scale: 0.98,
    }),
    center: { x: 0, opacity: 1, scale: 1 },
    exit: (dir: number) => ({
      x: dir < 0 ? 320 : -320,
      opacity: 0,
      scale: 0.98,
    }),
  };

  const palette = {
    teal: "#17bfca",
    gold: "#d5a349",
    white: "#ffffff",
  };

  return (
    <div className={["relative mx-auto w-full max-w-5xl", className].filter(Boolean).join(" ")}>
      <div className="relative">
        <AnimatePresence custom={direction} mode="popLayout" initial={false}>
          <motion.div
            key={current?.id ?? index}
            custom={direction}
            variants={variants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ type: "spring", stiffness: 300, damping: 35 }}
            drag="x"
            dragElastic={0.2}
            onDragEnd={onDragEnd}
            className="overflow-hidden rounded-[40px] shadow-2xl"
            style={{ backgroundColor: palette.teal }}
          >
            <div className="relative p-7 sm:p-9">
              <div className="flex items-start justify-between gap-6">
                <div className="flex items-center gap-3">
                  <h3 className="text-2xl sm:text-3xl font-semibold" style={{ color: palette.white }}>
                    {current?.title}
                  </h3>
                  {typeof current?.stars === "number" ? (
                    <span className="text-base" style={{ color: palette.gold }}>
                      {"★".repeat(Math.max(0, Math.min(5, current?.stars ?? 0)))}{" "}
                    </span>
                  ) : null}
                </div>
                {current?.rightMeta ? (
                  <div className="shrink-0 text-right text-xs sm:text-sm" style={{ color: palette.white }}>
                    {current.rightMeta}
                  </div>
                ) : null}
              </div>
              <div className="mt-4 text-[15px] leading-7 sm:text-base" style={{ color: palette.white }}>
                {current?.content}
              </div>
              <div className="absolute bottom-5 right-7 text-lg sm:text-xl font-medium" style={{ color: palette.white }}>
                {(index % count + count) % count + 1}
              </div>
            </div>
          </motion.div>
        </AnimatePresence>

        {/* Arrows */}
        <button
          type="button"
          aria-label="Previous"
          onClick={() => paginate(-1)}
          className="absolute left-2 top-1/2 z-10 -translate-y-1/2 rounded-full bg-white/80 p-2 text-zinc-800 shadow hover:bg-white"
        >
          ‹
        </button>
        <button
          type="button"
          aria-label="Next"
          onClick={() => paginate(1)}
          className="absolute right-2 top-1/2 z-10 -translate-y-1/2 rounded-full bg-white/80 p-2 text-zinc-800 shadow hover:bg-white"
        >
          ›
        </button>
      </div>

      {/* Dots */}
      <div className="mt-4 flex items-center justify-center gap-2">
        {items.map((_, i) => {
          const active = (index % count + count) % count === i;
          return (
            <button
              type="button"
              key={i}
              aria-label={`Go to slide ${i + 1}`}
              onClick={() => {
                setDirection(i > ((index % count) + count) % count ? 1 : -1);
                setIndex(i);
              }}
              className={[
                "h-2.5 w-2.5 rounded-full transition",
                active ? "bg-zinc-800" : "bg-zinc-300 hover:bg-zinc-400",
              ].join(" ")}
            />
          );
        })}
      </div>
    </div>
  );
}


