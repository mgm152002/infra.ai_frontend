import { describe, expect, it, vi, beforeEach } from "vitest";

describe("Stream API Route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("route module is importable", async () => {
    const mod = await import("@/app/api/stream/route");
    expect(mod).toBeDefined();
  });

  it("exports GET handler", async () => {
    const mod = await import("@/app/api/stream/route");
    expect(mod.GET).toBeDefined();
    expect(typeof mod.GET).toBe("function");
  });
});
