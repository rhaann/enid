"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

export function AuditNav({ base }: { base: string }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const qs = searchParams.toString();
  const suffix = qs ? `?${qs}` : "";

  const items = [
    { href: base, label: "Overview" },
    { href: `${base}/brand`, label: "Brand" },
    { href: `${base}/website`, label: "Website" },
    { href: `${base}/social`, label: "Social" },
    { href: `${base}/competitors`, label: "Competitors" },
  ];
  return (
    <nav className="flex flex-wrap gap-2 text-sm" aria-label="Section navigation">
      {items.map((it) => {
        const active = pathname === it.href;
        return (
          <Link
            key={it.href}
            href={`${it.href}${suffix}`}
            className={[
              "rounded-full border px-3 py-1.5 transition",
              active
                ? "border-accent bg-accent/10 text-zinc-900"
                : "border-zinc-300 bg-white text-zinc-800 hover:border-accent",
            ].join(" ")}
          >
            {it.label}
          </Link>
        );
      })}
    </nav>
  );
}


