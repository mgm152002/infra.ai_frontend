import { describe, expect, it, vi, beforeEach } from "vitest";

describe("Execute API Route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("route module is importable", async () => {
    const mod = await import("@/app/api/execute/route");
    expect(mod).toBeDefined();
  });

  it("exports POST handler", async () => {
    const mod = await import("@/app/api/execute/route");
    expect(mod.POST).toBeDefined();
    expect(typeof mod.POST).toBe("function");
  });
});
