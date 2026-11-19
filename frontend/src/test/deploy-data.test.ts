import { describe, expect, it } from "vitest";
import { demoProjects, runtimes, projectStats, filterProjects, statusTone, versionsFor } from "@/components/cp/deploy-data";

describe("deploy-data", () => {
  it("counts project statuses", () => {
    const stats = projectStats(demoProjects);
    expect(stats.total).toBe(4);
    expect(stats.ready).toBe(2);
    expect(stats.building).toBe(1);
    expect(stats.failed).toBe(1);
  });

  it("filters projects by status and query", () => {
    expect(filterProjects(demoProjects, "", "Failed").map((p) => p.name)).toEqual(["legacy-crm"]);
    expect(filterProjects(demoProjects, "api", "All").map((p) => p.name)).toEqual(["api-server"]);
    expect(filterProjects(demoProjects, "api", "Ready")).toEqual([]);
  });

  it("maps statuses to tones", () => {
    expect(statusTone("Ready")).toBe("success");
    expect(statusTone("Building")).toBe("warning");
    expect(statusTone("Failed")).toBe("danger");
  });

  it("lists versions for each runtime and falls back to empty", () => {
    expect(versionsFor("Node.js")).toEqual(["18", "20", "22"]);
    expect(versionsFor("Docker")).toEqual(["latest"]);
    expect(versionsFor("Unknown")).toEqual([]);
  });

  it("offers hosting runtimes for common stacks", () => {
    const names = runtimes.map((r) => r.name);
    for (const expected of ["Node.js", "Python", "PHP", "Go", "Java", "Ruby", "Static site", "Docker"]) {
      expect(names).toContain(expected);
    }
  });
});
