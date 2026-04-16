const ILLEGAL_FILENAME_CHARACTERS = /[<>:"/\\|?*\u0000-\u001f]/g;

export function sanitizeProductFolderName(productFolderName: string): string {
  const trimmed = productFolderName.trim().replace(/[. ]+$/g, "");
  const sanitized = trimmed.replace(ILLEGAL_FILENAME_CHARACTERS, "_");

  return sanitized.length > 0 && /[\p{L}\p{N}]/u.test(sanitized) ? sanitized : "Product";
}

export function normalizeProductName(productFolderName: string): string {
  return sanitizeProductFolderName(productFolderName)
    .replace(/ /g, "_")
    .replace(/-/g, "--");
}

export function buildSingleAssetZipName(productFolderName: string): string {
  return `${normalizeProductName(productFolderName)}.zip`;
}

export function buildSplitAssetZipNames(productFolderName: string): [string, string] {
  const normalizedName = normalizeProductName(productFolderName);

  return [`${normalizedName}_For_Light.zip`, `${normalizedName}_For_Dark.zip`];
}
