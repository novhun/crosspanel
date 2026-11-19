import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { FilesWorkspace } from "@/components/cp/FilesWorkspace";
import { fileEntries, pasteEntries, descendants, validateEntryName, entryPath } from "@/components/cp/file-data";
vi.mock("sonner", () => ({ toast: vi.fn() }));
afterEach(() => { cleanup(); vi.restoreAllMocks(); });
describe("File explorer previews", () => {
  it.each(["../escape", "a/b", "..", " name "])("rejects invalid name %s", (name) => expect(validateEntryName(fileEntries, 4, name)).toBeTruthy());
  it("rejects duplicate siblings", () => expect(validateEntryName(fileEntries, 4, "logs")).toBe("An item with this name already exists in this folder."));
  it("prevents moving a folder inside itself", () => expect(() => pasteEntries(fileEntries, [5], 11, true)).toThrow("A folder cannot be placed inside itself."));
  it("copies nested contents with isolated identifiers", () => {
    const copied = pasteEntries(fileEntries, [5], 13, false);
    const clone = copied.find((entry) => entry.parent === 13 && entry.name === "public_html");
    if (!clone) throw new Error("Copy missing");
    expect(descendants(copied, clone.id)).toHaveLength(3);
    expect(entryPath(copied, clone.id)).toBe("/var/www/api/public_html");
    expect(fileEntries).toHaveLength(14);
  });
  it("moves a subtree and preserves child relationships", () => {
    const moved = pasteEntries(fileEntries, [5], 13, true);
    expect(entryPath(moved, 10)).toBe("/var/www/api/public_html/index.html");
  });
  it("navigates folders and saves only the selected demo file", () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    render(<FilesWorkspace />);
    fireEvent.click(screen.getByRole("button", { name: "public_html" }));
    expect(screen.getByLabelText("Folder path")).toHaveValue("/var/www/shop/public_html");
    fireEvent.click(screen.getByRole("button", { name: "index.html" }));
    fireEvent.change(screen.getByLabelText("File content"), { target: { value: "Demo edit" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    fireEvent.click(screen.getAllByRole("button", { name: "Close" })[0] as HTMLElement);
    fireEvent.click(screen.getByRole("button", { name: "index.html" }));
    expect(screen.getByLabelText("File content")).toHaveValue("Demo edit");
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});