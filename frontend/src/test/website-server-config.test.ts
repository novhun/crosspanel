import { describe, expect, it } from "vitest";
import { serverConfigPreview, validServerPort } from "@/components/cp/website-server-config";

const site = { domain: "example.com", root: "/var/www/example", index: "index.html", engine: "Nginx", projectType: "Website", target: "http://127.0.0.1:3000", proxyPath: "/api", port: "8080" };
describe("Website server configuration", () => {
  it.each(["Nginx", "Apache"])("generates a site-specific %s proxy preview", (engine) => {
    const config = serverConfigPreview({ ...site, engine, projectType: "Proxy Project" });
    expect(config).toContain("http://127.0.0.1:3000");
    expect(config).toContain("/api");
    expect(config).toContain("example.com");
    expect(config).toContain("8080");
    expect(config).not.toContain("DocumentRoot");
  });
  it.each([["1", true], ["65535", true], ["0", false], ["65536", false], ["80.5", false]])("validates listen port %s", (port, valid) => {
    expect(validServerPort(port as string)).toBe(valid);
  });
});