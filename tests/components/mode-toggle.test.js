import { describe, expect, it, vi } from "vitest";

vi.mock("next-themes", () => ({
  useTheme: () => ({
    theme: "light",
    setTheme: vi.fn(),
  }),
}));

describe("Mode Toggle Component", () => {
  it("mode-toggle module is importable", async () => {
    const mod = await import("@/components/mode-toggle");
    expect(mod).toBeDefined();
  });

  it("exports ModeToggle component", async () => {
    const mod = await import("@/components/mode-toggle");
    expect(mod.ModeToggle || mod.default).toBeDefined();
  });
});
