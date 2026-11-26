export interface OsFileItem {
  name: string;
  path: string;
  is_dir: boolean;
  size: number;
  modified: string;
  permissions: string;
  owner?: string;
  is_symlink?: boolean;
}

export interface OsPlaceItem {
  name: string;
  path: string;
}

export interface FileListResponse {
  current_path: string;
  parent_path: string | null;
  places?: OsPlaceItem[];
  trash_count?: number;
  items: OsFileItem[];
}

export interface OsTrashItem {
  trash_id: string;
  name: string;
  original_path: string;
  deleted_at: string;
  is_dir: boolean;
  size: number;
  permissions: string;
  owner: string;
}

export interface TrashListResponse {
  trash_path: string;
  items: OsTrashItem[];
}

export interface FileReadResponse {
  path: string;
  content: string;
}

export interface FileActionResponse {
  success: boolean;
  message: string;
  path?: string;
  count?: number;
  files?: string[];
}
