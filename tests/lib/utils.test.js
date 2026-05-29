import { cn } from "@/lib/utils";
import { describe, expect, it } from "vitest";

describe("cn utility", () => {
  it("merges truthy class values", () => {
    expect(cn("px-4", false && "hidden", "py-2")).toBe("px-4 py-2");
  });

  it("lets tailwind-merge resolve conflicting utilities", () => {
    expect(cn("px-2", "px-4", "text-sm", "text-lg")).toBe("px-4 text-lg");
  });

  it("handles empty input", () => {
    expect(cn()).toBe("");
  });

  it("handles single class", () => {
    expect(cn("text-red-500")).toBe("text-red-500");
  });

  it("handles undefined and null values", () => {
    expect(cn("px-4", undefined, null, "py-2")).toBe("px-4 py-2");
  });

  it("merges tailwind responsive classes", () => {
    expect(cn("text-sm md:text-lg", "text-base")).toBe("md:text-lg text-base");
  });

  it("handles array inputs", () => {
    expect(cn(["px-4", "py-2"])).toBe("px-4 py-2");
  });

  it("handles object inputs", () => {
    expect(cn({ "px-4": true, "hidden": false })).toBe("px-4");
  });
});
