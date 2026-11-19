import { describe, expect, it } from "vitest";
import { filterLogs, sampleLogs } from "@/components/cp/log-data";
describe("Log filtering", () => {
  it("isolates system events", () => {
    expect(filterLogs(sampleLogs, "System", "All", "All", "").map(entry => entry.id)).toEqual([1, 4, 8]);
  });
  it("isolates a service source", () => {
    expect(filterLogs(sampleLogs, "Service", "MariaDB", "All", "").map(entry => entry.id)).toEqual([5]);
  });
  it("combines website source, severity and search", () => {
    expect(filterLogs(sampleLogs, "Website", "blog.crosspanel.dev", "Error", "502").map(entry => entry.id)).toEqual([6]);
    expect(filterLogs(sampleLogs, "Website", "blog.crosspanel.dev", "Info", "502")).toEqual([]);
  });
});