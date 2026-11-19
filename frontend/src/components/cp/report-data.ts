export type NetworkScope = "All" | "eth0" | "lo";
export const demoDisks = [
  { name: "/", device: "/dev/sda1", used: 38.4, capacity: 100 },
  { name: "/data", device: "/dev/sdb1", used: 86.2, capacity: 250 },
];
export function reportPoint(scope: NetworkScope, tick: number) {
  const factor = scope === "eth0" ? 0.96 : 1;
  return {
    tick,
    upstream: scope === "lo" ? 0.08 : 2.19 * (1 + Math.sin(tick * 0.8) * 0.35) * factor,
    downstream: scope === "lo" ? 0.08 : 1.79 * (1 + Math.sin(tick * 0.6) * 0.4) * factor,
    sent: scope === "lo" ? 0.04 : scope === "eth0" ? 1.56 : 1.60,
    received: scope === "lo" ? 0.04 : scope === "eth0" ? 1.05 : 1.09,
    read: 4.8 + Math.sin(tick * 0.7) * 2.4,
    write: 1.2 + Math.sin(tick * 0.4) * 0.7,
  };
}