import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { WebsiteWorkspace } from "@/components/cp/WebsiteWorkspace";

vi.mock("sonner", () => ({ toast: vi.fn() }));
vi.mock("@tanstack/react-router", () => ({ Link: ({ children }: { children: React.ReactNode }) => <span>{children}</span> }));
vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} });
afterEach(cleanup);

describe("Website preview settings", () => {
  it("saves optional env and database previews only for the selected website", () => {
    render(<WebsiteWorkspace />);
    const first = screen.getAllByRole("button", { name: "Settings" }).at(0);
    if (!first) throw new Error("Website missing");
    fireEvent.click(first);
    fireEvent.click(screen.getByRole("tab", { name: "Environment" }));
    fireEvent.click(screen.getByRole("switch", { name: "Use .env file" }));
    fireEvent.change(screen.getByLabelText("Environment file"), { target: { value: "APP_ENV=preview" } });
    fireEvent.click(screen.getByRole("tab", { name: "Database" }));
    fireEvent.change(screen.getByLabelText("Linked database"), { target: { value: "app_data · PostgreSQL" } });
    fireEvent.click(screen.getByRole("button", { name: "Save Changes" }));
    const cards = screen.getAllByRole("article");
    expect(cards.at(0)).toHaveTextContent("Database: app_data · PostgreSQL");
    expect(cards.at(1)).toHaveTextContent("Database: None");
    const settings = screen.getAllByRole("button", { name: "Settings" }).at(0);
    if (!settings) throw new Error("Website missing");
    fireEvent.click(settings);
    fireEvent.click(screen.getByRole("tab", { name: "Environment" }));
    expect(screen.getByLabelText("Environment file")).toHaveValue("APP_ENV=preview");
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    const folder = screen.getAllByRole("button", { name: "Project folder" }).at(0);
    if (!folder) throw new Error("Folder button missing");
    fireEvent.click(folder);
    expect(screen.getByRole("dialog")).toHaveTextContent("/var/www/app");
    expect(screen.getByRole("dialog")).toHaveTextContent(".env");
  });
  it("keeps custom configurations isolated by engine and website", () => {
    render(<WebsiteWorkspace />);
    const openFirst = () => {
      const button = screen.getAllByRole("button", { name: "Settings" }).at(0);
      if (!button) throw new Error("Settings missing");
      fireEvent.click(button);
      fireEvent.click(screen.getByRole("tab", { name: "Server Config" }));
    };
    openFirst();
    fireEvent.change(screen.getByLabelText("Server configuration"), { target: { value: "# custom nginx for app" } });
    fireEvent.change(screen.getByLabelText("Configuration engine"), { target: { value: "Apache" } });
    const apacheConfig = screen.getByLabelText<HTMLTextAreaElement>("Server configuration");
    expect(apacheConfig.value).toContain("<VirtualHost");
    fireEvent.change(screen.getByLabelText("Server configuration"), { target: { value: "# custom apache for app" } });
    fireEvent.click(screen.getByRole("button", { name: "Save Changes" }));
    openFirst();
    expect(screen.getByLabelText("Server configuration")).toHaveValue("# custom apache for app");
    fireEvent.change(screen.getByLabelText("Configuration engine"), { target: { value: "Nginx" } });
    expect(screen.getByLabelText("Server configuration")).toHaveValue("# custom nginx for app");
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    const second = screen.getAllByRole("button", { name: "Settings" }).at(1);
    if (!second) throw new Error("Second website missing");
    fireEvent.click(second);
    fireEvent.click(screen.getByRole("tab", { name: "Server Config" }));
    expect(screen.getByLabelText("Server configuration")).not.toHaveValue("# custom nginx for app");
  });
  it("saves Proxy Projects with target and WebSocket settings without fetching", () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    render(<WebsiteWorkspace />);
    fireEvent.click(screen.getByRole("button", { name: "Add Proxy Project" }));
    fireEvent.change(screen.getByLabelText("Domain"), { target: { value: "proxy.example.com" } });
    fireEvent.click(screen.getByRole("tab", { name: "Hosting" }));
    fireEvent.change(screen.getByLabelText("Target URL"), { target: { value: "http://127.0.0.1:3000" } });
    fireEvent.change(screen.getByLabelText("Proxy path"), { target: { value: "/api" } });
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Add Proxy Project" }));
    const heading = screen.getByRole("heading", { name: "proxy.example.com" });
    const card = heading.closest("article");
    if (!card) throw new Error("Proxy preview missing");
    expect(card).toHaveTextContent("http://127.0.0.1:3000");
    expect(card).toHaveTextContent("Path: /api");
    expect(card).toHaveTextContent("WebSocket: On");
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });
  it.each(["ftp://example.com", "https://user:secret@example.com", "https://example.com/#fragment", "not a URL"])("rejects invalid proxy target %s", (target) => {
    render(<WebsiteWorkspace />);
    fireEvent.click(screen.getByRole("button", { name: "Add Proxy Project" }));
    fireEvent.change(screen.getByLabelText("Domain"), { target: { value: "proxy.example.com" } });
    fireEvent.click(screen.getByRole("tab", { name: "Hosting" }));
    fireEvent.change(screen.getByLabelText("Target URL"), { target: { value: target } });
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Add Proxy Project" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Enter an HTTP or HTTPS target URL without credentials or fragments.");
  });
  it.each([
    ["Proxy path", "api", "Proxy path must start with /"],
    ["Timeout (seconds)", "0", "Proxy timeout must be between 1 and 600 seconds."],
    ["Timeout (seconds)", "601", "Proxy timeout must be between 1 and 600 seconds."],
    ["Host header", "bad host", "Enter a hostname with an optional port for Host header."],
  ])("validates proxy %s value %s", (field, value, message) => {
    render(<WebsiteWorkspace />);
    fireEvent.click(screen.getByRole("button", { name: "Add Proxy Project" }));
    fireEvent.change(screen.getByLabelText("Domain"), { target: { value: "proxy.example.com" } });
    fireEvent.click(screen.getByRole("tab", { name: "Hosting" }));
    fireEvent.change(screen.getByLabelText("Target URL"), { target: { value: "http://127.0.0.1:3000" } });
    fireEvent.change(screen.getByLabelText(field), { target: { value } });
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Add Proxy Project" }));
    expect(screen.getByRole("alert")).toHaveTextContent(message);
  });
  it("combines status and runtime filters", () => {
    render(<WebsiteWorkspace />);
    fireEvent.change(screen.getByLabelText("Website status"), { target: { value: "Stopped" } });
    fireEvent.change(screen.getByLabelText("Website runtime"), { target: { value: "Node.js 22" } });
    expect(screen.getByRole("heading", { name: "staging.crosspanel.dev" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "app.crosspanel.dev" })).not.toBeInTheDocument();
  });
  it("rejects duplicate domains without adding a website", () => {
    render(<WebsiteWorkspace />);
    fireEvent.click(screen.getByRole("button", { name: "Add Website" }));
    fireEvent.change(screen.getByLabelText("Domain"), { target: { value: "app.crosspanel.dev" } });
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Add Website" }));
    expect(screen.getByRole("alert")).toHaveTextContent("This domain already exists.");
    expect(screen.getAllByRole("heading", { name: "app.crosspanel.dev", hidden: true })).toHaveLength(1);
  });
  it("requires an absolute document root", () => {
    render(<WebsiteWorkspace />);
    fireEvent.click(screen.getByRole("button", { name: "Add Website" }));
    fireEvent.change(screen.getByLabelText("Domain"), { target: { value: "new.example.com" } });
    fireEvent.click(screen.getByRole("tab", { name: "Hosting" }));
    fireEvent.change(screen.getByLabelText("Document root"), { target: { value: "relative/path" } });
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Add Website" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Document root must be an absolute path starting with /.");
  });
  it("disables HTTPS redirect when HTTPS is turned off", () => {
    render(<WebsiteWorkspace />);
    const settings = screen.getAllByRole("button", { name: "Settings" }).at(0);
    if (!settings) throw new Error("Website settings button missing");
    fireEvent.click(settings);
    fireEvent.click(screen.getByRole("tab", { name: "HTTPS" }));
    fireEvent.click(screen.getByRole("switch", { name: "Enable HTTPS" }));
    const redirect = screen.getByRole("switch", { name: "Redirect HTTP to HTTPS" });
    expect(redirect).toBeDisabled();
    expect(redirect).toHaveAttribute("aria-checked", "false");
  });
});