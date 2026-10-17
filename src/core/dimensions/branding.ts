import { z } from "zod";
import { defineDimension } from "../types";

const hexColor = z.string().regex(/^#[0-9a-fA-F]{6}$/, "must be a hex colour like #1a73e8");

const isHttpUrl = (value: string) => {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
};

export const brandingSchema = z.object({
  companyName: z.string().trim().min(1, "company name is required"),
  logoUrl: z
    .string()
    .trim()
    .refine((v) => v === "" || isHttpUrl(v), "must be an http(s) URL or empty"),
  primaryColor: hexColor,
  secondaryColor: hexColor,
});
export type BrandingConfig = z.infer<typeof brandingSchema>;

export const branding = defineDimension({
  id: "branding",
  label: "Branding",
  schema: brandingSchema,
  defaults: (): BrandingConfig => ({
    companyName: "",
    logoUrl: "",
    primaryColor: "#1a73e8",
    secondaryColor: "#e8f0fe",
  }),
});
