import { describe, expect, it } from "vitest";
import { loginPathError, passwordPreviewError } from "@/components/cp/settings-security";
describe("Security preview form validation", () => {
  it("requires matching new passwords", () => {
    expect(passwordPreviewError("old-sample", "new-sample", "other-sample")).not.toBe("");
    expect(passwordPreviewError("old-sample", "new-sample", "new-sample")).toBe("");
  });
  it("requires all fields and a different new password", () => {
    expect(passwordPreviewError("", "new-sample", "new-sample")).not.toBe("");
    expect(passwordPreviewError("old-sample", "old-sample", "old-sample")).not.toBe("");
  });
  it("accepts local login paths only", () => {
    expect(loginPathError("/admin-login")).toBe("");
    expect(loginPathError("/admin/sign_in")).toBe("");
    for (const path of ["https://example.com/login", "//example.com", "/", "/../login", "/login?token=x", "/login path"]) expect(loginPathError(path)).not.toBe("");
  });
});