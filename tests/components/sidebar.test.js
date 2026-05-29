import { describe, expect, it, vi } from "vitest";

// Mock the AppSidebar component since it uses Clerk hooks
vi.mock("@clerk/nextjs", () => ({
  useUser: () => ({
    user: { id: "test-user" },
    isLoaded: true,
    isSignedIn: true,
  }),
  SignedIn: ({ children }) => children,
  SignedOut: ({ children }) => null,
}));

describe("Sidebar Component", () => {
  it("sidebar module is importable", async () => {
    const sidebar = await import("@/components/sidebar");
    expect(sidebar).toBeDefined();
  });

  it("sidebar exports Sidebar component", async () => {
    const mod = await import("@/components/sidebar");
    expect(mod.Sidebar).toBeDefined();
    expect(typeof mod.Sidebar).toBe("function");
  });

  it("sidebar exports MobileSidebar component", async () => {
    const mod = await import("@/components/sidebar");
    expect(mod.MobileSidebar).toBeDefined();
    expect(typeof mod.MobileSidebar).toBe("function");
  });
});
