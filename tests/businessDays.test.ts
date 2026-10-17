import { describe, expect, it } from "vitest";
import { addBusinessDays } from "@/core/businessDays";

describe("addBusinessDays", () => {
  it("skips the weekend after a Friday", () => {
    expect(addBusinessDays("2026-10-16", 1)).toBe("2026-10-19");
  });
  it("counts from the next weekday when submitted on a weekend", () => {
    expect(addBusinessDays("2026-10-17", 1)).toBe("2026-10-19"); // Saturday
    expect(addBusinessDays("2026-10-18", 1)).toBe("2026-10-19"); // Sunday
    expect(addBusinessDays("2026-10-17", 5)).toBe("2026-10-23");
  });
  it("does not count the submission day itself", () => {
    expect(addBusinessDays("2026-10-14", 5)).toBe("2026-10-21"); // Wed -> next Wed
  });
  it("handles multi-week spans and month ends", () => {
    expect(addBusinessDays("2026-10-16", 5)).toBe("2026-10-23");
    expect(addBusinessDays("2026-10-16", 7)).toBe("2026-10-27");
    expect(addBusinessDays("2026-10-16", 15)).toBe("2026-11-06");
    expect(addBusinessDays("2026-12-31", 1)).toBe("2027-01-01");
  });
});
