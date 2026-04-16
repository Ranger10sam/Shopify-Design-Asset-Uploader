import {
  buildSingleAssetZipName,
  buildSplitAssetZipNames,
  normalizeProductName,
} from "@/lib/product-name";
import { normalizeRelativePath } from "@/lib/upload-manifest";

export type AssetMode = "single" | "split";

export interface ZipPlan {
  zipName: string;
  sourceRootRelativePath: string;
  relativeFiles: string[];
  label: string;
}

export interface ValidationSuccess {
  ok: true;
  productFolderName: string;
  normalizedProductName: string;
  mode: AssetMode;
  zipPlans: ZipPlan[];
}

export interface ValidationFailure {
  ok: false;
  productFolderName?: string;
  normalizedProductName?: string;
  errors: string[];
}

export type ValidationResult = ValidationSuccess | ValidationFailure;

interface StructureInput {
  filePaths: string[];
  directories: string[];
  zipNameSourceTitle?: string;
}

function isDescendantPath(path: string, ancestor: string): boolean {
  return path === ancestor || path.startsWith(`${ancestor}/`);
}

function removeAncestorPrefix(path: string, ancestor: string): string {
  return path.slice(`${ancestor}/`.length);
}

function getRootFolderNames(paths: string[]): string[] {
  return Array.from(new Set(paths.map((path) => normalizeRelativePath(path).split("/")[0]))).sort(
    (left, right) => left.localeCompare(right),
  );
}

function getDirectChildFolders(
  parentPath: string,
  directories: string[],
  filePaths: string[],
): string[] {
  const childFolderNames = new Set<string>();

  for (const directoryPath of directories) {
    if (!isDescendantPath(directoryPath, parentPath) || directoryPath === parentPath) {
      continue;
    }

    const remainder = removeAncestorPrefix(directoryPath, parentPath);
    const segments = remainder.split("/").filter(Boolean);

    if (segments.length >= 1) {
      childFolderNames.add(segments[0]);
    }
  }

  for (const filePath of filePaths) {
    if (!isDescendantPath(filePath, parentPath) || filePath === parentPath) {
      continue;
    }

    const remainder = removeAncestorPrefix(filePath, parentPath);
    const segments = remainder.split("/").filter(Boolean);

    if (segments.length >= 2) {
      childFolderNames.add(segments[0]);
    }
  }

  return Array.from(childFolderNames).sort((left, right) => left.localeCompare(right));
}

function getDirectChildFiles(parentPath: string, filePaths: string[]): string[] {
  const directFiles: string[] = [];

  for (const filePath of filePaths) {
    if (!isDescendantPath(filePath, parentPath) || filePath === parentPath) {
      continue;
    }

    const remainder = removeAncestorPrefix(filePath, parentPath);
    const segments = remainder.split("/").filter(Boolean);

    if (segments.length === 1) {
      directFiles.push(remainder);
    }
  }

  return directFiles.sort((left, right) => left.localeCompare(right));
}

function getFilesUnderPath(parentPath: string, filePaths: string[]): string[] {
  return filePaths
    .filter((filePath) => filePath.startsWith(`${parentPath}/`))
    .map((filePath) => removeAncestorPrefix(filePath, parentPath))
    .sort((left, right) => left.localeCompare(right));
}

export function validateFolderStructure(input: StructureInput): ValidationResult {
  const normalizedFilePaths = input.filePaths.map((path) => normalizeRelativePath(path));
  const normalizedDirectories = input.directories.map((path) => normalizeRelativePath(path));
  const allPaths = [...normalizedDirectories, ...normalizedFilePaths];

  if (allPaths.length === 0) {
    return {
      ok: false,
      errors: ["The uploaded folder did not contain any files to inspect."],
    };
  }

  const rootFolderNames = getRootFolderNames(allPaths);

  if (rootFolderNames.length !== 1) {
    return {
      ok: false,
      errors: [
        "Upload exactly one product folder. Multiple top-level folders were detected in the upload.",
      ],
    };
  }

  const [productFolderName] = rootFolderNames;
  const zipNameSourceTitle = input.zipNameSourceTitle?.trim() || productFolderName;
  const normalizedProductName = normalizeProductName(zipNameSourceTitle);
  const assetFolderPath = `${productFolderName}/asset`;
  const assetFolderExists =
    normalizedDirectories.includes(assetFolderPath) ||
    normalizedFilePaths.some((path) => path.startsWith(`${assetFolderPath}/`));

  if (!assetFolderExists) {
    return {
      ok: false,
      productFolderName,
      normalizedProductName,
      errors: [
        "The product folder must contain an `asset` folder directly inside the uploaded product folder.",
      ],
    };
  }

  const directFiles = getDirectChildFiles(assetFolderPath, normalizedFilePaths);
  const directFolders = getDirectChildFolders(
    assetFolderPath,
    normalizedDirectories,
    normalizedFilePaths,
  );
  const errors: string[] = [];

  if (directFiles.length === 0 && directFolders.length === 0) {
    errors.push("The `asset` folder is empty.");
  }

  if (directFiles.length > 0 && directFolders.length > 0) {
    errors.push("The `asset` folder cannot contain both loose files and subfolders.");
  }

  if (errors.length > 0) {
    return {
      ok: false,
      productFolderName,
      normalizedProductName,
      errors,
    };
  }

  if (directFiles.length > 0) {
    return {
      ok: true,
      productFolderName,
      normalizedProductName,
      mode: "single",
      zipPlans: [
        {
          zipName: buildSingleAssetZipName(zipNameSourceTitle),
          sourceRootRelativePath: assetFolderPath,
          relativeFiles: directFiles,
          label: "Single asset set",
        },
      ],
    };
  }

  const expectedFolders = ["for dark", "for light"];
  const missingFolders = expectedFolders.filter((folder) => !directFolders.includes(folder));
  const unexpectedFolders = directFolders.filter((folder) => !expectedFolders.includes(folder));

  if (missingFolders.length > 0) {
    errors.push(
      missingFolders.length === 2
        ? "The `asset` folder must contain both `for light` and `for dark` folders."
        : `Missing required folder inside \`asset\`: \`${missingFolders[0]}\`.`,
    );
  }

  if (unexpectedFolders.length > 0) {
    errors.push(
      `Unexpected folder(s) inside \`asset\`: ${unexpectedFolders
        .map((folder) => `\`${folder}\``)
        .join(", ")}. Only \`for light\` and \`for dark\` are allowed.`,
    );
  }

  if (errors.length > 0) {
    return {
      ok: false,
      productFolderName,
      normalizedProductName,
      errors,
    };
  }

  const lightSourcePath = `${assetFolderPath}/for light`;
  const darkSourcePath = `${assetFolderPath}/for dark`;
  const lightFiles = getFilesUnderPath(lightSourcePath, normalizedFilePaths);
  const darkFiles = getFilesUnderPath(darkSourcePath, normalizedFilePaths);

  if (lightFiles.length === 0) {
    errors.push("The `for light` folder must contain at least one file.");
  }

  if (darkFiles.length === 0) {
    errors.push("The `for dark` folder must contain at least one file.");
  }

  if (errors.length > 0) {
    return {
      ok: false,
      productFolderName,
      normalizedProductName,
      errors,
    };
  }

  const [lightZipName, darkZipName] = buildSplitAssetZipNames(zipNameSourceTitle);

  return {
    ok: true,
    productFolderName,
    normalizedProductName,
    mode: "split",
    zipPlans: [
      {
        zipName: lightZipName,
        sourceRootRelativePath: lightSourcePath,
        relativeFiles: lightFiles,
        label: "For light",
      },
      {
        zipName: darkZipName,
        sourceRootRelativePath: darkSourcePath,
        relativeFiles: darkFiles,
        label: "For dark",
      },
    ],
  };
}
