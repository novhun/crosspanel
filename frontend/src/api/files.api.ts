import { apiClient } from "./client";
import type {
  FileActionResponse,
  FileListResponse,
  FileReadResponse,
  TrashListResponse,
} from "@/types/files.types";

const BASE_URL = (import.meta.env["VITE_API_URL"] as string) || "/api";

export const filesApi = {
  list: (path = "") =>
    apiClient.get<FileListResponse>(`/files/list?path=${encodeURIComponent(path)}`),

  read: (path: string) =>
    apiClient.get<FileReadResponse>(`/files/read?path=${encodeURIComponent(path)}`),

  write: (path: string, content: string, createOnly = false) =>
    apiClient.post<FileActionResponse>("/files/write", {
      path,
      content,
      create_only: createOnly,
    }),

  mkdir: (path: string) =>
    apiClient.post<FileActionResponse>("/files/mkdir", { path }),

  rename: (oldPath: string, newPath: string) =>
    apiClient.post<FileActionResponse>("/files/rename", {
      old_path: oldPath,
      new_path: newPath,
    }),

  copy: (sourcePaths: string[], destinationDir: string) =>
    apiClient.post<FileActionResponse>("/files/copy", {
      source_paths: sourcePaths,
      destination_dir: destinationDir,
    }),

  move: (sourcePaths: string[], destinationDir: string) =>
    apiClient.post<FileActionResponse>("/files/move", {
      source_paths: sourcePaths,
      destination_dir: destinationDir,
    }),

  remove: (paths: string[], permanent = false) =>
    apiClient.post<FileActionResponse>("/files/delete", {
      ...(paths.length === 1 && paths[0] ? { path: paths[0] } : {}),
      paths,
      permanent,
    }),

  moveToTrash: (paths: string[]) =>
    apiClient.post<FileActionResponse>("/files/trash/move", { paths }),

  listTrash: () => apiClient.get<TrashListResponse>("/files/trash"),

  restoreTrash: (trashIds: string[]) =>
    apiClient.post<FileActionResponse>("/files/trash/restore", { trash_ids: trashIds }),

  deleteTrash: (trashIds: string[]) =>
    apiClient.post<FileActionResponse>("/files/trash/delete", { trash_ids: trashIds }),

  emptyTrash: () => apiClient.post<FileActionResponse>("/files/trash/empty"),

  zip: (sourcePath: string, targetZip: string) =>
    apiClient.post<FileActionResponse>("/files/zip", {
      source_path: sourcePath,
      target_zip: targetZip,
    }),

  unzip: (zipPath: string, extractTo: string) =>
    apiClient.post<FileActionResponse>("/files/unzip", {
      zip_path: zipPath,
      extract_to: extractTo,
    }),

  chmod: (path: string, mode: string) =>
    apiClient.post<FileActionResponse>("/files/chmod", { path, mode }),

  upload: async (targetDir: string, files: File[]): Promise<FileActionResponse> => {
    const formData = new FormData();
    formData.append("target_dir", targetDir);
    for (const file of files) {
      formData.append("files", file);
    }
    const token = typeof window !== "undefined" ? localStorage.getItem("cp_token") : null;
    const response = await fetch(`${BASE_URL}/files/upload`, {
      method: "POST",
      ...(token ? { headers: { Authorization: `Bearer ${token}` } } : {}),
      body: formData,
    });
    if (!response.ok) {
      let detail = response.statusText || "Upload failed";
      try {
        const body = (await response.json()) as { detail?: string };
        if (body?.detail) detail = body.detail;
      } catch {
        // ignore JSON parse error
      }
      throw new Error(detail);
    }
    return (await response.json()) as FileActionResponse;
  },

  downloadUrl: (path: string) =>
    `${BASE_URL}/files/download?path=${encodeURIComponent(path)}`,

  viewUrl: (path: string) =>
    `${BASE_URL}/files/view?path=${encodeURIComponent(path)}`,
};
