"use client";

import Link from "next/link";
import React from "react";

type Variant = "primary" | "secondary" | "tertiary" | "yellow";

function classesFor(variant: Variant) {
  const base =
    "inline-flex items-center justify-center rounded-lg px-6 py-3 text-sm font-semibold transition focus:outline-none focus:ring-4";
  switch (variant) {
    case "primary":
      return `${base} bg-accent text-accent-foreground shadow-sm hover:opacity-90 focus:ring-accent/30`;
    case "secondary":
      return `${base} border-2 border-accent text-accent bg-transparent hover:bg-accent/10 focus:ring-accent/20`;
    case "tertiary":
      return `${base} bg-navy text-white hover:opacity-90 focus:ring-navy/20`;
    case "yellow":
      return `${base} bg-[#d4a249] text-white shadow-sm hover:bg-[#c4923a] focus:ring-[#d4a249]/30`;
  }
}

export function Button({
  variant = "primary",
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return <button className={[classesFor(variant), className].filter(Boolean).join(" ")} {...props} />;
}

export function ButtonLink({
  variant = "primary",
  className,
  href,
  children,
  ...props
}: React.ComponentProps<typeof Link> & { variant?: Variant }) {
  const cls = [classesFor(variant), className].filter(Boolean).join(" ");
  return (
    <Link href={href} className={cls} {...props}>
      {children}
    </Link>
  );
}


