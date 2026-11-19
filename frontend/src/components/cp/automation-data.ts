import { unsafeCommand } from "./cron-data";
export const automationTypes = ["Jenkins Pipeline", "Ansible Playbook", "Shell Script"] as const;
export type AutomationType = typeof automationTypes[number];
export type AutomationTask = { id: number; name: string; type: AutomationType; enabled: boolean; schedule: "Manual" | "Daily" | "Weekly"; time: string; day: string; timezone: string; target: string; branch: string; content: string; timeout: string; retries: string; notify: boolean; status: "Success" | "Running" | "Failed" | "Never run" };
export type AutomationRun = { id: number; taskId: number; name: string; type: AutomationType; status: "Success" | "Running" | "Failed" | "Canceled"; trigger: string; duration: string; time: string; output: string };
export function newAutomationTask(type: AutomationType = "Jenkins Pipeline"): AutomationTask {
  return { id: 0, name: "", type, enabled: true, schedule: "Manual", time: "01:30", day: "Monday", timezone: "UTC", target: "Local demo", branch: "main", content: type === "Jenkins Pipeline" ? "// Demo pipeline snippet\npipeline {\n  agent any\n  stages {\n    stage('Build') { steps { echo 'Preview only' } }\n  }\n}" : type === "Ansible Playbook" ? "# Demo playbook snippet\n- hosts: web\n  tasks:\n    - name: Preview message\n      debug:\n        msg: Preview only" : "# Demo script\necho 'Preview only'", timeout: "15", retries: "0", notify: true, status: "Never run" };
}
export const automationTasks: AutomationTask[] = [
  { ...newAutomationTask(), id: 1, name: "shop-frontend", target: "Production · demo", schedule: "Daily", status: "Success" },
  { ...newAutomationTask(), id: 2, name: "api-core", target: "Staging · demo", status: "Running" },
  { ...newAutomationTask(), id: 3, name: "mobile-backend", branch: "develop", status: "Failed" },
  { ...newAutomationTask("Ansible Playbook"), id: 4, name: "setup-webserver.yml", target: "Web servers · 4 sample hosts", status: "Success" },
  { ...newAutomationTask("Ansible Playbook"), id: 5, name: "harden-ssh.yml", target: "All servers · 12 sample hosts", status: "Success" },
  { ...newAutomationTask("Ansible Playbook"), id: 6, name: "deploy-docker.yml", target: "Containers · 6 sample hosts", schedule: "Weekly", status: "Success" },
  { ...newAutomationTask("Shell Script"), id: 7, name: "Clear application cache", schedule: "Daily", enabled: false },
];
export const automationRuns: AutomationRun[] = [
  { id: 142, taskId: 1, name: "shop-frontend", type: "Jenkins Pipeline", status: "Success", trigger: "Sample schedule", duration: "2m 14s", time: "Sample · Today 09:15", output: "[demo] Checkout complete\n[demo] Build complete\n[demo] Tests passed\n[demo] Sample successful result — no commands executed" },
  { id: 88, taskId: 2, name: "api-core", type: "Jenkins Pipeline", status: "Running", trigger: "Sample manual", duration: "1m 02s", time: "Sample · Today 09:20", output: "[demo] Sample build in progress\n[demo] No process running on a server" },
  { id: 51, taskId: 3, name: "mobile-backend", type: "Jenkins Pipeline", status: "Failed", trigger: "Sample manual", duration: "4m 40s", time: "Sample · Yesterday", output: "[demo] Sample test stage failed\n[demo] No real pipeline executed" },
];
export function validateAutomationTask(task: AutomationTask) {
  if (!task.name.trim() || !task.target.trim() || !task.content.trim()) return "Enter a task name, target and definition.";
  if (task.type === "Jenkins Pipeline" && !task.branch.trim()) return "Enter a pipeline branch.";
  if (task.schedule !== "Manual" && !/^([01]\d|2[0-3]):[0-5]\d$/.test(task.time)) return "Choose a valid execution time.";
  if (!/^\d+$/.test(task.timeout) || Number(task.timeout) < 1 || Number(task.timeout) > 1440) return "Timeout must be between 1 and 1440 minutes.";
  if (!/^\d+$/.test(task.retries) || Number(task.retries) > 5) return "Retries must be between 0 and 5.";
  const blocked = unsafeCommand(task.content);
  if (blocked) return `Remove the prohibited command: ${blocked}.`;
  return undefined;
}
export function automationSchedule(task: AutomationTask) {
  return task.schedule === "Manual" ? "Manual only" : `${task.schedule}${task.schedule === "Weekly" ? ` · ${task.day}` : ""} · ${task.time} · ${task.timezone}`;
}