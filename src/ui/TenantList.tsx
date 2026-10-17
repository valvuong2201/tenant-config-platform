"use client";

import Link from "next/link";
import { api } from "./api";
import { Badge, Card, ColorDot, ErrorBanner, Money, Spinner } from "./components";
import { useLoad } from "./useLoad";

export function TenantList() {
  const { data: tenants, error, reload } = useLoad(api.listTenants);

  if (error && !tenants) return <ErrorBanner message={error} onRetry={reload} />;
  if (!tenants) return <Spinner />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Tenants</h1>
          <p className="text-sm text-zinc-500">Each insurer’s claim handling is defined entirely by its configuration.</p>
        </div>
        <Link href="/tenants/new" className="rounded-md bg-zinc-900 px-3.5 py-2 text-sm font-medium text-white hover:bg-zinc-700">
          + New tenant
        </Link>
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {tenants.map((t) => {
          const c = t.config;
          const channels = [...new Set(Object.values(c.notifications.events).flatMap((e) => e.channels))];
          return (
            <Card key={t.id} className="overflow-hidden">
              <div className="-m-5 mb-4 h-1.5" style={{ background: c.branding.primaryColor }} />
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h2 className="font-semibold">
                    <ColorDot color={c.branding.primaryColor} /> <ColorDot color={c.branding.secondaryColor} /> {c.branding.companyName}
                  </h2>
                  <p className="text-xs text-zinc-500"><code>{t.id}</code> · v{t.version}</p>
                </div>
              </div>
              <dl className="mt-4 space-y-1.5 text-sm">
                <div className="flex flex-wrap gap-1">{c.claimTypes.enabled.map((e) => <Badge key={e.type}>{e.type}</Badge>)}</div>
                <p><span className="text-zinc-500">Auto-approve below</span> <Money value={c.approval.autoApprovalThreshold} /></p>
                <p><span className="text-zinc-500">Approval tiers</span> {c.approval.tiers.map((x) => x.role).join(" → ")}</p>
                <p><span className="text-zinc-500">Notifications</span> {channels.join(", ") || "none"}</p>
                <p><span className="text-zinc-500">Custom fields</span> {c.customFields.fields.map((f) => f.label).join(", ") || "none"}</p>
              </dl>
              <div className="mt-4 flex gap-3 text-sm">
                <Link href={`/tenants/${t.id}`} className="font-medium text-blue-700 hover:underline">Edit</Link>
                <Link href={`/tenants/${t.id}/history`} className="text-blue-700 hover:underline">History</Link>
                <Link href="/preview" className="text-blue-700 hover:underline">Preview</Link>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
