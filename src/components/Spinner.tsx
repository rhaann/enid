"use client";

import { motion } from "framer-motion";
import Image from "next/image";
import React from "react";

type SpinnerProps = {
  size?: number;
  className?: string;
  variant?: "ring" | "logo" | "beat";
};

export function Spinner({ size = 24, className, variant = "ring" }: SpinnerProps) {
  if (variant === "beat") {
    const px = Math.round(size * 1.6);
    return (
      <motion.div
        className={["inline-flex items-center justify-center", className].join(" ")}
        animate={{ scale: [1, 1.08, 1] }}
        transition={{ duration: 1.1, repeat: Infinity, ease: "easeInOut" }}
        aria-label="Loading"
      >
        <Image src="/Audre_Logo.png" alt="Loading" width={px} height={px} priority />
      </motion.div>
    );
  }
  if (variant === "logo") {
    const s = size * 1.5; // slightly larger for the logo
    return (
      <span className={["inline-flex items-center", className].join(" ")}>
        <Image
          src="/Audre_Logo.gif"
          alt="Loading"
          width={s}
          height={s}
          unoptimized
          priority
        />
      </span>
    );
  }
  const s = `${size}px`;
  return (
    <span
      className={[
        "inline-block animate-spin rounded-full border-2 border-zinc-300 border-t-accent",
        className,
      ].join(" ")}
      style={{ width: s, height: s }}
      aria-label="Loading"
    />
  );
}



