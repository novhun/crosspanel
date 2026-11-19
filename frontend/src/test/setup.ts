import "@testing-library/jest-dom/vitest";
import { vi } from "vitest";

const toastMock = Object.assign(vi.fn(), {
  success: vi.fn(),
  info: vi.fn(),
  error: vi.fn(),
  warning: vi.fn(),
  message: vi.fn(),
  dismiss: vi.fn(),
});

vi.mock("sonner", () => ({
  toast: toastMock,
  Toaster: () => null,
}));

Object.defineProperty(window, "scrollTo", {
  writable: true,
  value: () => {},
});

Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => {},
  }),
});
