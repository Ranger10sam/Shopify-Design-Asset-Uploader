import { describe, expect, it } from "vitest";

import { buildSingleAssetZipName, buildSplitAssetZipNames } from "@/lib/product-name";

describe("zip output naming", () => {
  it("creates the correct single-asset zip name", () => {
    expect(buildSingleAssetZipName("Army Origin T-Shirt")).toBe("Army_Origin_T--Shirt.zip");
  });

  it("creates the correct split-asset zip names", () => {
    expect(buildSplitAssetZipNames("Army Origin T-Shirt")).toEqual([
      "Army_Origin_T--Shirt_For_Light.zip",
      "Army_Origin_T--Shirt_For_Dark.zip",
    ]);
  });
});
