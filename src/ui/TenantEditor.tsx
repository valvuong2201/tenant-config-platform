"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useMemo, useState } from "react";
import { deepEqual } from "@/core/diff";
import { defaultConfig, dimensions, validateConfig, type TenantConfig } from "@/core/registry";
import type { Issue, ProcessResult } from "@/core/types";
import { ApiError, api, type ClaimBody } from "./api";
import { ClaimForm, newClaim } from "./ClaimForm";
import { Badge, Button, Card, ErrorBanner, Field, IssueList, Spinner, TextInput } from "./components";
import { editorFor } from "./editors";
import { ResultView } from "./ResultView";
import { useLoad } from "./useLoad";

const issuesFor = (issues: Issue[], dimensionId: string): Issue[] =>
  issues
    .filter((i) => i.path === dimensionId || i.path.startsWith(`${dimensionId}.`))
    .map((i) => ({ ...i, path: i.path === dimensionId ? "" : i.path.slice(dimensionId.length + 1) }));

export function TenantEditor({ tenantId }: { tenantId?: string }) {
  const router = useRouter();
  const fetcher = useCallback(() => (tenantId ? api.getTenant(tenantId) : Promise.resolve(null)), [tenantId]);
  const { data: loaded, error: loadError, reload, setData: setBase } = useLoad(fetcher);
  const [isNew] = useState(!tenantId);
  const base = loaded;
  // `edits` holds the user's unsaved changes; null means "show what is saved".
  const [edits, setEdits] = useState<TenantConfig | null>(null);
  const newDefaults = useMemo(() => defaultConfig(), []);
  const draft = edits ?? base?.config ?? (isNew ? newDefaults : null);

  const [note, setNote] = useState("");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [serverIssues, setServerIssues] = useState<Issue[]>([]);
  const [saved, setSaved] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [claim, setClaim] = useState<ClaimBody>(newClaim);
  const [preview, setPreview] = useState<ProcessResult | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);

  const validation = useMemo(() => (draft ? validateConfig(draft) : null), [draft]);
  const issues = useMemo(() => (validation && !validation.ok ? validation.issues : []), [validation]);
  const dirty = edits !== null && (base === null || !deepEqual(base.config, edits));

  if (loadError && !base) return <ErrorBanner message={loadError} onRetry={reload} />;
  if (!draft) return <Spinner />;

  const update = (dimensionId: string, value: unknown) => {
    setEdits({ ...draft, [dimensionId]: value } as TenantConfig);
    setServerIssues([]);
    setSaved(null);
    setPreview(null);
  };

  const save = async () => {
    setBusy(true);
    setSaveError(null);
    setSaved(null);
    try {
      if (!base) {
        const created = await api.createTenant(draft, note || undefined);
        router.push(`/tenants/${created.id}`);
        return;
      }
      const updated = await api.updateTenant(base.id, draft, note || undefined, base.version);
      setBase(updated);
      setEdits(null);
      setNote("");
      setSaved(`Saved as version ${updated.version}.`);
    } catch (error) {
      if (error instanceof ApiError) {
        setSaveError(error.message);
        setServerIssues(error.issues);
      } else setSaveError("Could not save");
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!base || !window.confirm(`Delete ${base.config.branding.companyName}? Its version history is deleted too.`)) return;
    try {
      await api.deleteTenant(base.id);
      router.push("/tenants");
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "Could not delete");
    }
  };

  const runPreview = async () => {
    setPreviewError(null);
    try {
      setPreview(await api.previewDraft(draft, claim, base?.id));
    } catch (error) {
      setPreview(null);
      setPreviewError(
        error instanceof ApiError && error.issues.length > 0
          ? "Fix the configuration errors first; the preview needs a valid config."
          : error instanceof Error ? error.message : "Preview failed",
      );
    }
  };

  const customFieldDefs = draft.customFields.fields.filter((f) => f.key);
  const allIssues = [...issues, ...serverIssues.filter((s) => !issues.some((i) => i.path === s.path && i.message === s.message))];

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_24rem]">
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold">{base ? draft.branding.companyName || base.id : "New tenant"}</h1>
            <p className="text-sm text-zinc-500">
              {base ? <>ID <code>{base.id}</code> · version {base.version}</> : "Fill in the form; no code changes needed to onboard an insurer."}
            </p>
          </div>
          {base && (
            <div className="flex gap-2">
              <Link href={`/tenants/${base.id}/history`} className="rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm hover:bg-zinc-50">
                History & rollback
              </Link>
              <Button variant="danger" onClick={remove}>Delete</Button>
            </div>
          )}
        </div>

        {dimensions.map((d) => {
          const Editor = editorFor(d.id);
          const own = issuesFor(allIssues, d.id);
          return (
            <Card key={d.id} title={d.label} actions={own.length > 0 ? <Badge tone="red">{own.length} to fix</Badge> : undefined}>
              <div className="space-y-4">
                <Editor value={(draft as Record<string, unknown>)[d.id]} onChange={(v) => update(d.id, v)} issues={own} config={draft} />
                <IssueList issues={own} title="Fix these before saving" />
              </div>
            </Card>
          );
        })}
      </div>

      <aside className="space-y-6 lg:sticky lg:top-6 lg:self-start">
        <Card title="Save">
          <div className="space-y-3">
            <Field label="Change note" hint="Shown in version history">
              <TextInput value={note} placeholder="e.g. Raised auto-approval to 25,000" onChange={(e) => setNote(e.target.value)} />
            </Field>
            {allIssues.length > 0 && <p className="text-xs text-red-700">{allIssues.length} validation problem{allIssues.length === 1 ? "" : "s"}; saving is disabled.</p>}
            {saveError && <ErrorBanner message={saveError} onRetry={base ? () => { setEdits(null); setSaveError(null); reload(); } : undefined} />}
            {saved && <p role="status" className="rounded-md bg-green-50 px-3 py-2 text-xs text-green-800">{saved}</p>}
            <Button variant="primary" className="w-full" disabled={busy || issues.length > 0 || (!!base && !dirty)} onClick={save}>
              {busy ? "Saving…" : base ? "Save new version" : "Create tenant"}
            </Button>
            {base && dirty && <p className="text-center text-xs text-amber-700">Unsaved changes</p>}
          </div>
        </Card>

        <Card title="Preview" subtitle="Runs the same processClaim code as production, against the config you are editing right now.">
          <div className="space-y-4">
            <ClaimForm claim={claim} onChange={setClaim} fields={customFieldDefs} />
            <Button variant="primary" className="w-full" onClick={runPreview} disabled={issues.length > 0}>Run preview</Button>
            {previewError && <ErrorBanner message={previewError} />}
            {preview && <ResultView result={preview} />}
          </div>
        </Card>
      </aside>
    </div>
  );
}
