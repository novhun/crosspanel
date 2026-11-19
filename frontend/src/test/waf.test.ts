import { expect, it } from "vitest";
import { supportsWaf } from "@/components/cp/waf-data";
it("supports only Nginx for WAF", () => {
  expect(supportsWaf("Nginx")).toBe(true);
  expect(supportsWaf("Apache")).toBe(false);
  expect(supportsWaf("Caddy")).toBe(false);
});