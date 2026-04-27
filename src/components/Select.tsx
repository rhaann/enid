"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";

type Option = { value: string; label: string };

type SelectProps = {
  options: Option[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
};

export function Select({
  options,
  value,
  onChange,
  placeholder = "Select...",
  className,
}: SelectProps) {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState<number>(-1);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const listRef = useRef<HTMLUListElement | null>(null);

  const selected = useMemo(
    () => options.find((o) => o.value === value),
    [options, value]
  );

  useEffect(() => {
    function onDocMouseDown(e: MouseEvent) {
      if (!containerRef.current) return;
      if (!e.composedPath().includes(containerRef.current)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onDocMouseDown);
    return () => document.removeEventListener("mousedown", onDocMouseDown);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (!open) return;
      if (e.key === "Escape") {
        e.preventDefault();
        setOpen(false);
        buttonRef.current?.focus();
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        setActiveIndex((idx) => {
          const next = idx < options.length - 1 ? idx + 1 : 0;
          return next;
        });
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setActiveIndex((idx) => {
          const next = idx > 0 ? idx - 1 : options.length - 1;
          return next;
        });
      } else if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        const targetIdx = activeIndex >= 0 ? activeIndex : 0;
        const opt = options[targetIdx];
        if (opt) {
          onChange(opt.value);
          setOpen(false);
          buttonRef.current?.focus();
        }
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [activeIndex, open, options, onChange]);

  useEffect(() => {
    if (!open) return;
    // Set active index to current selected when opening
    const idx = Math.max(
      0,
      options.findIndex((o) => o.value === value)
    );
    setActiveIndex(idx);
    // Scroll into view
    const el = listRef.current?.querySelector<HTMLLIElement>(
      `[data-index="${idx}"]`
    );
    el?.scrollIntoView({ block: "nearest" });
  }, [open, options, value]);

  return (
    <div ref={containerRef} className={["relative", className].filter(Boolean).join(" ")}>
      <button
        ref={buttonRef}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        className="flex w-full items-center justify-between rounded-2xl border border-zinc-300 bg-white px-4 py-2.5 text-left text-base text-zinc-900 outline-none transition focus:border-purple focus:ring-4 focus:ring-purple/20"
        onClick={() => setOpen((o) => !o)}
      >
        <span className={selected ? "" : "text-zinc-400"}>
          {selected?.label ?? placeholder}
        </span>
        <svg
          className="ml-3 h-4 w-4 text-zinc-500"
          viewBox="0 0 20 20"
          fill="currentColor"
          aria-hidden="true"
        >
          <path
            fillRule="evenodd"
            d="M5.23 7.21a.75.75 0 011.06.02L10 11.188l3.71-3.957a.75.75 0 011.08 1.04l-4.25 4.53a.75.75 0 01-1.08 0l-4.25-4.53a.75.75 0 01.02-1.06z"
            clipRule="evenodd"
          />
        </svg>
      </button>

      {open && (
        <ul
          ref={listRef}
          role="listbox"
          tabIndex={-1}
          className="absolute z-50 mt-2 max-h-72 w-full overflow-auto rounded-2xl border border-zinc-200 bg-white p-1.5 shadow-xl"
        >
          {options.map((opt, idx) => {
            const isSelected = opt.value === value;
            const isActive = idx === activeIndex;
            return (
              <li
                data-index={idx}
                key={opt.value}
                role="option"
                aria-selected={isSelected}
                className={[
                  "flex cursor-pointer select-none items-center rounded-xl px-3.5 py-2.5 text-sm sm:text-base",
                  isSelected
                    ? "bg-purple text-white"
                    : isActive
                    ? "bg-zinc-50 text-zinc-900"
                    : "text-zinc-900",
                ].join(" ")}
                onMouseEnter={() => setActiveIndex(idx)}
                onClick={() => {
                  onChange(opt.value);
                  setOpen(false);
                  buttonRef.current?.focus();
                }}
              >
                {opt.label}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}


