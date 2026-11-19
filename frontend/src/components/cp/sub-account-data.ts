export const PRO_SUB_ACCOUNT_LIMIT = 100;
export function canAddSubAccount(count: number) { return count < PRO_SUB_ACCOUNT_LIMIT; }
export type SubAccount = {
  id: number; name: string; email: string; enabled: boolean;
  disk: number; traffic: number; sites: number; databases: number;
  usedDisk: number; usedTraffic: number; resources: string[];
};
export const initialSubAccounts: SubAccount[] = [
  { id: 1, name: "Website Team", email: "web@example.com", enabled: true, disk: 20, traffic: 100, sites: 5, databases: 3, usedDisk: 6.4, usedTraffic: 24.8, resources: ["app.crosspanel.dev", "app_core"] },
  { id: 2, name: "Blog Editor", email: "blog@example.com", enabled: true, disk: 10, traffic: 50, sites: 2, databases: 2, usedDisk: 3.2, usedTraffic: 12.5, resources: ["blog.crosspanel.dev", "wp_production"] },
  { id: 3, name: "Staging Team", email: "staging@example.com", enabled: false, disk: 15, traffic: 75, sites: 3, databases: 2, usedDisk: 1.8, usedTraffic: 4.2, resources: ["staging.crosspanel.dev", "staging_db"] },
];
export const availableResources = [
  { name: "app.crosspanel.dev", type: "Website" }, { name: "blog.crosspanel.dev", type: "Website" }, { name: "staging.crosspanel.dev", type: "Website" },
  { name: "app_core", type: "Database" }, { name: "wp_production", type: "Database" }, { name: "staging_db", type: "Database" },
];
export function accountResources(account: SubAccount) { return availableResources.filter(resource => account.resources.includes(resource.name)); }
export function quotaError(account: SubAccount) {
  if (account.disk < account.usedDisk || account.traffic < account.usedTraffic) return "Quota cannot be lower than sample usage.";
  const resources = accountResources(account);
  if (resources.filter(r => r.type === "Website").length > account.sites || resources.filter(r => r.type === "Database").length > account.databases) return "Allocated resources exceed the website or database quota.";
  return "";
}