import { validateConfig, type TenantConfig } from "./registry";
import type { Channel } from "./types";

/**
 * Sample tenants from the brief. Values the brief leaves open are assumptions:
 * - SafeGuard dental SLA: 5 business days (brief lists dental as enabled but gives no SLA).
 * - HealthFirst tiers: assessor 5,000-50,000, manager 50,000 and above.
 * - Escalation rules and document lists are illustrative.
 */
const allEvents = (channels: Channel[]) => ({
  claim_submitted: { channels },
  approved: { channels },
  rejected: { channels },
  payment_sent: { channels },
});

const RAW_SEEDS: { id: string; config: Partial<TenantConfig> }[] = [
  {
    id: "safeguard",
    config: {
      branding: {
        companyName: "SafeGuard Insurance",
        logoUrl: "",
        primaryColor: "#0b5394",
        secondaryColor: "#cfe2f3",
      },
      claimTypes: {
        enabled: [
          {
            type: "OUTPATIENT",
            requiredDocuments: ["Medical receipt", "Doctor's note"],
            optionalDocuments: ["Prescription"],
          },
          {
            type: "INPATIENT",
            requiredDocuments: ["Hospital invoice", "Discharge summary", "Admission form"],
            optionalDocuments: ["Lab reports"],
          },
          { type: "DENTAL", requiredDocuments: ["Dental invoice"], optionalDocuments: ["X-ray"] },
        ],
      },
      approval: {
        autoApprovalThreshold: 20000,
        tiers: [
          { role: "assessor", minAmount: 20000, maxAmount: 100000 },
          { role: "team_lead", minAmount: 100000, maxAmount: 500000 },
          { role: "director", minAmount: 500000, maxAmount: null },
        ],
      },
      notifications: { webhookUrl: "", events: allEvents(["email"]) },
      sla: {
        targets: [
          { claimType: "OUTPATIENT", businessDays: 5 },
          { claimType: "INPATIENT", businessDays: 10 },
          { claimType: "DENTAL", businessDays: 5 },
        ],
        escalation: [
          { afterBreachDays: 0, notifyRole: "team_lead" },
          { afterBreachDays: 3, notifyRole: "director" },
        ],
      },
      customFields: {
        fields: [{ key: "employeeId", label: "Employee ID", type: "text", required: true }],
      },
    },
  },
  {
    id: "healthfirst",
    config: {
      branding: {
        companyName: "HealthFirst",
        logoUrl: "",
        primaryColor: "#2e7d32",
        secondaryColor: "#e8f5e9",
      },
      claimTypes: {
        enabled: [
          { type: "OUTPATIENT", requiredDocuments: ["Medical receipt"], optionalDocuments: ["Prescription"] },
          {
            type: "INPATIENT",
            requiredDocuments: ["Hospital invoice", "Discharge summary"],
            optionalDocuments: ["Lab reports"],
          },
          { type: "DENTAL", requiredDocuments: ["Dental invoice"], optionalDocuments: [] },
          {
            type: "MATERNITY",
            requiredDocuments: ["Hospital invoice", "Birth certificate"],
            optionalDocuments: ["Antenatal records"],
          },
          {
            type: "OPTICAL",
            requiredDocuments: ["Optical receipt", "Prescription"],
            optionalDocuments: [],
          },
        ],
      },
      approval: {
        autoApprovalThreshold: 5000,
        tiers: [
          { role: "assessor", minAmount: 5000, maxAmount: 50000 },
          { role: "manager", minAmount: 50000, maxAmount: null },
        ],
      },
      notifications: { webhookUrl: "", events: allEvents(["email", "sms"]) },
      sla: {
        targets: ["OUTPATIENT", "INPATIENT", "DENTAL", "MATERNITY", "OPTICAL"].map((claimType) => ({
          claimType: claimType as "OUTPATIENT",
          businessDays: 7,
        })),
        escalation: [{ afterBreachDays: 0, notifyRole: "manager" }],
      },
      customFields: { fields: [] },
    },
  },
  {
    id: "govhealth",
    config: {
      branding: {
        companyName: "GovHealth",
        logoUrl: "",
        primaryColor: "#6a1b9a",
        secondaryColor: "#f3e5f5",
      },
      claimTypes: {
        enabled: [
          {
            type: "OUTPATIENT",
            requiredDocuments: ["Medical receipt", "Referral letter", "Civil servant ID copy"],
            optionalDocuments: [],
          },
          {
            type: "INPATIENT",
            requiredDocuments: ["Hospital invoice", "Discharge summary", "Civil servant ID copy"],
            optionalDocuments: ["Lab reports"],
          },
        ],
      },
      approval: {
        autoApprovalThreshold: 0,
        tiers: [{ role: "committee", minAmount: 0, maxAmount: null }],
      },
      notifications: {
        webhookUrl: "https://example.gov/hooks/claims",
        events: allEvents(["email", "webhook"]),
      },
      sla: {
        targets: [
          { claimType: "OUTPATIENT", businessDays: 15 },
          { claimType: "INPATIENT", businessDays: 15 },
        ],
        escalation: [{ afterBreachDays: 0, notifyRole: "committee_chair" }],
      },
      customFields: {
        fields: [
          { key: "department", label: "Department", type: "text", required: true },
          { key: "budgetCode", label: "Budget Code", type: "text", required: true },
        ],
      },
    },
  },
];

/**
 * Seeds list only the dimensions they customise; the rest take their defaults through
 * `validateConfig`, so adding a config dimension never requires touching this file.
 * Invalid seed data fails fast at import time.
 */
export const SEED_TENANTS: { id: string; config: TenantConfig }[] = RAW_SEEDS.map(({ id, config }) => {
  const result = validateConfig(config);
  if (!result.ok) {
    throw new Error(`Seed tenant "${id}" is invalid: ${result.issues.map((i) => `${i.path}: ${i.message}`).join("; ")}`);
  }
  return { id, config: result.config };
});
