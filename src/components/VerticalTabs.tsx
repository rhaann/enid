"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

type TabItem = {
  title: string;
  content: React.ReactNode;
  rightMeta?: React.ReactNode;
};

type VerticalTabsProps = {
  items: TabItem[];
  className?: string;
};

export function VerticalTabs({ items, className }: VerticalTabsProps) {
  const [activeIndex, setActiveIndex] = useState(0);

  // Empty state when no items
  if (items.length === 0) {
    return (
      <div className={`flex ${className || ""}`}>
        <div className="flex-1 bg-white/10 rounded-lg p-4 flex items-center justify-center min-h-[100px]">
          <p className="text-white/40 text-sm">No plan data available</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`flex items-stretch ${className || ""}`}>
      {/* Active Tab Content (Left) */}
      <div className="flex-1 bg-white/10 rounded-l-lg p-3">
        <div className="flex items-start justify-between gap-3 mb-1">
          <h3 className="text-sm font-semibold text-white">
            {items[activeIndex]?.title}
          </h3>
          {items[activeIndex]?.rightMeta && (
            <div className="shrink-0">{items[activeIndex].rightMeta}</div>
          )}
        </div>
        <div className="text-[13px] text-white/80 leading-[1.4]">
          {items[activeIndex]?.content}
        </div>
      </div>

      {/* Inactive Tab Strips (Right) */}
      <div className="flex gap-px ml-px">
        {items.map((item, index) => {
          if (index === activeIndex) return null;
          
          return (
            <button
              key={index}
              type="button"
              onClick={() => setActiveIndex(index)}
              className="w-6 bg-white/5 hover:bg-white/10 rounded-r-sm flex flex-col items-center justify-between py-2 transition-all"
            >
              {/* Vertical Text */}
              <div 
                className="flex-1 flex items-center justify-center overflow-hidden"
                style={{ writingMode: "vertical-rl", textOrientation: "mixed" }}
              >
                <span className="text-white/50 text-[8px] font-medium whitespace-nowrap transform rotate-180">
                  {item.title.length > 15 ? item.title.slice(0, 15) + "…" : item.title}
                </span>
              </div>
              
              {/* Tab Number */}
              <div className="text-white/40 font-medium text-[10px]">
                {index + 1}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
