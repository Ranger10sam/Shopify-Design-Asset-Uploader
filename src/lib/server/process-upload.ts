import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import type { UploadManifest } from "@/lib/upload-manifest";
import { validateFolderStructure } from "@/lib/folder-structure";
import { getServerEnv } from "@/lib/env";
import type { ProcessStreamEvent, UploadResultItem } from "@/lib/process-events";
import { createZipFromPlan } from "@/lib/server/archive";
import { logError, logInfo } from "@/lib/server/logger";
import { uploadArtifactsToS3 } from "@/lib/server/s3";

export class UploadValidationError extends Error {
  constructor(public readonly errors: string[]) {
    super(errors[0] ?? "Upload validation failed.");
    this.name = "UploadValidationError";
  }
}

interface ProcessUploadInput {
  manifest: UploadManifest;
  filesById: Map<string, File>;
  productTitleOverride?: string;
}

interface ProcessUploadResult {
  productFolderName: string;
  mode: "single" | "split";
  items: UploadResultItem[];
}

function resolveWithin(baseDirectory: string, relativePath: string): string {
  const absolutePath = path.resolve(baseDirectory, ...relativePath.split("/"));
  const relativeToBase = path.relative(baseDirectory, absolutePath);

  if (relativeToBase.startsWith("..") || path.isAbsolute(relativeToBase)) {
    throw new Error(`Refused to write outside the temporary workspace: "${relativePath}".`);
  }

  return absolutePath;
}

async function writeUploadToTemporaryDirectory(
  tempDirectory: string,
  manifest: UploadManifest,
  filesById: Map<string, File>,
): Promise<void> {
  for (const directory of manifest.directories) {
    await mkdir(resolveWithin(tempDirectory, directory), { recursive: true });
  }

  for (const fileEntry of manifest.files) {
    const file = filesById.get(fileEntry.id);

    if (!file) {
      throw new Error(`The uploaded file "${fileEntry.relativePath}" was missing from the request.`);
    }

    if (file.size !== fileEntry.size) {
      throw new Error(`The uploaded file "${fileEntry.relativePath}" did not match the provided metadata.`);
    }

    const absolutePath = resolveWithin(tempDirectory, fileEntry.relativePath);
    await mkdir(path.dirname(absolutePath), { recursive: true });
    await writeFile(absolutePath, Buffer.from(await file.arrayBuffer()));
  }
}

export async function processUpload(
  input: ProcessUploadInput,
  onEvent: (event: ProcessStreamEvent) => void,
): Promise<ProcessUploadResult> {
  const tempDirectory = await mkdtemp(path.join(os.tmpdir(), "design-asset-uploader-"));

  logInfo("Created temporary upload workspace.", {
    tempDirectory,
    fileCount: input.manifest.files.length,
  });

  try {
    onEvent({
      type: "progress",
      step: "validating",
      message: "Validating the uploaded folder structure.",
    });

    const validationResult = validateFolderStructure({
      filePaths: input.manifest.files.map((file) => file.relativePath),
      directories: input.manifest.directories,
      zipNameSourceTitle: input.productTitleOverride,
    });

    if (!validationResult.ok) {
      throw new UploadValidationError(validationResult.errors);
    }

    await writeUploadToTemporaryDirectory(tempDirectory, input.manifest, input.filesById);

    onEvent({
      type: "progress",
      step: "preparing",
      message: "Preparing zip file output from the validated asset folders.",
    });

    const outputDirectory = path.join(tempDirectory, "__generated");
    const preparedArtifacts = [];

    for (const zipPlan of validationResult.zipPlans) {
      const sourceRootDirectory = resolveWithin(tempDirectory, zipPlan.sourceRootRelativePath);
      const localZipPath = await createZipFromPlan({
        outputDirectory,
        sourceRootDirectory,
        zipPlan,
      });

      preparedArtifacts.push({
        localZipPath,
        zipName: zipPlan.zipName,
        fileCount: zipPlan.relativeFiles.length,
      });
    }

    onEvent({
      type: "progress",
      step: "uploading",
      message: "Uploading the generated zip file(s) to S3.",
    });

    const uploadedArtifacts = await uploadArtifactsToS3(preparedArtifacts, getServerEnv());

    return {
      productFolderName: validationResult.productFolderName,
      mode: validationResult.mode,
      items: uploadedArtifacts,
    };
  } catch (error) {
    logError("Upload processing failed.", {
      error,
    });
    throw error;
  } finally {
    await rm(tempDirectory, { recursive: true, force: true });
    logInfo("Removed temporary upload workspace.", { tempDirectory });
  }
}
