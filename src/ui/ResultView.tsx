"use client";

import type { ProcessResult } from "@/core/types";
import { Badge } from "./components";

const KNOWN = new Set([
  "tenantId", "tenantName", "configVersion", "status", "errors", "claimType", "requiredDocuments",
  "optionalDocuments", "approval", "notifications", "sla", "customFields",
]);

const statusTone = { PROCESSED: "green", PROCESSED_WITH_ERRORS: "amber", REJECTED: "red" } as const;

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-zinc-500">{title}</h3>
      {children}
    </div>
  );
}

const List = ({ items, empty }: { items: string[]; empty: string }) =>
  items.length === 0 ? <p className="text-sm text-zinc-400">{empty}</p> : (
    <ul className="list-disc pl-5 text-sm">{items.map((d) => <li key={d}>{d}</li>)}</ul>
  );

/** Renders a `processClaim` result. Keys the core adds later are shown generically under "Other". */
export function ResultView({ result }: { result: ProcessResult }) {
  const extras = Object.entries(result).filter(([key]) => !KNOWN.has(key));
  return (
    <div className="space-y-4" data-testid="result-view">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-semibold">{result.tenantName}</span>
        <Badge tone={statusTone[result.status]}>{result.status.replaceAll("_", " ")}</Badge>
        {result.configVersion !== null && <Badge>config v{result.configVersion}</Badge>}
      </div>

      {result.errors.length > 0 && (
        <ul className="space-y-1 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          {result.errors.map((e, i) => (
            <li key={i}>
              {e.field && <code className="mr-1">{e.field}</code>}
              {e.message}
            </li>
          ))}
        </ul>
      )}

      {result.status !== "REJECTED" && (
        <>
          <Section title="Approval routing">
            {result.approval && (
              <div className="text-sm">
                <Badge tone={result.approval.decision === "AUTO_APPROVED" ? "green" : "blue"}>
                  {result.approval.decision === "AUTO_APPROVED" ? "Auto-approved" : `Needs ${result.approval.role}`}
                </Badge>
                <p className="mt-1 text-xs text-zinc-500">{result.approval.reason}</p>
              </div>
            )}
          </Section>

          <Section title="Required documents">
            <List items={result.requiredDocuments} empty="None" />
            {result.optionalDocuments.length > 0 && (
              <p className="mt-1 text-xs text-zinc-500">Optional: {result.optionalDocuments.join(", ")}</p>
            )}
          </Section>

          <Section title="Notifications fired now">
            {result.notifications.fired.length === 0 ? (
              <p className="text-sm text-zinc-400">None</p>
            ) : (
              <ul className="space-y-1 text-sm">
                {result.notifications.fired.map((n, i) => (
                  <li key={i}>
                    <Badge tone="blue">{n.channel}</Badge> <span className="font-mono text-xs">{n.event}</span>
                    <span className="ml-1 text-xs text-zinc-500">{n.templateSource} template: “{n.subject}”</span>
                  </li>
                ))}
              </ul>
            )}
            {result.notifications.deferred.length > 0 && (
              <p className="mt-1 text-xs text-zinc-500">
                Later: {[...new Set(result.notifications.deferred.map((n) => n.event))]
                  .map((event) => `${event} (${result.notifications.deferred.filter((n) => n.event === event).map((n) => n.channel).join("+") || "none"})`)
                  .join(", ")}
              </p>
            )}
          </Section>

          <Section title="SLA">
            {result.sla ? (
              <div className="text-sm">
                <p>
                  Deadline <strong>{result.sla.deadline}</strong>{" "}
                  <span className="text-xs text-zinc-500">({result.sla.targetBusinessDays} business days from {result.sla.submissionDate})</span>
                </p>
                {result.sla.escalation.map((e, i) => (
                  <p key={i} className="text-xs text-zinc-500">
                    Escalate to {e.notifyRole} on {e.escalateOn}
                  </p>
                ))}
              </div>
            ) : (
              <p className="text-sm text-zinc-400">No SLA target</p>
            )}
          </Section>

          <Section title="Custom fields">
            {result.customFields.required.length === 0 && Object.keys(result.customFields.values).length === 0 ? (
              <p className="text-sm text-zinc-400">None required</p>
            ) : (
              <ul className="text-sm">
                {result.customFields.required.map((f) => {
                  const err = result.customFields.errors.find((e) => e.field === `customFields.${f.key}`);
                  return (
                    <li key={f.key}>
                      {err ? <span className="text-red-600">✗</span> : <span className="text-green-600">✓</span>} {f.label}
                      <span className="text-xs text-zinc-500"> ({f.type}, required)</span>
                      {err && <span className="ml-1 text-xs text-red-600">{err.message}</span>}
                    </li>
                  );
                })}
              </ul>
            )}
          </Section>
        </>
      )}

      {extras.length > 0 && (
        <Section title="Other">
          {extras.map(([key, value]) => (
            <div key={key}>
              <p className="text-xs font-medium">{key}</p>
              <pre className="overflow-x-auto rounded bg-zinc-50 p-2 text-xs">{JSON.stringify(value, null, 2)}</pre>
            </div>
          ))}
        </Section>
      )}
    </div>
  );
}
