import { describe, expect, it } from "vitest";
import { demoProjects } from "@/components/cp/deploy-data";
import { defaultProjectSettings, projectSettingsStore, validateProjectSettings } from "@/components/cp/project-settings-data";

const project = demoProjects[0];
if (!project) throw new Error("Missing sample project");

describe("per-project settings previews", () => {
  it("loads the selected project's runtime and repository", () => {
    const settings = defaultProjectSettings(project);
    expect(settings.runtime).toBe("Node.js");
    expect(settings.repo).toBe("novhun/shop-frontend");
    expect(validateProjectSettings(settings)).toBeUndefined();
  });
  it("retains separate settings for different projects", () => {
    const other = structuredClone(projectSettingsStore.getSnapshot()[2]);
    const settings = defaultProjectSettings(project);
    settings.name = "updated-shop";
    projectSettingsStore.save(1, settings);
    settings.name = "outside-mutation";
    expect(projectSettingsStore.getSnapshot()[1]?.name).toBe("updated-shop");
    expect(projectSettingsStore.getSnapshot()[2]).toEqual(other);
  });
  it("requires unique variable names per environment", () => {
    const settings = defaultProjectSettings(project);
    settings.variables.push({ id: "preview", name: "APP_MODE", value: "demo", environment: "Preview" });
    expect(validateProjectSettings(settings)).toBeUndefined();
    settings.variables.push({ id: "duplicate", name: "APP_MODE", value: "demo", environment: "Production" });
    expect(validateProjectSettings(settings)).toContain("unique");
  });
  it("rejects invalid domain and port inputs", () => {
    const settings = defaultProjectSettings(project);
    settings.domain = "https://example.com/path";
    expect(validateProjectSettings(settings)).toContain("domain");
    settings.domain = "shop.example.com";
    settings.port = "65536";
    expect(validateProjectSettings(settings)).toContain("65535");
  });
});