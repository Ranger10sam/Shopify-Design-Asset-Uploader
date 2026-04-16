import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";

import { DeleteObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

import type { AppEnv } from "@/lib/env";
import { buildPublicUrl, buildS3Key } from "@/lib/s3-paths";
import { logError, logInfo } from "@/lib/server/logger";

interface UploadArtifactInput {
  localZipPath: string;
  zipName: string;
  fileCount: number;
}

export interface UploadedArtifact {
  zipName: string;
  s3Key: string;
  publicUrl: string;
  fileCount: number;
}

function createS3Client(env: AppEnv): S3Client {
  return new S3Client({
    region: env.AWS_REGION,
    credentials: {
      accessKeyId: env.AWS_ACCESS_KEY_ID,
      secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
    },
  });
}

export async function uploadArtifactsToS3(
  artifacts: UploadArtifactInput[],
  env: AppEnv,
): Promise<UploadedArtifact[]> {
  const client = createS3Client(env);
  const uploadedKeys: string[] = [];
  const uploadedArtifacts: UploadedArtifact[] = [];

  try {
    for (const artifact of artifacts) {
      const s3Key = buildS3Key(env.AWS_S3_PREFIX, artifact.zipName);
      const fileStats = await stat(artifact.localZipPath);

      logInfo("Uploading zip artifact to S3.", {
        zipName: artifact.zipName,
        s3Key,
        sizeInBytes: fileStats.size,
      });

      await client.send(
        new PutObjectCommand({
          Bucket: env.AWS_S3_BUCKET,
          Key: s3Key,
          Body: createReadStream(artifact.localZipPath),
          ContentType: "application/zip",
          ContentLength: fileStats.size,
        }),
      );

      uploadedKeys.push(s3Key);
      uploadedArtifacts.push({
        zipName: artifact.zipName,
        s3Key,
        publicUrl: buildPublicUrl(env.AWS_PUBLIC_BASE_URL, s3Key),
        fileCount: artifact.fileCount,
      });
    }

    return uploadedArtifacts;
  } catch (error) {
    logError("S3 upload failed. Cleaning up any uploaded objects.", {
      uploadedKeys,
      error,
    });

    await Promise.all(
      uploadedKeys.map(async (key) => {
        try {
          await client.send(
            new DeleteObjectCommand({
              Bucket: env.AWS_S3_BUCKET,
              Key: key,
            }),
          );
        } catch (deleteError) {
          logError("Failed to delete uploaded object during rollback.", {
            key,
            deleteError,
          });
        }
      }),
    );

    throw error;
  }
}

