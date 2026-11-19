import { describe, expect, it } from "vitest";
import { reportPoint } from "@/components/cp/report-data";

describe("Dashboard network report demo values", () => {
  it("starts upstream at 2.19 KB per second", () => {
    expect(reportPoint("All", 0).upstream).toBe(2.19);
  });
  it("starts downstream at 1.79 KB per second", () => {
    expect(reportPoint("All", 0).downstream).toBe(1.79);
  });
  it("shows total sent of 1.60 GB", () => {
    expect(reportPoint("All", 0).sent).toBe(1.60);
  });
  it("shows total received of 1.09 GB", () => {
    expect(reportPoint("All", 0).received).toBe(1.09);
  });
});