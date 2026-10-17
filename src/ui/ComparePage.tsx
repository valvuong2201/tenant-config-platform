"use client";

import { useMemo, useState } from "react";
import { diffConfigs } from "@/core/diff";
import { api } from "./api";
import { Card, ErrorBanner, Field, Select, Spinner } from "./components";
import { DiffView } from "./DiffView";
import { useLoad } from "./useLoad";

export function ComparePage() {
  const { data: tenants, error, reload } = useLoad(api.listTenants);
  const [leftPick, setLeftId] = useState("");
  const [rightPick, setRightId] = useState("");

  const left = tenants?.find((t) => t.id === leftPick) ?? tenants?.[0];
  const right = tenants?.find((t) => t.id === rightPick) ?? tenants?.[1] ?? tenants?.[0];
  const leftId = left?.id ?? "";
  const rightId = right?.id ?? "";
  const changes = useMemo(() => (left && right ? diffConfigs(left.config, right.config) : []), [left, right]);

  if (error && !tenants) return <ErrorBanner message={error} onRetry={reload} />;
  if (!tenants) return <Spinner />;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Compare configurations</h1>
        <p className="text-sm text-zinc-500">Lists, tiers and fields are matched by identity, so reordering is not a difference.</p>
      </div>
      <Card>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Left tenant">
            <Select value={leftId} onChange={(e) => setLeftId(e.target.value)}>
              {tenants.map((t) => <option key={t.id} value={t.id}>{t.config.branding.companyName} (v{t.version})</option>)}
            </Select>
          </Field>
          <Field label="Right tenant">
            <Select value={rightId} onChange={(e) => setRightId(e.target.value)}>
              {tenants.map((t) => <option key={t.id} value={t.id}>{t.config.branding.companyName} (v{t.version})</option>)}
            </Select>
          </Field>
        </div>
      </Card>
      {left && right && (
        <>
          <p className="text-sm text-zinc-600">{changes.length} difference{changes.length === 1 ? "" : "s"} between <strong>{left.config.branding.companyName}</strong> and <strong>{right.config.branding.companyName}</strong>.</p>
          <DiffView changes={changes} leftLabel={left.config.branding.companyName} rightLabel={right.config.branding.companyName} />
        </>
      )}
    </div>
  );
}
