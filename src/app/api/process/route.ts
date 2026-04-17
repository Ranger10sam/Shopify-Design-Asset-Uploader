import type { ProcessStreamEvent } from "@/lib/process-events";
import { getServerEnv } from "@/lib/env";
import { logError } from "@/lib/server/logger";
import {
  processUpload,
  UploadCancelledError,
  UploadValidationError,
} from "@/lib/server/process-upload";
import { parseUploadManifest } from "@/lib/upload-manifest";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const encoder = new TextEncoder();

function createLine(event: ProcessStreamEvent): Uint8Array {
  return encoder.encode(`${JSON.stringify(event)}\n`);
}

export async function POST(request: Request): Promise<Response> {
  try {
    getServerEnv();
  } catch (error) {
    logError("Server environment validation failed.", { error });
    return Response.json(
      {
        message:
          "Server configuration is incomplete. Fill in the required AWS environment variables before using the uploader.",
      },
      { status: 500 },
    );
  }

  let manifestText = "";
  let manifest;
  let filesById = new Map<string, File>();
  let productTitleOverride: string | undefined;

  try {
    const formData = await request.formData();
    const rawManifest = formData.get("manifest");
    const rawProductTitleOverride = formData.get("productTitleOverride");

    if (typeof rawManifest !== "string") {
      return Response.json(
        { message: "The upload manifest was missing from the request." },
        { status: 400 },
      );
    }

    manifestText = rawManifest;
    manifest = parseUploadManifest(JSON.parse(manifestText));
    productTitleOverride =
      typeof rawProductTitleOverride === "string" && rawProductTitleOverride.trim().length > 0
        ? rawProductTitleOverride.trim()
        : undefined;

    filesById = new Map(
      manifest.files.map((fileEntry) => {
        const file = formData.get(fileEntry.id);

        if (!(file instanceof File)) {
          throw new Error(
            `The uploaded file "${fileEntry.relativePath}" was missing from the request body.`,
          );
        }

        return [fileEntry.id, file];
      }),
    );
  } catch (error) {
    logError("Failed to parse upload request.", { error, manifestText });
    return Response.json(
      {
        message: "The upload request could not be parsed. Please re-select the folder and try again.",
      },
      { status: 400 },
    );
  }

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const emit = (event: ProcessStreamEvent): void => {
        controller.enqueue(createLine(event));
      };

      void (async () => {
        try {
          const result = await processUpload(
            {
              manifest,
              filesById,
              productTitleOverride,
              abortSignal: request.signal,
            },
            emit,
          );

          emit({
            type: "success",
            productFolderName: result.productFolderName,
            mode: result.mode,
            items: result.items,
          });
        } catch (error) {
          if (error instanceof UploadValidationError) {
            emit({
              type: "validation-error",
              errors: error.errors,
            });
          } else if (error instanceof UploadCancelledError) {
            return;
          } else {
            emit({
              type: "error",
              message:
                "Something went wrong while preparing or uploading the zip file(s). Please try again and check the server logs if the problem continues.",
            });
          }
        } finally {
          controller.close();
        }
      })();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
