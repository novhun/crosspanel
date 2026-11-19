import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AutomationWorkspace } from "@/components/cp/AutomationWorkspace";
import { newAutomationTask, validateAutomationTask } from "@/components/cp/automation-data";
vi.mock("sonner", () => ({ toast: vi.fn() }));
afterEach(() => { cleanup(); vi.restoreAllMocks(); });
const tab = (name: string) => fireEvent.mouseDown(screen.getByRole("tab", { name }), { button: 0, ctrlKey: false });
describe("Automation task previews", () => {
  it.each(["shutdown", "init 0", "mkfs", "passwd", "chpasswd", "--stdin", "mkfs.ext", "mke2fs"])("rejects prohibited command %s", (content) => {
    expect(validateAutomationTask({ ...newAutomationTask("Shell Script"), name: "Task", content })).toBe(`Remove the prohibited command: ${content}.`);
  });
  it.each(["0", "1441"])("rejects invalid timeout %s", (timeout) => expect(validateAutomationTask({ ...newAutomationTask(), name: "Task", timeout })).toBe("Timeout must be between 1 and 1440 minutes."));
  it("rejects more than five retries", () => expect(validateAutomationTask({ ...newAutomationTask(), name: "Task", retries: "6" })).toBe("Retries must be between 0 and 5."));
  it("saves isolated task definitions and retains them across views", () => {
    render(<AutomationWorkspace />);
    fireEvent.click(within(screen.getByRole("article", { name: "shop-frontend task" })).getByRole("button", { name: "Edit" }));
    fireEvent.change(screen.getByLabelText("Branch"), { target: { value: "release" } });
    tab("Definition");
    fireEvent.change(screen.getByLabelText("Task definition"), { target: { value: "// isolated preview" } });
    fireEvent.click(screen.getByRole("button", { name: "Save Task" }));
    expect(screen.getByRole("article", { name: "shop-frontend task" })).toHaveTextContent("release");
    expect(screen.getByRole("article", { name: "api-core task" })).toHaveTextContent("main");
    tab("Playbooks");
    tab("Pipelines");
    fireEvent.click(within(screen.getByRole("article", { name: "shop-frontend task" })).getByRole("button", { name: "Edit" }));
    tab("Definition");
    expect(screen.getByLabelText("Task definition")).toHaveValue("// isolated preview");
  });
  it("records a simulated run without sending network requests", () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    render(<AutomationWorkspace />);
    fireEvent.click(within(screen.getByRole("article", { name: "shop-frontend task" })).getByRole("button", { name: "Build Now" }));
    fireEvent.click(screen.getByRole("button", { name: "Run Preview" }));
    expect(screen.getByRole("dialog")).toHaveTextContent("Simulated success");
    expect(fetchSpy).not.toHaveBeenCalled();
  });
  it("prevents running disabled tasks", () => {
    render(<AutomationWorkspace />);
    expect(within(screen.getByRole("article", { name: "Clear application cache task" })).getByRole("button", { name: "Run" })).toBeDisabled();
  });
});