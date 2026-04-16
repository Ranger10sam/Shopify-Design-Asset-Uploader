export function buildS3Key(prefix: string, zipName: string): string {
  const normalizedPrefix = prefix
    .split("/")
    .map((segment) => segment.trim())
    .filter(Boolean)
    .join("/");

  return normalizedPrefix ? `${normalizedPrefix}/${zipName}` : zipName;
}

export function buildPublicUrl(publicBaseUrl: string, s3Key: string): string {
  const trimmedBaseUrl = publicBaseUrl.replace(/\/+$/g, "");
  const encodedKey = s3Key
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");

  return `${trimmedBaseUrl}/${encodedKey}`;
}

