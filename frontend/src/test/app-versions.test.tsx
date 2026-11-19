import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { toast } from "sonner";
import { AppVersionActions } from "@/components/cp/AppVersionActions";

vi.mock("sonner", () => ({ toast: vi.fn() }));
afterEach(() => { cleanup(); vi.clearAllMocks(); });

describe("App version selection", () => {
  it("downloads the chosen version instead of the default", () => {
    render(<AppVersionActions name="WordPress" versions={["6.6", "6.5", "6.4"]} />);
    fireEvent.change(screen.getByLabelText("WordPress version"), { target: { value: "6.4" } });
    fireEvent.click(screen.getByRole("button", { name: "Download" }));
    expect(toast).toHaveBeenCalledWith("Demo download: WordPress 6.4", expect.any(Object));
  });
  it("installs the chosen version instead of the default", () => {
    render(<AppVersionActions name="WordPress" versions={["6.6", "6.5"]} />);
    fireEvent.change(screen.getByLabelText("WordPress version"), { target: { value: "6.5" } });
    fireEvent.click(screen.getByRole("button", { name: "Install" }));
    expect(toast).toHaveBeenCalledWith("Demo install: WordPress 6.5", expect.any(Object));
  });
  it("accepts a custom version before installation", () => {
    render(<AppVersionActions name="Node.js" versions={["22 LTS"]} />);
    fireEvent.change(screen.getByLabelText("Node.js version"), { target: { value: "custom" } });
    expect(screen.getByRole("button", { name: "Install" })).toBeDisabled();
    fireEvent.change(screen.getByLabelText("Node.js custom version"), { target: { value: "24.1.0" } });
    fireEvent.click(screen.getByRole("button", { name: "Install" }));
    expect(toast).toHaveBeenCalledWith("Demo install: Node.js 24.1.0", expect.any(Object));
  });
});