"use client";
import { Card } from "@/components/Card";
import { useState } from "react";

export function GroupedSection({
  title,
  bullets,
  details,
}: {
  title: string;
  bullets: string[];
  details: [string, string][];
}) {
  const [open, setOpen] = useState(false);
  return (
    <Card title={title}>
      <ul className="list-disc pl-5 text-zinc-700">
        {bullets.map((b, i) => (
          <li key={i}>{b}</li>
        ))}
      </ul>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="mt-3 text-sm font-medium text-accent hover:opacity-90"
      >
        {open ? "Hide details" : "Show details"}
      </button>
      {open && (
        <div className="mt-3 space-y-3 text-zinc-700">
          {details.map(([label, text], i) => (
            <div key={i}>
              <p className="text-sm font-medium text-zinc-800">{label}</p>
              <p className="text-sm">{text}</p>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}


