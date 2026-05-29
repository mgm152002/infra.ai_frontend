import { expect, vi } from "vitest";
import * as matchers from "@testing-library/jest-dom/matchers";

expect.extend(matchers);

// Mock Next.js router
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    back: vi.fn(),
    prefetch: vi.fn(),
    pathname: "/",
    query: {},
  }),
  usePathname: () => "/",
  useSearchParams: () => new URLSearchParams(),
}));

// Mock Clerk
vi.mock("@clerk/nextjs", () => ({
  ClerkProvider: ({ children }) => children,
  useUser: () => ({
    user: {
      id: "test-user-id",
      primaryEmailAddress: { emailAddress: "test@example.com" },
    },
    isLoaded: true,
    isSignedIn: true,
  }),
  useAuth: () => ({
    userId: "test-user-id",
    isLoaded: true,
    isSignedIn: true,
    getToken: vi.fn().mockResolvedValue("test-token"),
  }),
  SignIn: () => null,
  SignUp: () => null,
  SignedIn: ({ children }) => children,
  SignedOut: ({ children }) => null,
  UserButton: () => null,
}));

// Mock next-themes
vi.mock("next-themes", () => ({
  ThemeProvider: ({ children }) => children,
  useTheme: () => ({
    theme: "light",
    setTheme: vi.fn(),
  }),
}));

// Mock global fetch
global.fetch = vi.fn();

// Mock IntersectionObserver
class MockIntersectionObserver {
  constructor(callback) {
    this.callback = callback;
  }
  observe() {
    return null;
  }
  unobserve() {
    return null;
  }
  disconnect() {
    return null;
  }
}
global.IntersectionObserver = MockIntersectionObserver;

// Mock ResizeObserver
class MockResizeObserver {
  constructor(callback) {
    this.callback = callback;
  }
  observe() {
    return null;
  }
  unobserve() {
    return null;
  }
  disconnect() {
    return null;
  }
}
global.ResizeObserver = MockResizeObserver;
