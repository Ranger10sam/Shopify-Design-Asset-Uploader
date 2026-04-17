import { describe, expect, it } from "vitest";

import { buildSingleAssetZipName, buildVariantAssetZipName } from "@/lib/product-name";

describe("zip output naming", () => {
  it("creates the correct single-asset zip name", () => {
    expect(buildSingleAssetZipName("Army Origin T-Shirt")).toBe("ARMY_ORIGIN_T--SHIRT.zip");
  });

  it("creates the correct variant zip names from asset subfolders", () => {
    expect(buildVariantAssetZipName("Army Origin T-Shirt", "for light")).toBe(
      "ARMY_ORIGIN_T--SHIRT_FOR_LIGHT.zip",
    );
    expect(buildVariantAssetZipName("Army Origin T-Shirt", "for navy blue")).toBe(
      "ARMY_ORIGIN_T--SHIRT_FOR_NAVY_BLUE.zip",
    );
  });
});
