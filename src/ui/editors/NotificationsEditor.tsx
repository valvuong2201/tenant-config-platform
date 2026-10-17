"use client";

import type { NotificationsConfig } from "@/core/dimensions/notifications";
import { DEFAULT_TEMPLATES } from "@/core/dimensions/notifications";
import { CHANNELS, NOTIFICATION_EVENTS, type Channel, type NotificationEvent } from "@/core/types";
import { Field, TextInput, errorAt } from "../components";
import type { EditorProps } from "./types";

export function NotificationsEditor({ value, onChange, issues }: EditorProps<NotificationsConfig>) {
  const patchEvent = (event: NotificationEvent, change: Partial<NotificationsConfig["events"][NotificationEvent]>) =>
    onChange({ ...value, events: { ...value.events, [event]: { ...value.events[event], ...change } } });

  const toggleChannel = (event: NotificationEvent, channel: Channel, on: boolean) => {
    const current = value.events[event].channels;
    patchEvent(event, { channels: on ? [...current, channel] : current.filter((c) => c !== channel) });
  };

  const setTemplate = (event: NotificationEvent, custom: boolean) =>
    patchEvent(event, { template: custom ? { ...DEFAULT_TEMPLATES[event] } : undefined });

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-zinc-500">
              <th className="py-1 pr-4 font-medium">Event</th>
              {CHANNELS.map((c) => (
                <th key={c} className="px-3 py-1 font-medium capitalize">{c}</th>
              ))}
              <th className="px-3 py-1 font-medium">Template</th>
            </tr>
          </thead>
          <tbody>
            {NOTIFICATION_EVENTS.map((event) => {
              const cfg = value.events[event];
              return (
                <tr key={event} className="border-t border-zinc-100 align-top">
                  <td className="py-2 pr-4 font-mono text-xs">{event}</td>
                  {CHANNELS.map((channel) => (
                    <td key={channel} className="px-3 py-2">
                      <input
                        type="checkbox"
                        aria-label={`${event} via ${channel}`}
                        checked={cfg.channels.includes(channel)}
                        onChange={(e) => toggleChannel(event, channel, e.target.checked)}
                      />
                    </td>
                  ))}
                  <td className="px-3 py-2">
                    <label className="flex items-center gap-1.5 text-xs">
                      <input type="checkbox" checked={!!cfg.template} onChange={(e) => setTemplate(event, e.target.checked)} />
                      Custom
                    </label>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {NOTIFICATION_EVENTS.filter((e) => value.events[e].template).map((event) => {
        const template = value.events[event].template!;
        return (
          <div key={event} className="rounded-lg border border-zinc-200 p-4">
            <h3 className="mb-3 font-mono text-xs font-semibold">{event} template</h3>
            <div className="grid gap-3">
              <Field label="Subject" error={errorAt(issues, `events.${event}.template.subject`)}>
                <TextInput value={template.subject} onChange={(e) => patchEvent(event, { template: { ...template, subject: e.target.value } })} />
              </Field>
              <Field label="Body" hint="Variables: {{companyName}} {{claimId}} {{claimType}} {{amount}}" error={errorAt(issues, `events.${event}.template.body`)}>
                <textarea
                  rows={3}
                  value={template.body}
                  onChange={(e) => patchEvent(event, { template: { ...template, body: e.target.value } })}
                  className="w-full rounded-md border border-zinc-300 bg-white px-2.5 py-1.5 text-sm outline-none focus:ring-2 focus:ring-zinc-300"
                />
              </Field>
            </div>
          </div>
        );
      })}

      <Field label="Webhook URL" hint="Required when any event uses the webhook channel." error={errorAt(issues, "webhookUrl")} className="max-w-xl">
        <TextInput value={value.webhookUrl} placeholder="https://…" onChange={(e) => onChange({ ...value, webhookUrl: e.target.value })} invalid={!!errorAt(issues, "webhookUrl")} />
      </Field>
    </div>
  );
}
