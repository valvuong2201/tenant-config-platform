"use client";

import Link from "next/link";
import { useCallback, useMemo, useState } from "react";
import { diffConfigs } from "@/core/diff";
import type { TenantVersion } from "@/store/types";
import { ApiError, api } from "./api";
import { Badge, Button, Card, ErrorBanner, Spinner } from "./components";
import { DiffView } from "./DiffView";
import { useLoad } from "./useLoad";

type Compare = { version: number; against: "previous" | "current" };

export function HistoryView({ tenantId }: { tenantId: string }) {
  const fetcher = useCallback(async () => {
    const [tenant, versions] = await Promise.all([api.getTenant(tenantId), api.history(tenantId)]);
    return { tenant, versions };
  }, [tenantId]);
  const { data, error: loadError, reload } = useLoad(fetcher);
  const [actionError, setActionError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [open, setOpen] = useState<Compare | null>(null);
  const [busy, setBusy] = useState(false);
  const tenant = data?.tenant ?? null;
  const versions = data?.versions ?? null;

  const byNumber = useMemo(() => new Map((versions ?? []).map((v) => [v.version, v])), [versions]);

  if (loadError && !data) return <ErrorBanner message={loadError} onRetry={reload} />;
  if (!tenant || !versions) return <Spinner />;

  const rollback = async (v: TenantVersion) => {
    if (!window.confirm(`Roll back ${tenant.config.branding.companyName} to version ${v.version}? This saves a new version with that configuration; nothing is deleted.`)) return;
    setBusy(true);
    setNotice(null);
    setActionError(null);
    try {
      const updated = await api.rollback(tenantId, v.version, tenant.version);
      setNotice(`Rolled back to v${v.version}. Saved as version ${updated.version}.`);
      setOpen(null);
      reload();
    } catch (e) {
      setActionError(e instanceof ApiError && e.issues.length ? `That version no longer passes validation: ${e.issues.map((i) => i.message).join("; ")}` : e instanceof Error ? e.message : "Rollback failed");
    } finally {
      setBusy(false);
    }
  };

  const changesFor = (cmp: Compare) => {
    const v = byNumber.get(cmp.version)!;
    const other = cmp.against === "current" ? tenant : byNumber.get(cmp.version - 1);
    if (!other) return null;
    return { left: other.config, right: v.config, leftLabel: cmp.against === "current" ? `Current (v${tenant.version})` : `v${cmp.version - 1}`, rightLabel: `v${cmp.version}` };
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">{tenant.config.branding.companyName}: version history</h1>
          <p className="text-sm text-zinc-500">Every save creates a version. Rolling back creates a new version, so the history is never rewritten.</p>
        </div>
        <Link href={`/tenants/${tenantId}`} className="rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm hover:bg-zinc-50">Back to editor</Link>
      </div>
      {actionError && <ErrorBanner message={actionError} onRetry={reload} />}
      {notice && <p role="status" className="rounded-md bg-green-50 px-4 py-2.5 text-sm text-green-800">{notice}</p>}

      <div className="space-y-3">
        {[...versions].reverse().map((v) => {
          const isCurrent = v.version === tenant.version;
          const cmp = open?.version === v.version ? open : null;
          const detail = cmp ? changesFor(cmp) : null;
          return (
            <Card key={v.version}>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">Version {v.version}</span>
                    {isCurrent && <Badge tone="green">current</Badge>}
                    {v.rolledBackFrom !== null && <Badge tone="blue">rollback of v{v.rolledBackFrom}</Badge>}
                  </div>
                  <p className="text-xs text-zinc-500">{new Date(v.savedAt).toLocaleString()}{v.note ? ` · ${v.note}` : ""}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {v.version > 1 && (
                    <Button small onClick={() => setOpen(cmp?.against === "previous" ? null : { version: v.version, against: "previous" })}>
                      Changes in this version
                    </Button>
                  )}
                  {!isCurrent && (
                    <>
                      <Button small onClick={() => setOpen(cmp?.against === "current" ? null : { version: v.version, against: "current" })}>
                        Compare with current
                      </Button>
                      <Button small variant="primary" disabled={busy} onClick={() => rollback(v)}>Roll back to this</Button>
                    </>
                  )}
                </div>
              </div>
              {detail && (
                <div className="mt-4 border-t border-zinc-100 pt-4">
                  <DiffView changes={diffConfigs(detail.left, detail.right)} leftLabel={detail.leftLabel} rightLabel={detail.rightLabel} />
                </div>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}
