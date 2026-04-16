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
      zipPlans: [{ zipName: "Army_Origin_T--Shirt.zip" }],
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
      normalizedProductName: "Army_Camo_Tactical",
      zipPlans: [{ zipName: "Army_Camo_Tactical.zip" }],
    });
  });

  it("accepts a valid split asset folder and preserves nested files", () => {
    const result = validateFolderStructure({
      filePaths: [
        "Army Origin T-Shirt/asset/for light/front.png",
        "Army Origin T-Shirt/asset/for light/subdir/detail.png",
        "Army Origin T-Shirt/asset/for dark/front.png",
      ],
      directories: [
        "Army Origin T-Shirt",
        "Army Origin T-Shirt/asset",
        "Army Origin T-Shirt/asset/for light",
        "Army Origin T-Shirt/asset/for light/subdir",
        "Army Origin T-Shirt/asset/for dark",
      ],
    });

    expect(result.ok).toBe(true);
    expect(result).toMatchObject({
      mode: "split",
      zipPlans: [
        {
          zipName: "Army_Origin_T--Shirt_For_Light.zip",
          relativeFiles: ["front.png", "subdir/detail.png"],
        },
        {
          zipName: "Army_Origin_T--Shirt_For_Dark.zip",
          relativeFiles: ["front.png"],
        },
      ],
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

  it("rejects incorrect split folder names", () => {
    const result = validateFolderStructure({
      filePaths: [
        "Army Origin T-Shirt/asset/light/front.png",
        "Army Origin T-Shirt/asset/dark/front.png",
      ],
      directories: [
        "Army Origin T-Shirt",
        "Army Origin T-Shirt/asset",
        "Army Origin T-Shirt/asset/light",
        "Army Origin T-Shirt/asset/dark",
      ],
    });

    expect(result.ok).toBe(false);
    expect(result.errors).toContain(
      "The `asset` folder must contain both `for light` and `for dark` folders.",
    );
    expect(result.errors[1]).toContain("Unexpected folder(s) inside `asset`");
  });

  it("rejects empty light or dark folders", () => {
    const result = validateFolderStructure({
      filePaths: ["Army Origin T-Shirt/asset/for dark/front.png"],
      directories: [
        "Army Origin T-Shirt",
        "Army Origin T-Shirt/asset",
        "Army Origin T-Shirt/asset/for light",
        "Army Origin T-Shirt/asset/for dark",
      ],
    });

    expect(result.ok).toBe(false);
    expect(result.errors).toContain("The `for light` folder must contain at least one file.");
  });
});
