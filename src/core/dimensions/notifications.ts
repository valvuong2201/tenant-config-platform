import { z } from "zod";
import {
  CHANNELS,
  NOTIFICATION_EVENTS,
  defineDimension,
  type Issue,
  type NotificationEvent,
  type RenderedNotification,
} from "../types";

const eventSchema = z.object({
  channels: z.array(z.enum(CHANNELS)),
  /** Omit to use the platform default template for this event. */
  template: z
    .object({
      subject: z.string().trim().min(1, "subject is required"),
      body: z.string().trim().min(1, "body is required"),
    })
    .optional(),
});

export const notificationsSchema = z.object({
  /** Destination for the `webhook` channel; required when any event uses it. */
  webhookUrl: z.string().trim(),
  events: z.object({
    claim_submitted: eventSchema,
    approved: eventSchema,
    rejected: eventSchema,
    payment_sent: eventSchema,
  }),
});
export type NotificationsConfig = z.infer<typeof notificationsSchema>;

export const DEFAULT_TEMPLATES: Record<NotificationEvent, { subject: string; body: string }> = {
  claim_submitted: {
    subject: "Claim {{claimId}} received",
    body: "Your {{claimType}} claim {{claimId}} for {{amount}} has been received by {{companyName}}.",
  },
  approved: {
    subject: "Claim {{claimId}} approved",
    body: "Good news: {{companyName}} approved your {{claimType}} claim {{claimId}} for {{amount}}.",
  },
  rejected: {
    subject: "Claim {{claimId}} was not approved",
    body: "{{companyName}} could not approve your {{claimType}} claim {{claimId}}.",
  },
  payment_sent: {
    subject: "Payment sent for claim {{claimId}}",
    body: "{{companyName}} has sent payment of {{amount}} for claim {{claimId}}.",
  },
};

function render(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (match, name: string) => vars[name] ?? match);
}

const isHttpUrl = (value: string) => {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
};

export const notifications = defineDimension({
  id: "notifications",
  label: "Notifications",
  schema: notificationsSchema,
  defaults: (): NotificationsConfig => ({
    webhookUrl: "",
    events: {
      claim_submitted: { channels: ["email"] },
      approved: { channels: ["email"] },
      rejected: { channels: ["email"] },
      payment_sent: { channels: ["email"] },
    },
  }),
  diff: {
    sets: NOTIFICATION_EVENTS.map((e) => `events.${e}.channels`),
  },
  validate(value) {
    const issues: Issue[] = [];
    const usesWebhook = NOTIFICATION_EVENTS.some((e) => value.events[e].channels.includes("webhook"));
    if (usesWebhook && !isHttpUrl(value.webhookUrl)) {
      issues.push({ path: "webhookUrl", message: "enter an http(s) URL; a webhook channel is enabled" });
    }
    if (!usesWebhook && value.webhookUrl !== "" && !isHttpUrl(value.webhookUrl)) {
      issues.push({ path: "webhookUrl", message: "must be an http(s) URL or empty" });
    }
    for (const event of NOTIFICATION_EVENTS) {
      const channels = value.events[event].channels;
      if (new Set(channels).size !== channels.length) {
        issues.push({ path: `events.${event}.channels`, message: "a channel is listed more than once" });
      }
    }
    return issues;
  },
  process(value, { config, claim, result }) {
    const vars = {
      companyName: config.branding?.companyName ?? "",
      claimId: claim.claimId ?? "PREVIEW",
      claimType: claim.claimType,
      amount: String(claim.amount),
    };
    const build = (event: NotificationEvent): RenderedNotification[] => {
      const cfg = value.events[event];
      const template = cfg.template ?? DEFAULT_TEMPLATES[event];
      return cfg.channels.map((channel) => ({
        event,
        channel,
        templateSource: cfg.template ? "custom" : "default",
        subject: render(template.subject, vars),
        body: render(template.body, vars),
      }));
    };

    // Submission always notifies; an auto-approved claim is also decided right now.
    const firedEvents: NotificationEvent[] = ["claim_submitted"];
    if (result.approval?.decision === "AUTO_APPROVED") firedEvents.push("approved");
    const deferredEvents = NOTIFICATION_EVENTS.filter((e) => !firedEvents.includes(e));

    return {
      output: {
        notifications: {
          fired: firedEvents.flatMap(build),
          deferred: deferredEvents.flatMap(build),
        },
      },
    };
  },
});
