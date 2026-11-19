import { expect, it } from "vitest";
import { accountResources, canAddSubAccount, initialSubAccounts, PRO_SUB_ACCOUNT_LIMIT, quotaError } from "@/components/cp/sub-account-data";
it("caps Pro at 100 sub-accounts", () => {
  expect(PRO_SUB_ACCOUNT_LIMIT).toBe(100);
  expect(canAddSubAccount(99)).toBe(true);
  expect(canAddSubAccount(100)).toBe(false);
  expect(canAddSubAccount(101)).toBe(false);
});
it("shows only resources allocated to the sub-account", () => {
  const account = initialSubAccounts[0];
  if (!account) throw new Error("Missing sample account");
  expect(accountResources(account).map(resource => resource.name)).toEqual(["app.crosspanel.dev", "app_core"]);
});
it("rejects quota below usage or allocated resource counts", () => {
  const account = initialSubAccounts[0];
  if (!account) throw new Error("Missing sample account");
  expect(quotaError(account)).toBe("");
  expect(quotaError({ ...account, disk: 1 })).not.toBe("");
  expect(quotaError({ ...account, sites: 0 })).not.toBe("");
});