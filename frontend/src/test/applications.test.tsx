import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { toast } from "sonner";
import { ApplicationsWorkspace } from "@/components/cp/ApplicationsWorkspace";

vi.mock("sonner", () => ({ toast: vi.fn() }));
afterEach(() => { cleanup(); vi.clearAllMocks(); });

describe("Applications previews", () => {
  it("intersects application search with category selection", () => {
    render(<ApplicationsWorkspace />);
    fireEvent.change(screen.getByLabelText("Application category"), { target: { value: "Python" } });
    fireEvent.change(screen.getByLabelText("Search applications"), { target: { value: "fast" } });
    expect(screen.getByRole("heading", { name: "FastAPI" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Django" })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "WordPress" })).not.toBeInTheDocument();
  });
  it("retains stopped preview state across tab navigation", () => {
    render(<ApplicationsWorkspace />);
    fireEvent.click(screen.getByRole("tab", { name: /Installed/ }));
    fireEvent.click(screen.getByRole("button", { name: "Stop wordpress-site" }));
    fireEvent.click(screen.getByRole("tab", { name: "App Library" }));
    fireEvent.click(screen.getByRole("tab", { name: /Installed/ }));
    expect(screen.getByRole("button", { name: "Start wordpress-site" })).toBeInTheDocument();
    expect(toast).toHaveBeenCalledWith("Demo stop: wordpress-site", expect.any(Object));
  });
  it("submits a source as a preview without calling fetch", () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    render(<ApplicationsWorkspace />);
    fireEvent.click(screen.getByRole("tab", { name: "Custom Sources" }));
    fireEvent.change(screen.getByLabelText("Custom source"), { target: { value: "nginx:alpine" } });
    fireEvent.click(screen.getByRole("button", { name: "Preview deployment" }));
    expect(toast).toHaveBeenCalledWith("Demo source deployment from Docker Hub", expect.any(Object));
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });
});