"use client";

import { useMemo, useState } from "react";
import type { ProcessResult } from "@/core/types";
import { ApiError, api, type ClaimBody } from "./api";
import { ClaimForm, newClaim, type FieldDef } from "./ClaimForm";
import { Button, Card, ErrorBanner, Field, Select, Spinner } from "./components";
import { ResultView } from "./ResultView";
import { useLoad } from "./useLoad";

/** Runs a sample claim through the real runtime endpoint for one tenant or all of them. */
export function PreviewRunner() {
  const { data: tenants, error: loadError, reload } = useLoad(api.listTenants);
  const [error, setError] = useState<string | null>(null);
  const [claim, setClaim] = useState<ClaimBody>(newClaim);
  const [pickedId, setTenantId] = useState("");
  const [results, setResults] = useState<ProcessResult[]>([]);
  const [busy, setBusy] = useState(false);
  const tenantId = tenants?.find((t) => t.id === pickedId)?.id ?? tenants?.[0]?.id ?? "";

  const fields = useMemo<FieldDef[]>(() => {
    const byKey = new Map<string, FieldDef>();
    for (const t of tenants ?? []) for (const f of t.config.customFields.fields) if (f.key) byKey.set(f.key, f);
    return [...byKey.values()];
  }, [tenants]);

  if (loadError && !tenants) return <ErrorBanner message={loadError} onRetry={reload} />;
  if (!tenants) return <Spinner />;

  const run = async (ids: string[]) => {
    setBusy(true);
    setError(null);
    try {
      setResults(await Promise.all(ids.map((id) => api.processClaim(id, claim))));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Processing failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Preview & run</h1>
        <p className="text-sm text-zinc-500">Enter one sample claim and see how each tenant’s saved configuration processes it. This calls the production endpoint, <code>POST /api/tenants/:id/process</code>.</p>
      </div>
      <Card title="Sample claim">
        <div className="space-y-4">
          <ClaimForm claim={claim} onChange={setClaim} fields={fields} />
          <div className="flex flex-wrap items-end gap-3 border-t border-zinc-100 pt-4">
            <Field label="Tenant" className="w-64">
              <Select value={tenantId} onChange={(e) => setTenantId(e.target.value)}>
                {tenants.map((t) => <option key={t.id} value={t.id}>{t.config.branding.companyName}</option>)}
              </Select>
            </Field>
            <Button variant="primary" disabled={busy || !tenantId} onClick={() => run([tenantId])}>Process for this tenant</Button>
            <Button disabled={busy} onClick={() => run(tenants.map((t) => t.id))}>Process for all tenants</Button>
          </div>
        </div>
      </Card>

      {error && <ErrorBanner message={error} />}
      {results.length > 0 && (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {results.map((r) => (
            <Card key={r.tenantId} title={r.tenantName} subtitle={`${r.tenantId} · config v${r.configVersion}`}>
              <ResultView result={r} />
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
