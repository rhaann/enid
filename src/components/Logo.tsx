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
        src="/Enid_Wordmark_Full_Color.png"
        alt="Enid"
        height={height}
        width={height * 4}
        priority
      />
    </span>
  );
  if (!withLink) return content;
  return (
    <Link href="/" aria-label="Enid home">
      {content}
    </Link>
  );
}


