"use client";

import { motion, PanInfo } from "framer-motion";
import React, { useCallback, useMemo, useState } from "react";

export type StackedDeckItem = {
  id: string;
  title: string;
  content: React.ReactNode;
  rightMeta?: React.ReactNode;
  stars?: number; // 0-5 to render beside the title on the active card
};

type StackedDeckProps = {
  items: StackedDeckItem[];
  visibleCount?: number; // number of cards to display in the stack at once
  className?: string;
};

/**
 * Renders a stacked deck of cards. Clicking (or swiping) the top card sends it to the back.
 * The component is intentionally opinionated to keep styling consistent with the app.
 */
export function StackedDeck({
  items,
  visibleCount = 3,
  className,
}: StackedDeckProps) {
  const initialOrder = useMemo(() => items.map((i) => i.id), [items]);
  const [order, setOrder] = useState<string[]>(initialOrder);

  // Keep order in sync if items change length or ids
  React.useEffect(() => {
    const next = items.map((i) => i.id);
    if (next.join("|") !== order.join("|")) {
      setOrder(next);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items]);

  const idToItem = useMemo(() => {
    const map = new Map<string, StackedDeckItem>();
    items.forEach((it) => map.set(it.id, it));
    return map;
  }, [items]);

  const sendToBack = useCallback((id: string) => {
    setOrder((prev) => {
      const idx = prev.indexOf(id);
      if (idx < 0) return prev;
      const next = [...prev];
      next.splice(idx, 1);
      next.push(id);
      return next;
    });
  }, []);

  const onDragEnd = useCallback(
    (id: string, _e: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
      const threshold = 80; // pixels
      if (Math.abs(info.offset.x) > threshold || info.offset.y < -threshold) {
        sendToBack(id);
      }
    },
    [sendToBack]
  );

  const visibleIds = order.slice(0, Math.min(visibleCount, order.length));

  return (
    <div className={["relative w-full", className].filter(Boolean).join(" ")}>
      <div className="relative mx-auto w-full max-w-5xl">
        <div className="relative h-[520px] sm:h-[560px]">
          {visibleIds.map((id, position) => {
            const it = idToItem.get(id);
            if (!it) return null;
            const depth = position; // 0 = top
            // Show background layers ABOVE the active card (negative offsets)
            const translateY = -depth * 64;
            const scale = 1 - depth * 0.02;
            const z = visibleIds.length - depth;
            const isTop = depth === 0;
            const palette = {
              teal: "#17bfca",
              navy: "#25394b",
              grey: "#e1e1e1",
              gold: "#d5a349",
              white: "#ffffff",
            };
            const background =
              depth === 0 ? palette.teal : depth === 1 ? palette.navy : palette.grey;
            return (
              <motion.div
                key={id}
                layout
                className="absolute inset-x-0 mx-auto"
                style={{
                  zIndex: z,
                  transformOrigin: "top center",
                }}
                initial={{ y: translateY, scale }}
                animate={{ y: translateY, scale }}
                transition={{ type: "spring", stiffness: 300, damping: 30 }}
              >
                <motion.button
                  type="button"
                  role="button"
                  tabIndex={0}
                  whileHover={{ y: isTop ? -2 : 0 }}
                  whileTap={{ scale: 0.997 }}
                  drag={isTop ? "x" : false}
                  dragElastic={0.2}
                  dragConstraints={{ left: 0, right: 0, top: 0, bottom: 0 }}
                  onDragEnd={(e, info) => onDragEnd(id, e, info)}
                  onClick={() => sendToBack(id)}
                  aria-label={`${isTop ? "Send" : "Move"} ${it.title} to back`}
                  className={[
                    "block w-full overflow-hidden rounded-[36px] text-left",
                    isTop ? "shadow-2xl" : "shadow-md",
                  ].join(" ")}
                  style={{
                    backgroundColor: background,
                    border: "none",
                  }}
                >
                  {isTop ? (
                    <div className="relative p-7 sm:p-9">
                      <div className="flex items-start justify-between gap-6">
                        <div className="flex items-center gap-3">
                          <h3 className="text-3xl font-semibold" style={{ color: palette.white }}>
                            {it.title}
                          </h3>
                          {typeof it.stars === "number" ? (
                            <span className="text-base" style={{ color: palette.gold }}>
                              {"★".repeat(Math.max(0, Math.min(5, it.stars)))}{" "}
                            </span>
                          ) : null}
                        </div>
                        {it.rightMeta ? (
                          <div className="shrink-0 text-right text-sm" style={{ color: palette.white }}>
                            {it.rightMeta}
                          </div>
                        ) : null}
                      </div>
                      <div className="mt-5 text-base leading-7 sm:text-lg" style={{ color: palette.white }}>
                        {it.content}
                      </div>
                      <div className="absolute bottom-5 right-7 text-xl font-medium" style={{ color: palette.white }}>
                        {items.findIndex((x) => x.id === id) + 1}
                      </div>
                    </div>
                  ) : (
                    <div className="h-[120px] sm:h-[140px]" />
                  )}
                </motion.button>
              </motion.div>
            );
          })}
        </div>
      </div>
      {/* Mobile hint */}
      <div className="mt-2 text-center text-xs text-zinc-500 sm:hidden">
        Swipe or tap a card to cycle
      </div>
    </div>
  );
}


