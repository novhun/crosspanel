import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DatabasesWorkspace } from "@/components/cp/DatabasesWorkspace";
import { databaseEngineDefaults, validateDatabaseEngine, validateDatabaseRecord } from "@/components/cp/database-data";
vi.mock("sonner", () => ({ toast: vi.fn() }));
afterEach(() => { cleanup(); vi.restoreAllMocks(); });
const changeTab = (name: string) => fireEvent.mouseDown(screen.getByRole("tab", { name }), { button: 0, ctrlKey: false });
describe("Database previews", () => {
  it.each(["0", "65536", "1.5"])("rejects invalid port %s", (port) => {
    const original = databaseEngineDefaults[0];
    if (!original) throw new Error("Engine missing");
    expect(validateDatabaseEngine({ ...original, port })).toBe("Port must be between 1 and 65535.");
  });
  it("requires an installed engine for a database record", () => {
    expect(validateDatabaseRecord({ name: "app", user: "app_user", engine: "MongoDB" }, databaseEngineDefaults)).toBe("Select an installed demo engine.");
  });
  it("rejects unsafe database identifiers", () => {
    expect(validateDatabaseRecord({ name: "bad; DROP DATABASE app", user: "app_user", engine: "MariaDB" }, databaseEngineDefaults)).toBeTruthy();
  });
  it("saves engine settings without changing sibling engines", () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    render(<DatabasesWorkspace />);
    const maria = within(screen.getByRole("article", { name: "MariaDB engine" }));
    fireEvent.click(maria.getByRole("button", { name: "Configure" }));
    fireEvent.change(screen.getByLabelText("Port"), { target: { value: "3307" } });
    changeTab("Config");
    fireEvent.change(screen.getByLabelText("Configuration draft"), { target: { value: "# isolated draft" } });
    fireEvent.click(screen.getByRole("button", { name: "Save Configuration" }));
    expect(screen.getByRole("article", { name: "MariaDB engine" })).toHaveTextContent("127.0.0.1:3307");
    expect(screen.getByRole("article", { name: "PostgreSQL engine" })).toHaveTextContent("127.0.0.1:5432");
    fireEvent.click(maria.getByRole("button", { name: "Configure" }));
    changeTab("Config");
    expect(screen.getByLabelText("Configuration draft")).toHaveValue("# isolated draft");
    expect(fetchSpy).not.toHaveBeenCalled();
  });
  it("requires confirmation before restoring a preview", () => {
    render(<DatabasesWorkspace />);
    changeTab("Backups");
    const restore = screen.getAllByRole("button", { name: "Restore" })[0];
    if (!restore) throw new Error("Snapshot missing");
    fireEvent.click(restore);
    expect(screen.getByRole("button", { name: "Restore preview" })).toBeDisabled();
    fireEvent.click(screen.getByLabelText("Confirm restore preview"));
    expect(screen.getByRole("button", { name: "Restore preview" })).toBeEnabled();
  });
  it("retains added database previews when switching views", () => {
    render(<DatabasesWorkspace />);
    fireEvent.click(screen.getByRole("button", { name: "Add Database" }));
    fireEvent.change(screen.getByLabelText("Database name"), { target: { value: "demo_app" } });
    fireEvent.change(screen.getByLabelText("Username"), { target: { value: "demo_user" } });
    fireEvent.click(screen.getByRole("button", { name: "Save Database" }));
    changeTab("Installation");
    changeTab("Databases");
    expect(screen.getByRole("heading", { name: "demo_app" })).toBeInTheDocument();
  });
});