import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { TunnelsWorkspace } from "@/components/cp/TunnelsWorkspace";
import { initialTunnels, tunnelDefaults, validateTunnel } from "@/components/cp/tunnel-data";
vi.mock("sonner", () => ({ toast: vi.fn() }));
afterEach(() => { cleanup(); vi.restoreAllMocks(); });
describe("Tunnel previews", () => {
  it.each(["0", "65536", "1.5"])("rejects invalid port %s", (port) => expect(validateTunnel({ ...tunnelDefaults, domain: "test.example.com", port }, [])).toBe("Local port must be between 1 and 65535."));
  it.each(["0", "601"])("rejects invalid timeout %s", (timeout) => expect(validateTunnel({ ...tunnelDefaults, domain: "test.example.com", timeout }, [])).toBe("Timeout must be between 1 and 600 seconds."));
  it("rejects duplicate hostnames case-insensitively", () => expect(validateTunnel({ ...tunnelDefaults, domain: "APP.CROSSPANEL.DEV" }, initialTunnels)).toBe("This domain already has a tunnel."));
  it("rejects a URL as the local host", () => expect(validateTunnel({ ...tunnelDefaults, domain: "test.example.com", host: "https://user:pass@host/" }, [])).toBe("Enter a hostname or IP address without a URL or path."));
  it("keeps edits isolated and resets status on provider change without network calls", () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    render(<TunnelsWorkspace />);
    const card = within(screen.getByRole("article", { name: "app.crosspanel.dev tunnel" }));
    fireEvent.click(card.getByRole("button", { name: "Configure" }));
    fireEvent.change(screen.getByLabelText("Provider"), { target: { value: "Ngrok" } });
    fireEvent.change(screen.getByLabelText("Local port"), { target: { value: "8080" } });
    fireEvent.click(screen.getByRole("button", { name: "Save Changes" }));
    expect(card.getByRole("button", { name: "Start" })).toBeDisabled();
    expect(screen.getByRole("article", { name: "app.crosspanel.dev tunnel" })).toHaveTextContent("localhost:8080");
    expect(screen.getByRole("article", { name: "api.crosspanel.dev tunnel" })).toHaveTextContent("localhost:3000");
    expect(fetchSpy).not.toHaveBeenCalled();
  });
  it("combines provider and status filters", () => {
    render(<TunnelsWorkspace />);
    fireEvent.change(screen.getByLabelText("Tunnel provider filter"), { target: { value: "Ngrok" } });
    fireEvent.change(screen.getByLabelText("Tunnel status filter"), { target: { value: "Offline" } });
    expect(screen.getAllByRole("article")).toHaveLength(1);
  });
});