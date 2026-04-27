"use client";
import Image from "next/image";
import Link from "next/link";

type LogoProps = {
  className?: string;
  withLink?: boolean;
  height?: number;
};

export function Logo({ className, withLink = true, height = 36 }: LogoProps) {
  const content = (
    <span className={["inline-flex items-center gap-2 select-none", className].filter(Boolean).join(" ")}>
      <Image
        src="/Audre_Logo.gif"
        alt="Audre"
        height={height}
        width={height }
        priority
      />
      <span className="text-accent font-semibold text-2xl sm:text-3xl md:text-4xl leading-none">
        Audre
      </span>
    </span>
  );
  if (!withLink) return content;
  return (
    <Link href="/" aria-label="Audre home">
      {content}
    </Link>
  );
}


