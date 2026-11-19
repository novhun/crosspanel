import { describe, expect, it } from "vitest";
import { newTask, parseTaskImport, scheduleLabel, unsafeCommand, validateTask } from "@/components/cp/cron-data";

describe("Cron scheduling preview", () => {
  it.each(["shutdown", "init 0", "mkfs", "passwd", "chpasswd", "--stdin", "mkfs.ext", "mke2fs"])("rejects prohibited script command %s", command => {
    expect(validateTask({ ...newTask(), name: "Unsafe", script: command })).toContain(command);
  });
  it("defaults to Daily at 01:30 with root", () => {
    expect(scheduleLabel(newTask())).toBe("Daily at 01:30");
    expect(newTask().user).toBe("root");
  });
  it("keeps multiple execution times", () => {
    expect(scheduleLabel({ ...newTask(), times: ["01:30", "13:30"] })).toBe("Daily at 01:30, 13:30");
  });
  it("accepts safe shell content", () => {
    expect(unsafeCommand("echo 'backup ready'\n/usr/local/bin/backup.sh")).toBeUndefined();
  });
  it("round-trips task exports without executing anything", () => {
    const task = { ...newTask(), name: "Backup", script: "echo ready" };
    expect(parseTaskImport(JSON.stringify({ demo: true, tasks: [task] }))[0]).toMatchObject({ name: "Backup", script: "echo ready", times: ["01:30"] });
  });
  it("rejects unsafe imports", () => {
    expect(() => parseTaskImport(JSON.stringify({ tasks: [{ ...newTask(), name: "Bad", script: "shutdown -h now" }] }))).toThrow("shutdown");
  });
});