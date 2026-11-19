export type ExplorerEntry = { id: number; parent: number | null; name: string; directory: boolean; size: string; permissions: string; owner: string; modified: string; content: string };
export const fileEntries: ExplorerEntry[] = [
  { id: 1, parent: null, name: "/", directory: true, size: "—", permissions: "755", owner: "root", modified: "Sample · Nov 19", content: "" },
  { id: 2, parent: 1, name: "var", directory: true, size: "—", permissions: "755", owner: "root", modified: "Sample · Nov 19", content: "" },
  { id: 3, parent: 2, name: "www", directory: true, size: "—", permissions: "755", owner: "root", modified: "Sample · Nov 19", content: "" },
  { id: 4, parent: 3, name: "shop", directory: true, size: "—", permissions: "755", owner: "www-data", modified: "Sample · Nov 19", content: "" },
  { id: 5, parent: 4, name: "public_html", directory: true, size: "—", permissions: "755", owner: "www-data", modified: "Sample · Nov 19", content: "" },
  { id: 6, parent: 4, name: "logs", directory: true, size: "—", permissions: "750", owner: "root", modified: "Sample · Nov 19", content: "" },
  { id: 7, parent: 4, name: "docker-compose.yml", directory: false, size: "1.2 KB", permissions: "644", owner: "root", modified: "Sample · Nov 19", content: "# Demo Compose file — never executed\nservices:\n  app:\n    image: node:22-alpine\n    ports: [\"3000:3000\"]" },
  { id: 8, parent: 4, name: ".env", directory: false, size: "312 B", permissions: "600", owner: "root", modified: "Sample · Nov 18", content: "# Demo values only — never paste credentials\nAPP_ENV=preview\nAPP_NAME=CrossPanel\nDB_HOST=localhost" },
  { id: 9, parent: 4, name: "backup-2026-11.zip", directory: false, size: "84 MB", permissions: "644", owner: "root", modified: "Sample · Nov 18", content: "" },
  { id: 10, parent: 5, name: "index.html", directory: false, size: "2.4 KB", permissions: "644", owner: "www-data", modified: "Sample · Nov 19", content: "<!-- Demo page -->\n<h1>Shop preview</h1>" },
  { id: 11, parent: 5, name: "assets", directory: true, size: "—", permissions: "755", owner: "www-data", modified: "Sample · Nov 18", content: "" },
  { id: 12, parent: 6, name: "access.log", directory: false, size: "14 KB", permissions: "640", owner: "root", modified: "Sample · Nov 19", content: "[demo] GET / 200\n[demo] GET /assets 200\nNo real requests collected." },
  { id: 13, parent: 3, name: "api", directory: true, size: "—", permissions: "755", owner: "www-data", modified: "Sample · Nov 18", content: "" },
  { id: 14, parent: 13, name: "package.json", directory: false, size: "540 B", permissions: "644", owner: "www-data", modified: "Sample · Nov 18", content: '{\n  "name": "demo-api",\n  "version": "1.0.0"\n}' },
];
export function entryPath(entries: ExplorerEntry[], id: number): string {
  const entry = entries.find((item) => item.id === id);
  if (!entry || entry.parent === null) return "/";
  return `${entryPath(entries, entry.parent).replace(/\/$/, "")}/${entry.name}`;
}
export function descendants(entries: ExplorerEntry[], id: number): number[] {
  return [id, ...entries.filter((entry) => entry.parent === id).flatMap((entry) => descendants(entries, entry.id))];
}
export function validateEntryName(entries: ExplorerEntry[], parent: number, name: string, exclude?: number) {
  if (!name.trim() || name !== name.trim() || name === "." || name === ".." || /[/\\\u0000-\u001f]/.test(name)) return "Enter a name without paths, control characters or surrounding spaces.";
  if (entries.some((entry) => entry.parent === parent && entry.name === name && entry.id !== exclude)) return "An item with this name already exists in this folder.";
  return undefined;
}
export function pasteEntries(entries: ExplorerEntry[], ids: number[], destination: number, move: boolean): ExplorerEntry[] {
  if (!entries.some((entry) => entry.id === destination && entry.directory)) throw new Error("Choose a destination folder.");
  const roots = ids.filter((id) => !ids.some((other) => other !== id && descendants(entries, other).includes(id)));
  let result = [...entries];
  let nextId = Math.max(0, ...entries.map((entry) => entry.id)) + 1;
  for (const id of roots) {
    const entry = entries.find((item) => item.id === id);
    if (!entry || entry.parent === null) throw new Error("The root folder cannot be copied or moved.");
    if (descendants(entries, id).includes(destination)) throw new Error("A folder cannot be placed inside itself.");
    const issue = validateEntryName(result, destination, entry.name, move ? id : undefined);
    if (issue) throw new Error(issue);
    if (move) result = result.map((item) => item.id === id ? { ...item, parent: destination, modified: "Just now · preview" } : item);
    else {
      const clone = (source: ExplorerEntry, parent: number) => {
        const newId = nextId++;
        result.push({ ...source, id: newId, parent, modified: "Just now · preview" });
        entries.filter((item) => item.parent === source.id).forEach((child) => clone(child, newId));
      };
      clone(entry, destination);
    }
  }
  return result;
}