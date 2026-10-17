"use client";

import { useState, type ReactNode } from "react";
import type { Issue } from "@/core/types";

export const cx = (...parts: (string | false | null | undefined)[]) => parts.filter(Boolean).join(" ");

export function Card({ title, subtitle, actions, children, className }: {
  title?: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cx("rounded-xl border border-zinc-200 bg-white shadow-sm", className)}>
      {(title || actions) && (
        <div className="flex items-start justify-between gap-4 border-b border-zinc-100 px-5 py-3.5">
          <div>
            <h2 className="text-sm font-semibold">{title}</h2>
            {subtitle && <p className="mt-0.5 text-xs text-zinc-500">{subtitle}</p>}
          </div>
          {actions}
        </div>
      )}
      <div className="p-5">{children}</div>
    </section>
  );
}

const buttonStyles = {
  primary: "bg-zinc-900 text-white hover:bg-zinc-700 disabled:bg-zinc-300",
  secondary: "border border-zinc-300 bg-white text-zinc-800 hover:bg-zinc-50 disabled:text-zinc-400",
  danger: "border border-red-200 bg-white text-red-700 hover:bg-red-50 disabled:text-red-300",
  ghost: "text-zinc-600 hover:bg-zinc-100",
};

export function Button({ variant = "secondary", small, className, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: keyof typeof buttonStyles;
  small?: boolean;
}) {
  return (
    <button
      type="button"
      {...props}
      className={cx(
        "rounded-md font-medium transition-colors disabled:cursor-not-allowed",
        small ? "px-2.5 py-1 text-xs" : "px-3.5 py-2 text-sm",
        buttonStyles[variant],
        className,
      )}
    />
  );
}

export function Field({ label, hint, error, children, className }: {
  label: string;
  hint?: string;
  error?: string | null;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={cx("block text-sm", className)}>
      <span className="mb-1 block text-xs font-medium text-zinc-700">{label}</span>
      {children}
      {hint && !error && <span className="mt-1 block text-xs text-zinc-500">{hint}</span>}
      {error && <span className="mt-1 block text-xs text-red-600">{error}</span>}
    </label>
  );
}

const inputBase = "w-full rounded-md border bg-white px-2.5 py-1.5 text-sm outline-none focus:ring-2 focus:ring-zinc-300";

export function TextInput({ invalid, className, ...props }: React.InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean }) {
  return <input {...props} className={cx(inputBase, invalid ? "border-red-400" : "border-zinc-300", className)} />;
}

/** Number input that keeps what you type; commits a number (or null when blank) on every change. */
export function NumberInput({ value, onChange, invalid, allowEmpty, ...props }: Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "onChange"> & {
  value: number | null;
  onChange: (value: number | null) => void;
  invalid?: boolean;
  allowEmpty?: boolean;
}) {
  const [text, setText] = useState<string | null>(null);
  const shown = text ?? (value === null ? "" : String(value));
  return (
    <input
      {...props}
      inputMode="decimal"
      value={shown}
      onChange={(e) => {
        const raw = e.target.value;
        setText(raw);
        if (raw.trim() === "") onChange(allowEmpty ? null : Number.NaN);
        else onChange(Number(raw));
      }}
      onBlur={() => setText(null)}
      className={cx(inputBase, invalid ? "border-red-400" : "border-zinc-300")}
    />
  );
}

export function Select({ className, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={cx(inputBase, "border-zinc-300", className)} />;
}

export function Badge({ children, tone = "zinc" }: { children: ReactNode; tone?: "zinc" | "green" | "amber" | "red" | "blue" }) {
  const tones = {
    zinc: "bg-zinc-100 text-zinc-700",
    green: "bg-green-100 text-green-800",
    amber: "bg-amber-100 text-amber-800",
    red: "bg-red-100 text-red-800",
    blue: "bg-blue-100 text-blue-800",
  };
  return <span className={cx("inline-block rounded-full px-2 py-0.5 text-xs font-medium", tones[tone])}>{children}</span>;
}

/** Editable list of short strings (document names). Enter or comma adds a chip. */
export function TagInput({ value, onChange, placeholder, invalid }: {
  value: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
  invalid?: boolean;
}) {
  const [draft, setDraft] = useState("");
  const commit = () => {
    const text = draft.trim();
    if (text) onChange([...value, text]);
    setDraft("");
  };
  return (
    <div className={cx("flex flex-wrap items-center gap-1.5 rounded-md border bg-white px-2 py-1.5", invalid ? "border-red-400" : "border-zinc-300")}>
      {value.map((tag, i) => (
        <span key={`${tag}-${i}`} className="inline-flex items-center gap-1 rounded bg-zinc-100 px-2 py-0.5 text-xs">
          {tag}
          <button type="button" aria-label={`Remove ${tag}`} className="text-zinc-500 hover:text-red-600" onClick={() => onChange(value.filter((_, j) => j !== i))}>
            ×
          </button>
        </span>
      ))}
      <input
        value={draft}
        placeholder={value.length === 0 ? placeholder : "Add…"}
        onChange={(e) => {
          // Typed or pasted commas split the text into chips, so "a, b" becomes two documents.
          const parts = e.target.value.split(",");
          if (parts.length === 1) return setDraft(e.target.value);
          const added = parts.slice(0, -1).map((p) => p.trim()).filter(Boolean);
          if (added.length > 0) onChange([...value, ...added]);
          setDraft(parts[parts.length - 1]);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === ",") {
            e.preventDefault();
            commit();
          } else if (e.key === "Backspace" && draft === "" && value.length > 0) {
            onChange(value.slice(0, -1));
          }
        }}
        onBlur={commit}
        className="min-w-24 flex-1 bg-transparent text-sm outline-none"
      />
    </div>
  );
}

export function IssueList({ issues, title = "Fix these before saving" }: { issues: Issue[]; title?: string }) {
  if (issues.length === 0) return null;
  return (
    <div role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">
      <p className="font-medium">{title}</p>
      <ul className="mt-1 list-disc space-y-0.5 pl-4">
        {issues.map((issue, i) => (
          <li key={i}>
            {issue.path && <code className="mr-1 text-[11px] text-red-600">{issue.path}</code>}
            {issue.message}
          </li>
        ))}
      </ul>
    </div>
  );
}

/** First message for an exact field path, for inline display. */
export function errorAt(issues: Issue[], path: string): string | null {
  return issues.find((i) => i.path === path)?.message ?? null;
}

export function Money({ value }: { value: number | null }) {
  return <>{value === null ? "no limit" : value.toLocaleString("en-US")}</>;
}

export function ColorDot({ color }: { color: string }) {
  return <span className="inline-block h-3 w-3 rounded-full border border-black/10 align-middle" style={{ background: color }} />;
}

export function Spinner({ label = "Loading…" }: { label?: string }) {
  return <p className="py-10 text-center text-sm text-zinc-500">{label}</p>;
}

export function ErrorBanner({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="flex items-center justify-between rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
      <span>{message}</span>
      {onRetry && <Button small onClick={onRetry}>Retry</Button>}
    </div>
  );
}
