import type { AssetMode } from "@/lib/folder-structure";

export interface UploadResultItem {
  zipName: string;
  s3Key: string;
  publicUrl: string;
  fileCount: number;
}

export type ProcessStreamEvent =
  | {
      type: "progress";
      step: "validating" | "preparing" | "uploading";
      message: string;
    }
  | {
      type: "validation-error";
      errors: string[];
    }
  | {
      type: "error";
      message: string;
    }
  | {
      type: "success";
      productFolderName: string;
      mode: AssetMode;
      items: UploadResultItem[];
    };
