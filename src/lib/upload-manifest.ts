import { z } from "zod";

const uploadManifestFileSchema = z.object({
  id: z.string().min(1).regex(/^[A-Za-z0-9_-]+$/),
  relativePath: z.string().min(1),
  size: z.number().int().nonnegative(),
});

const uploadManifestSchema = z.object({
  files: z.array(uploadManifestFileSchema).min(1),
  directories: z.array(z.string()).default([]),
});

export type UploadManifestFile = z.infer<typeof uploadManifestFileSchema>;
export type UploadManifest = z.infer<typeof uploadManifestSchema>;

function splitNormalizedPath(path: string): string[] {
  return path.split("/").filter(Boolean);
}

export function normalizeRelativePath(rawPath: string): string {
  const normalized = rawPath.replace(/\\/g, "/").replace(/^\.?\//, "").trim();

  if (!normalized) {
    throw new Error("A provided path was empty.");
  }

  const segments = normalized.split("/").filter(Boolean);

  if (segments.length === 0) {
    throw new Error(`Invalid path "${rawPath}".`);
  }

  for (const segment of segments) {
    if (segment === "." || segment === "..") {
      throw new Error(`Path traversal is not allowed in "${rawPath}".`);
    }
  }

  return segments.join("/");
}

export function getParentDirectories(relativePath: string): string[] {
  const normalized = normalizeRelativePath(relativePath);
  const segments = splitNormalizedPath(normalized);
  const parents: string[] = [];

  for (let index = 1; index < segments.length; index += 1) {
    parents.push(segments.slice(0, index).join("/"));
  }

  return parents;
}

export function parseUploadManifest(rawManifest: unknown): UploadManifest {
  const parsed = uploadManifestSchema.parse(rawManifest);
  const seenFiles = new Set<string>();
  const normalizedFiles: UploadManifestFile[] = [];
  const directories = new Set<string>();

  for (const file of parsed.files) {
    const relativePath = normalizeRelativePath(file.relativePath);

    if (seenFiles.has(relativePath)) {
      throw new Error(`Duplicate file path detected: "${relativePath}".`);
    }

    seenFiles.add(relativePath);
    normalizedFiles.push({ ...file, relativePath });

    for (const parentDirectory of getParentDirectories(relativePath)) {
      directories.add(parentDirectory);
    }
  }

  for (const directory of parsed.directories) {
    const normalizedDirectory = normalizeRelativePath(directory);
    directories.add(normalizedDirectory);

    for (const parentDirectory of getParentDirectories(normalizedDirectory)) {
      directories.add(parentDirectory);
    }
  }

  return {
    files: normalizedFiles,
    directories: Array.from(directories).sort((left, right) => left.localeCompare(right)),
  };
}

