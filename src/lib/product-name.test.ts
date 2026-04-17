import { describe, expect, it } from "vitest";

import { normalizeProductName, sanitizeProductFolderName } from "@/lib/product-name";

describe("normalizeProductName", () => {
  it("replaces spaces with underscores, hyphens with double hyphens, and uppercases the result", () => {
    expect(normalizeProductName("Army Origin T-Shirt")).toBe("ARMY_ORIGIN_T--SHIRT");
  });

  it("sanitizes illegal filename characters and uppercases the result", () => {
    expect(normalizeProductName("Summer:Drop / Variant")).toBe("SUMMER_DROP___VARIANT");
  });
});

describe("sanitizeProductFolderName", () => {
  it("falls back to a safe default when the name becomes empty", () => {
    expect(sanitizeProductFolderName('  <>:"/\\\\|?*  ')).toBe("Product");
  });
});
