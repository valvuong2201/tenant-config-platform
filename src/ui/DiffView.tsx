"use client";

import type { Change } from "@/core/diff";
import { dimensions } from "@/core/registry";
import { Badge } from "./components";

const labelOf = (id: string) => dimensions.find((d) => d.id === id)?.label ?? id;

export function formatValue(value: unknown): string {
  if (value === undefined) return "—";
  if (value === null) return "none";
  if (value === "") return "(empty)";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

const tone = { added: "green", removed: "red", changed: "amber" } as const;

/** Side-by-side listing of differences, grouped by config dimension. */
export function DiffView({ changes, leftLabel, rightLabel }: { changes: Change[]; leftLabel: string; rightLabel: string }) {
  if (changes.length === 0) {
    return <p className="rounded-md bg-green-50 px-4 py-3 text-sm text-green-800">No differences: these configurations are identical.</p>;
  }
  const groups = new Map<string, Change[]>();
  for (const change of changes) groups.set(change.dimension, [...(groups.get(change.dimension) ?? []), change]);

  return (
    <div className="space-y-5" data-testid="diff-view">
      {[...groups].map(([dimension, items]) => (
        <div key={dimension}>
          <h3 className="mb-2 text-sm font-semibold">
            {labelOf(dimension)} <span className="font-normal text-zinc-500">· {items.length} difference{items.length === 1 ? "" : "s"}</span>
          </h3>
          <div className="overflow-x-auto rounded-lg border border-zinc-200">
            <table className="w-full text-sm">
              <thead className="bg-zinc-50 text-left text-xs text-zinc-500">
                <tr>
                  <th className="w-24 px-3 py-2 font-medium">Change</th>
                  <th className="px-3 py-2 font-medium">Setting</th>
                  <th className="w-1/4 px-3 py-2 font-medium">{leftLabel}</th>
                  <th className="w-1/4 px-3 py-2 font-medium">{rightLabel}</th>
                </tr>
              </thead>
              <tbody>
                {items.map((c) => (
                  <tr key={`${c.kind}:${c.path}`} className="border-t border-zinc-100 align-top">
                    <td className="px-3 py-2"><Badge tone={tone[c.kind]}>{c.kind}</Badge></td>
                    <td className="px-3 py-2 font-mono text-xs">{c.path}</td>
                    <td className={`px-3 py-2 text-xs ${c.kind !== "added" ? "bg-red-50/60" : "text-zinc-400"}`}>{formatValue(c.before)}</td>
                    <td className={`px-3 py-2 text-xs ${c.kind !== "removed" ? "bg-green-50/60" : "text-zinc-400"}`}>{formatValue(c.after)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  );
}
