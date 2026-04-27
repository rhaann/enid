"use client";

import { motion } from "framer-motion";
import React from "react";
import Link from "next/link";

type CardProps = {
  title?: string;
  subtitle?: string;
  children: React.ReactNode;
  className?: string;
  href?: string;
  compact?: boolean;
};

export function Card({ title, subtitle, children, className, href, compact }: CardProps) {
  const content = (
    <motion.div
      whileHover={{ y: -4, boxShadow: "0 14px 35px rgba(0,0,0,0.10)" }}
      transition={{ type: "spring", stiffness: 300, damping: 24 }}
      className={[
        "rounded-2xl bg-white shadow-sm ring-1 ring-zinc-200 transition-shadow hover:ring-accent/30",
        compact ? "p-4" : "p-6",
        href ? "cursor-pointer" : "",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {(title || subtitle) && (
        <div className={compact ? "mb-2" : "mb-3"}>
          {title && (
            <h3 className={`font-semibold text-zinc-900 ${compact ? "text-base" : "text-lg"}`}>{title}</h3>
          )}
          {subtitle && (
            <p className="mt-1 text-sm text-zinc-600">{subtitle}</p>
          )}
        </div>
      )}
      <div className="flex-1 flex flex-col">{children}</div>
    </motion.div>
  );
  if (href) {
    return (
      <Link href={href} className="block group">
        {content}
      </Link>
    );
  }
  return content;
}


