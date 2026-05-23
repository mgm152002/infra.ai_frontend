import { cn } from "../lib/utils";
import { describe, expect, it } from "vitest";

describe("cn", () => {
  it("merges truthy class values", () => {
    expect(cn("px-4", false && "hidden", "py-2")).toBe("px-4 py-2");
  });

  it("lets tailwind-merge resolve conflicting utilities", () => {
    expect(cn("px-2", "px-4", "text-sm", "text-lg")).toBe("px-4 text-lg");
  });
});
