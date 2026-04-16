import { describe, expect, it } from "vitest";

import { normalizeProductName, sanitizeProductFolderName } from "@/lib/product-name";

describe("normalizeProductName", () => {
  it("replaces spaces with underscores and hyphens with double hyphens", () => {
    expect(normalizeProductName("Army Origin T-Shirt")).toBe("Army_Origin_T--Shirt");
  });

  it("sanitizes illegal filename characters without changing readable casing", () => {
    expect(normalizeProductName("Summer:Drop / Variant")).toBe("Summer_Drop___Variant");
  });
});

describe("sanitizeProductFolderName", () => {
  it("falls back to a safe default when the name becomes empty", () => {
    expect(sanitizeProductFolderName('  <>:"/\\\\|?*  ')).toBe("Product");
  });
});
