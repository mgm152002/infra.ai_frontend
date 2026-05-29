import { describe, expect, it } from "vitest";

describe("UI Components", () => {
  it("Button component is importable", async () => {
    const mod = await import("@/components/ui/button");
    expect(mod).toBeDefined();
  });

  it("Card component is importable", async () => {
    const mod = await import("@/components/ui/card");
    expect(mod).toBeDefined();
  });

  it("Badge component is importable", async () => {
    const mod = await import("@/components/ui/badge");
    expect(mod).toBeDefined();
  });

  it("Input component is importable", async () => {
    const mod = await import("@/components/ui/input");
    expect(mod).toBeDefined();
  });

  it("Table component is importable", async () => {
    const mod = await import("@/components/ui/table");
    expect(mod).toBeDefined();
  });

  it("Dialog component is importable", async () => {
    const mod = await import("@/components/ui/dialog");
    expect(mod).toBeDefined();
  });

  it("Tabs component is importable", async () => {
    const mod = await import("@/components/ui/tabs");
    expect(mod).toBeDefined();
  });

  it("Select component is importable", async () => {
    const mod = await import("@/components/ui/select");
    expect(mod).toBeDefined();
  });

  it("Textarea component is importable", async () => {
    const mod = await import("@/components/ui/textarea");
    expect(mod).toBeDefined();
  });

  it("Separator component is importable", async () => {
    const mod = await import("@/components/ui/separator");
    expect(mod).toBeDefined();
  });
});
