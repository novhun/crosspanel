export const prohibitedCommands = ["shutdown", "init 0", "mkfs", "passwd", "chpasswd", "--stdin", "mkfs.ext", "mke2fs"];
export const cycles = ["Daily", "Hourly", "Weekly", "Monthly"] as const;
export type Cycle = typeof cycles[number];
export type CronTask = { id: number; name: string; type: "Shell Script"; cycle: Cycle; times: string[]; day: string; user: string; timezone: string; script: string; enabled: boolean };
export const newTask = (): CronTask => ({ id: 0, name: "", type: "Shell Script", cycle: "Daily", times: ["01:30"], day: "1", user: "root", timezone: "UTC", script: "", enabled: true });
export const initialTasks: CronTask[] = [
  { ...newTask(), id: 1, name: "Daily backup", times: ["02:00"], timezone: "Asia/Phnom_Penh", script: "/usr/local/bin/backup.sh" },
  { ...newTask(), id: 2, name: "Clear cache", cycle: "Hourly", times: ["00:00", "00:30"], script: "php /var/www/app/artisan cache:clear" },
  { ...newTask(), id: 3, name: "Weekly cleanup", cycle: "Weekly", day: "0", times: ["00:00"], enabled: false, script: "/usr/local/bin/cleanup.sh" },
];
export function unsafeCommand(script: string) {
  return [...prohibitedCommands].sort((a, b) => b.length - a.length).find(command => {
    const pattern = command === "init 0" ? "init\\s+0" : command.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return new RegExp(`(^|[^a-zA-Z0-9_])${pattern}($|[^a-zA-Z0-9_])`, "i").test(script);
  });
}
export function validateTask(task: CronTask): string | undefined {
  if (!task.name.trim() || !task.script.trim() || !task.user.trim()) return "Enter a task name, execute user and script content.";
  const blocked = unsafeCommand(task.script);
  if (blocked) return `Remove the prohibited command: ${blocked}.`;
  if (!cycles.includes(task.cycle) || task.times.length < 1 || task.times.some(time => !/^([01]\d|2[0-3]):[0-5]\d$/.test(time))) return "Choose a valid execution cycle and time.";
  if (new Set(task.times).size !== task.times.length) return "Execution times must be different.";
  if (task.cycle === "Weekly" && !/^[0-6]$/.test(task.day)) return "Choose a valid weekday.";
  if (task.cycle === "Monthly" && !/^([1-9]|[12]\d|3[01])$/.test(task.day)) return "Choose a day from 1 to 31.";
  return undefined;
}
export function scheduleLabel(task: CronTask) {
  const time = task.cycle === "Hourly" ? task.times.map(t => `:${t.slice(3)}`).join(", ") : task.times.join(", ");
  const day = task.cycle === "Weekly" ? ` (${["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][Number(task.day)]})` : task.cycle === "Monthly" ? ` (day ${task.day})` : "";
  return `${task.cycle}${day} at ${time}`;
}
export function parseTaskImport(text: string): CronTask[] {
  const data: unknown = JSON.parse(text);
  if (!data || typeof data !== "object" || !("tasks" in data) || !Array.isArray(data.tasks)) throw new Error("Choose a CrossPanel task export JSON file.");
  return data.tasks.map((value: unknown, index: number) => {
    if (!value || typeof value !== "object") throw new Error("Invalid task record.");
    const row = value as Record<string, unknown>;
    if (["name", "cycle", "day", "user", "timezone", "script"].some(key => typeof row[key] !== "string") || row['type'] !== "Shell Script" || typeof row['enabled'] !== "boolean" || !Array.isArray(row['times']) || row['times'].some(t => typeof t !== "string")) throw new Error("Invalid task record.");
    const task = { ...row, id: Date.now() + index } as CronTask;
    const error = validateTask(task);
    if (error) throw new Error(error);
    return task;
  });
}