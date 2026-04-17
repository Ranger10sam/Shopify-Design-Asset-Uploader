import { describe, expect, it } from "vitest";

import { validateFolderStructure } from "@/lib/folder-structure";

describe("validateFolderStructure", () => {
  it("accepts a valid single-asset folder", () => {
    const result = validateFolderStructure({
      filePaths: [
        "Army Origin T-Shirt/asset/front.png",
        "Army Origin T-Shirt/asset/back.png",
      ],
      directories: ["Army Origin T-Shirt", "Army Origin T-Shirt/asset"],
    });

    expect(result.ok).toBe(true);
    expect(result).toMatchObject({
      mode: "single",
      zipPlans: [{ zipName: "ARMY_ORIGIN_T--SHIRT.zip" }],
    });
  });

  it("uses an edited title for zip naming without changing structure detection", () => {
    const result = validateFolderStructure({
      filePaths: [
        "Army Origin T-Shirt/asset/front.png",
        "Army Origin T-Shirt/asset/back.png",
      ],
      directories: ["Army Origin T-Shirt", "Army Origin T-Shirt/asset"],
      zipNameSourceTitle: "Army Camo Tactical",
    });

    expect(result.ok).toBe(true);
    expect(result).toMatchObject({
      productFolderName: "Army Origin T-Shirt",
      normalizedProductName: "ARMY_CAMO_TACTICAL",
      zipPlans: [{ zipName: "ARMY_CAMO_TACTICAL.zip" }],
    });
  });

  it("accepts a valid split asset folder and preserves nested files", () => {
    const result = validateFolderStructure({
      filePaths: [
        "Army Origin T-Shirt/asset/for light/front.png",
        "Army Origin T-Shirt/asset/for light/subdir/detail.png",
        "Army Origin T-Shirt/asset/for navy blue/front.png",
      ],
      directories: [
        "Army Origin T-Shirt",
        "Army Origin T-Shirt/asset",
        "Army Origin T-Shirt/asset/for light",
        "Army Origin T-Shirt/asset/for light/subdir",
        "Army Origin T-Shirt/asset/for navy blue",
      ],
    });

    expect(result.ok).toBe(true);
    expect(result).toMatchObject({
      mode: "split",
      zipPlans: [
        {
          zipName: "ARMY_ORIGIN_T--SHIRT_FOR_LIGHT.zip",
          relativeFiles: ["front.png", "subdir/detail.png"],
        },
        {
          zipName: "ARMY_ORIGIN_T--SHIRT_FOR_NAVY_BLUE.zip",
          relativeFiles: ["front.png"],
        },
      ],
    });
  });

  it("accepts an uppercase asset folder name", () => {
    const result = validateFolderStructure({
      filePaths: ["Army Origin T-Shirt/ASSET/front.png"],
      directories: ["Army Origin T-Shirt", "Army Origin T-Shirt/ASSET"],
    });

    expect(result.ok).toBe(true);
    expect(result).toMatchObject({
      mode: "single",
      zipPlans: [{ zipName: "ARMY_ORIGIN_T--SHIRT.zip" }],
    });
  });

  it("rejects uploads without an asset folder", () => {
    const result = validateFolderStructure({
      filePaths: ["Army Origin T-Shirt/mockups/front.png"],
      directories: ["Army Origin T-Shirt", "Army Origin T-Shirt/mockups"],
    });

    expect(result.ok).toBe(false);
    expect(result.errors).toContain(
      "The product folder must contain an `asset` folder directly inside the uploaded product folder.",
    );
  });

  it("rejects mixed loose files and subfolders inside asset", () => {
    const result = validateFolderStructure({
      filePaths: [
        "Army Origin T-Shirt/asset/front.png",
        "Army Origin T-Shirt/asset/for light/light.png",
      ],
      directories: [
        "Army Origin T-Shirt",
        "Army Origin T-Shirt/asset",
        "Army Origin T-Shirt/asset/for light",
      ],
    });

    expect(result.ok).toBe(false);
    expect(result.errors).toContain(
      "The `asset` folder cannot contain both loose files and subfolders.",
    );
  });

  it("accepts any asset subfolder names as separate variants", () => {
    const result = validateFolderStructure({
      filePaths: [
        "Army Origin T-Shirt/asset/light/front.png",
        "Army Origin T-Shirt/asset/sand/front.png",
      ],
      directories: [
        "Army Origin T-Shirt",
        "Army Origin T-Shirt/asset",
        "Army Origin T-Shirt/asset/light",
        "Army Origin T-Shirt/asset/sand",
      ],
    });

    expect(result.ok).toBe(true);
    expect(result).toMatchObject({
      mode: "split",
      zipPlans: [
        { zipName: "ARMY_ORIGIN_T--SHIRT_LIGHT.zip" },
        { zipName: "ARMY_ORIGIN_T--SHIRT_SAND.zip" },
      ],
    });
  });

  it("rejects empty variant folders", () => {
    const result = validateFolderStructure({
      filePaths: ["Army Origin T-Shirt/asset/for sand/front.png"],
      directories: [
        "Army Origin T-Shirt",
        "Army Origin T-Shirt/asset",
        "Army Origin T-Shirt/asset/for navy blue",
        "Army Origin T-Shirt/asset/for sand",
      ],
    });

    expect(result.ok).toBe(false);
    expect(result.errors).toContain(
      "The `for navy blue` folder inside `asset` must contain at least one file.",
    );
  });
});
