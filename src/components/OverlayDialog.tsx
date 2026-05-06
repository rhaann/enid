"use client";

import { motion, AnimatePresence } from "framer-motion";
import React from "react";

type OverlayDialogProps = {
  open: boolean;
  title?: string;
  children: React.ReactNode;
  onClose?: () => void;
  tone?: "default" | "danger";
  actions?: React.ReactNode;
  size?: "md" | "lg" | "xl";
};

export function OverlayDialog({
  open,
  title,
  children,
  onClose,
  tone = "default",
  actions,
  size = "md",
}: OverlayDialogProps) {
  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          aria-hidden={!open}
          role="dialog"
          aria-modal="true"
        >
          <div
            className="absolute inset-0 bg-black/30"
            onClick={onClose}
            aria-hidden="true"
          />
          <motion.div
            className={[
              "relative w-full rounded-2xl border bg-white shadow-xl overflow-y-auto",
              size === "xl"
                ? "max-w-5xl max-h-[90vh] p-8"
                : size === "lg"
                ? "max-w-2xl max-h-[90vh] p-8"
                : "max-w-md max-h-[90vh] p-6",
              tone === "danger" ? "border-red-200" : "border-zinc-200",
            ].join(" ")}
            initial={{ opacity: 0, scale: 0.98, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.98, y: 8 }}
            transition={{ duration: 0.2 }}
          >
            {title ? (
              <h3
                className={[
                  "mb-2 font-semibold",
                  size === "xl" ? "text-2xl" : size === "lg" ? "text-2xl" : "text-lg",
                  tone === "danger" ? "text-red-700" : "text-zinc-900",
                ].join(" ")}
              >
                {title}
              </h3>
            ) : null}
            <div className="text-zinc-700">{children}</div>
            {actions ? <div className="mt-4 flex justify-end gap-2">{actions}</div> : null}
            {onClose ? (
              <button
                aria-label="Close dialog"
                onClick={onClose}
                className="absolute right-3 top-3 inline-flex h-8 w-8 items-center justify-center rounded-md text-zinc-500 hover:bg-zinc-100 focus:outline-none focus:ring-2 focus:ring-accent"
              >
                ×
              </button>
            ) : null}
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}


