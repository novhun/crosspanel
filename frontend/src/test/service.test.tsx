import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ServiceWorkspace } from "@/components/cp/ServiceWorkspace";

vi.mock("sonner", () => ({ toast: vi.fn() }));
afterEach(() => { cleanup(); vi.restoreAllMocks(); });
const card = (name: string) => within(screen.getByRole("article", { name: `${name} service`, hidden: true }));
const openConfiguration = () => fireEvent.mouseDown(screen.getByRole("tab", { name: "Configuration" }), { button: 0, ctrlKey: false });

describe("Service previews", () => {
  it("confirms stopping and starts only the selected service without network calls", () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    render(<ServiceWorkspace />);
    fireEvent.click(card("Nginx").getByRole("button", { name: "Stop" }));
    expect(card("Nginx").getByRole("button", { name: "Restart", hidden: true })).toBeEnabled();
    fireEvent.click(screen.getByRole("button", { name: "Stop preview" }));
    expect(card("Nginx").getByRole("button", { name: "Restart" })).toBeDisabled();
    expect(card("PHP-FPM").getByRole("button", { name: "Restart" })).toBeEnabled();
    fireEvent.click(card("Nginx").getByRole("button", { name: "Start" }));
    expect(card("Nginx").getByRole("button", { name: "Restart" })).toBeEnabled();
    expect(fetchSpy).not.toHaveBeenCalled();
  });
  it("saves settings only for the selected service and discards canceled drafts", () => {
    render(<ServiceWorkspace />);
    fireEvent.click(card("Nginx").getByRole("button", { name: "Settings" }));
    fireEvent.change(screen.getByLabelText("Port / endpoint"), { target: { value: "8080" } });
    openConfiguration();
    fireEvent.change(screen.getByLabelText("Configuration draft"), { target: { value: "# local nginx preview" } });
    fireEvent.click(screen.getByRole("button", { name: "Save Changes" }));
    fireEvent.click(card("Nginx").getByRole("button", { name: "Settings" }));
    expect(screen.getByLabelText("Port / endpoint")).toHaveValue("8080");
    openConfiguration();
    expect(screen.getByLabelText("Configuration draft")).toHaveValue("# local nginx preview");
    fireEvent.change(screen.getByLabelText("Configuration draft"), { target: { value: "# canceled" } });
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    fireEvent.click(card("PHP-FPM").getByRole("button", { name: "Settings" }));
    expect(screen.getByLabelText("Port / endpoint")).toHaveValue("9000");
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    fireEvent.click(card("Nginx").getByRole("button", { name: "Settings" }));
    openConfiguration();
    expect(screen.getByLabelText("Configuration draft")).toHaveValue("# local nginx preview");
  });
  it("combines status, category and search filters", () => {
    render(<ServiceWorkspace />);
    fireEvent.change(screen.getByLabelText("Filter service status"), { target: { value: "Stopped" } });
    fireEvent.change(screen.getByLabelText("Service category"), { target: { value: "Cache" } });
    fireEvent.change(screen.getByLabelText("Search services"), { target: { value: "redis" } });
    expect(screen.getAllByRole("article")).toHaveLength(1);
    expect(screen.getByRole("article", { name: "Redis service" })).toBeInTheDocument();
  });
});