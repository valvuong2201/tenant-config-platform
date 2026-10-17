import { z } from "zod";
import { defineDimension } from "../types";

export const SUPPORTED_CURRENCIES = ["USD", "VND", "THB", "HKD", "SGD"] as const;

export const currencySchema = z.object({
  code: z.enum(SUPPORTED_CURRENCIES),
  /** Decimal places shown when formatting amounts. */
  decimals: z.number().int("must be a whole number").min(0, "must be 0 or more").max(4, "must be 4 or fewer"),
});
export type CurrencyConfig = z.infer<typeof currencySchema>;

export const currency = defineDimension({
  id: "currency",
  label: "Currency",
  schema: currencySchema,
  defaults: (): CurrencyConfig => ({ code: "USD", decimals: 2 }),
  process(value, { claim }) {
    return {
      output: {
        currency: {
          code: value.code,
          formattedAmount: `${claim.amount.toLocaleString("en-US", {
            minimumFractionDigits: value.decimals,
            maximumFractionDigits: value.decimals,
          })} ${value.code}`,
        },
      },
    };
  },
});
