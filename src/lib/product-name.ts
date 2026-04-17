const ILLEGAL_FILENAME_CHARACTERS = /[<>:"/\\|?*\u0000-\u001f]/g;

export function sanitizeProductFolderName(productFolderName: string): string {
  const trimmed = productFolderName.trim().replace(/[. ]+$/g, "");
  const sanitized = trimmed.replace(ILLEGAL_FILENAME_CHARACTERS, "_");

  return sanitized.length > 0 && /[\p{L}\p{N}]/u.test(sanitized) ? sanitized : "Product";
}

export function normalizeProductName(productFolderName: string): string {
  return sanitizeProductFolderName(productFolderName)
    .replace(/ /g, "_")
    .replace(/-/g, "--")
    .toUpperCase();
}

function toReadableVariantName(variantFolderName: string): string {
  const sanitized = sanitizeProductFolderName(variantFolderName)
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();

  return sanitized.replace(/(^|[\s-])([\p{L}\p{N}])/gu, (match, prefix: string, character: string) => {
    return `${prefix}${character.toUpperCase()}`;
  });
}

export function buildSingleAssetZipName(productFolderName: string): string {
  return `${normalizeProductName(productFolderName)}.zip`;
}

export function buildSplitAssetZipNames(productFolderName: string): [string, string] {
  const normalizedName = normalizeProductName(productFolderName);

  return [`${normalizedName}_For_Light.zip`, `${normalizedName}_For_Dark.zip`];
}

export function buildVariantAssetZipName(
  productFolderName: string,
  variantFolderName: string,
): string {
  return `${normalizeProductName(productFolderName)}_${normalizeProductName(toReadableVariantName(variantFolderName))}.zip`;
}

export function formatVariantLabel(variantFolderName: string): string {
  return toReadableVariantName(variantFolderName).toUpperCase();
}
