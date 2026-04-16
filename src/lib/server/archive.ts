import { createWriteStream } from "node:fs";
import { mkdir } from "node:fs/promises";
import path from "node:path";

import archiver from "archiver";

import type { ZipPlan } from "@/lib/folder-structure";

function resolveWithin(baseDirectory: string, relativePath: string): string {
  const absolutePath = path.resolve(baseDirectory, ...relativePath.split("/"));
  const relativeToBase = path.relative(baseDirectory, absolutePath);

  if (relativeToBase.startsWith("..") || path.isAbsolute(relativeToBase)) {
    throw new Error(`Refused to access a path outside the zip source: "${relativePath}".`);
  }

  return absolutePath;
}

export async function createZipFromPlan(options: {
  outputDirectory: string;
  sourceRootDirectory: string;
  zipPlan: ZipPlan;
}): Promise<string> {
  const { outputDirectory, sourceRootDirectory, zipPlan } = options;
  const outputPath = path.join(outputDirectory, zipPlan.zipName);

  await mkdir(outputDirectory, { recursive: true });

  await new Promise<void>((resolve, reject) => {
    const output = createWriteStream(outputPath);
    const archive = archiver("zip", { zlib: { level: 9 } });

    output.on("close", () => resolve());
    output.on("error", (error) => reject(error));
    archive.on("warning", (error) => reject(error));
    archive.on("error", (error) => reject(error));

    archive.pipe(output);

    for (const relativeFilePath of zipPlan.relativeFiles) {
      archive.file(resolveWithin(sourceRootDirectory, relativeFilePath), {
        name: relativeFilePath,
      });
    }

    void archive.finalize();
  });

  return outputPath;
}

