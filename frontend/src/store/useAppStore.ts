import { useState, useEffect } from 'react';

export type PageId =
  | 'dashboard'
  | 'services'
  | 'docker'
  | 'library'
  | 'git'
  | 'database'
  | 'tunnels'
  | 'automation'
  | 'firewall'
  | 'files'
  | 'terminal';

export interface AppState {
  currentPage: PageId;
  setCurrentPage: (page: PageId) => void;
  targetOS: string;
  setTargetOS: (os: string) => void;
  isTerminalOpen: boolean;
  setIsTerminalOpen: (open: boolean) => void;
}
