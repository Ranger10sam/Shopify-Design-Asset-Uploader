"use client";

import type { ChangeEvent, DragEvent } from "react";
import { startTransition, useRef, useState } from "react";

import {
  Activity,
  AlertTriangle,
  ArrowRight,
  CheckCheck,
  CheckCircle2,
  CircleDashed,
  ClipboardCheck,
  CloudUpload,
  FilePenLine,
  FolderOpen,
  FolderTree,
  LoaderCircle,
  Package,
  RefreshCcw,
  ShieldCheck,
  Sparkles,
} from "lucide-react";

import { ResultCard } from "@/components/result-card";
import { buildDefaultSteps, StepGuide, type StepStatus } from "@/components/step-guide";
import { UploadDropzone } from "@/components/upload-dropzone";
import {
  collectFromDirectoryHandle,
  collectFromDropItems,
  collectFromInputFiles,
  type SelectedFolder,
} from "@/lib/client/file-selection";
import type { ValidationFailure, ValidationSuccess } from "@/lib/folder-structure";
import { validateFolderStructure } from "@/lib/folder-structure";
import { normalizeProductName } from "@/lib/product-name";
import type { ProcessStreamEvent, UploadResultItem } from "@/lib/process-events";

type ProcessingStage = "idle" | "submitting" | "preparing" | "uploading" | "success" | "error";

interface SelectionState extends SelectedFolder {
  validation: ValidationSuccess | ValidationFailure;
  productTitleOverride: string;
}

interface LiveProcessStep {
  title: string;
  description: string;
  state: "pending" | "active" | "complete" | "error";
}

function getModeLabel(mode: ValidationSuccess["mode"]): string {
  return mode === "single" ? "Single asset set" : "Split light/dark asset set";
}

function getStepStatuses(
  selection: SelectionState | null,
  stage: ProcessingStage,
): [StepStatus, StepStatus, StepStatus, StepStatus, StepStatus] {
  const uploadStatus: StepStatus = selection ? "complete" : "current";
  const validationStatus: StepStatus = selection
    ? selection.validation.ok
      ? "complete"
      : "error"
    : "pending";

  let prepareStatus: StepStatus = "pending";
  let uploadToS3Status: StepStatus = "pending";
  let resultsStatus: StepStatus = "pending";

  if (stage === "submitting" || stage === "preparing") {
    prepareStatus = "current";
  }

  if (stage === "uploading") {
    prepareStatus = "complete";
    uploadToS3Status = "current";
  }

  if (stage === "success") {
    prepareStatus = "complete";
    uploadToS3Status = "complete";
    resultsStatus = "current";
  }

  if (stage === "error" && selection?.validation.ok) {
    prepareStatus = "error";
  }

  return [uploadStatus, validationStatus, prepareStatus, uploadToS3Status, resultsStatus];
}

function getStatusHeading(stage: ProcessingStage): string {
  switch (stage) {
    case "submitting":
      return "Sending folder to the server";
    case "preparing":
      return "Preparing zip output";
    case "uploading":
      return "Uploading zip file(s) to S3";
    case "success":
      return "Ready to copy the final URLs";
    case "error":
      return "Processing stopped";
    default:
      return "Waiting for a product folder";
  }
}

function getProgressValue(stage: ProcessingStage, hasResults: boolean): number {
  if (stage === "success" || hasResults) {
    return 100;
  }

  switch (stage) {
    case "submitting":
      return 18;
    case "preparing":
      return 52;
    case "uploading":
      return 82;
    case "error":
      return 100;
    default:
      return 0;
  }
}

function getLiveProcessSteps(stage: ProcessingStage, hasResults: boolean): LiveProcessStep[] {
  const processFailed = stage === "error";

  return [
    {
      title: "Validate upload",
      description: "Confirm the folder structure is accepted before anything is created.",
      state:
        stage === "idle"
          ? "pending"
          : processFailed
            ? "error"
            : "complete",
    },
    {
      title: "Prepare zip files",
      description: "Create the exact output names and package only approved files.",
      state:
        stage === "submitting" || stage === "preparing"
          ? "active"
          : stage === "uploading" || stage === "success" || hasResults
            ? "complete"
            : processFailed
              ? "error"
              : "pending",
    },
    {
      title: "Upload to S3",
      description: "Send every generated zip to the configured bucket and prefix.",
      state:
        stage === "uploading"
          ? "active"
          : stage === "success" || hasResults
            ? "complete"
            : processFailed
              ? "error"
              : "pending",
    },
    {
      title: "Deliver final URLs",
      description: "Return copy-ready public links for your spreadsheet workflow.",
      state:
        stage === "success" || hasResults ? "active" : processFailed ? "error" : "pending",
    },
  ];
}

function getProcessStateTone(
  state: LiveProcessStep["state"],
): {
  dot: string;
  panel: string;
  line: string;
} {
  switch (state) {
    case "complete":
      return {
        dot: "border-emerald-500 bg-emerald-500 text-white",
        panel: "border-emerald-200 bg-emerald-50/70",
        line: "bg-emerald-300",
      };
    case "active":
      return {
        dot: "border-sky-500 bg-sky-500 text-white",
        panel: "border-sky-200 bg-sky-50/80 shadow-[0_18px_40px_-34px_rgba(14,116,144,0.7)]",
        line: "bg-slate-200",
      };
    case "error":
      return {
        dot: "border-rose-500 bg-rose-500 text-white",
        panel: "border-rose-200 bg-rose-50/80",
        line: "bg-rose-200",
      };
    default:
      return {
        dot: "border-slate-300 bg-white text-slate-400",
        panel: "border-slate-200 bg-slate-50/70",
        line: "bg-slate-200",
      };
  }
}

function hasDirectoryPicker(
  browserWindow: Window,
): browserWindow is Window & {
  showDirectoryPicker: () => Promise<FileSystemDirectoryHandle>;
} {
  return (
    typeof (browserWindow as Window & { showDirectoryPicker?: unknown }).showDirectoryPicker ===
    "function"
  );
}

export default function Home() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [selection, setSelection] = useState<SelectionState | null>(null);
  const [stage, setStage] = useState<ProcessingStage>("idle");
  const [isDragging, setIsDragging] = useState(false);
  const [isBusy, setIsBusy] = useState(false);
  const [processNotes, setProcessNotes] = useState<string[]>([]);
  const [errorMessages, setErrorMessages] = useState<string[]>([]);
  const [results, setResults] = useState<UploadResultItem[]>([]);

  const stepStatuses = getStepStatuses(selection, stage);
  const liveSteps = getLiveProcessSteps(stage, results.length > 0);
  const progressValue = getProgressValue(stage, results.length > 0);

  function buildSelectionState(
    selectedFolder: SelectedFolder,
    productTitleOverride: string,
  ): SelectionState {
    const trimmedTitle = productTitleOverride.trim();
    const validation = validateFolderStructure({
      filePaths: selectedFolder.files.map((file) => file.relativePath),
      directories: selectedFolder.directories,
      zipNameSourceTitle: trimmedTitle,
    });

    return {
      ...selectedFolder,
      productTitleOverride,
      validation,
    };
  }

  function applySelection(selectedFolder: SelectedFolder): void {
    const detectedTitle =
      validateFolderStructure({
        filePaths: selectedFolder.files.map((file) => file.relativePath),
        directories: selectedFolder.directories,
      }).productFolderName ?? "";
    const nextSelection = buildSelectionState(selectedFolder, detectedTitle);

    startTransition(() => {
      setSelection(nextSelection);
      setStage("idle");
      setResults([]);
      setProcessNotes([]);
      setErrorMessages(nextSelection.validation.ok ? [] : nextSelection.validation.errors);
      setIsBusy(false);
    });
  }

  function handleProductTitleChange(nextTitle: string): void {
    setSelection((currentSelection) => {
      if (!currentSelection) {
        return currentSelection;
      }

      const nextSelection = buildSelectionState(currentSelection, nextTitle);
      setResults([]);
      setStage("idle");
      setProcessNotes([]);
      setErrorMessages(nextSelection.validation.ok ? [] : nextSelection.validation.errors);
      return nextSelection;
    });
  }

  function resetAll(): void {
    setSelection(null);
    setStage("idle");
    setIsBusy(false);
    setIsDragging(false);
    setProcessNotes([]);
    setErrorMessages([]);
    setResults([]);

    if (inputRef.current) {
      inputRef.current.value = "";
    }
  }

  async function handleBrowseClick(): Promise<void> {
    try {
      if (hasDirectoryPicker(window)) {
        const directoryHandle = await window.showDirectoryPicker();
        applySelection(await collectFromDirectoryHandle(directoryHandle));
        return;
      }

      inputRef.current?.click();
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        return;
      }

      setErrorMessages(["The folder picker could not be opened. Please try again."]);
    }
  }

  function handleInputChange(event: ChangeEvent<HTMLInputElement>): void {
    if (!event.target.files || event.target.files.length === 0) {
      return;
    }

    applySelection(collectFromInputFiles(event.target.files));
  }

  function handleDragEnter(event: DragEvent<HTMLDivElement>): void {
    event.preventDefault();
    setIsDragging(true);
  }

  function handleDragLeave(event: DragEvent<HTMLDivElement>): void {
    event.preventDefault();

    if (event.currentTarget.contains(event.relatedTarget as Node | null)) {
      return;
    }

    setIsDragging(false);
  }

  function handleDragOver(event: DragEvent<HTMLDivElement>): void {
    event.preventDefault();
  }

  async function handleDrop(event: DragEvent<HTMLDivElement>): Promise<void> {
    event.preventDefault();
    setIsDragging(false);

    try {
      const firstItem = event.dataTransfer.items[0] as
        | (DataTransferItem & { webkitGetAsEntry?: () => FileSystemEntry | null })
        | undefined;

      if (
        event.dataTransfer.items.length > 0 &&
        typeof firstItem?.webkitGetAsEntry === "function"
      ) {
        applySelection(await collectFromDropItems(event.dataTransfer.items));
        return;
      }

      if (event.dataTransfer.files.length > 0) {
        applySelection(collectFromInputFiles(event.dataTransfer.files));
      }
    } catch {
      setErrorMessages([
        "The dropped folder could not be read. Try the folder picker in desktop Chrome or Edge.",
      ]);
    }
  }

  function handleStreamEvent(event: ProcessStreamEvent): void {
    if (event.type === "progress") {
      setProcessNotes((currentNotes) => [...currentNotes, event.message]);
      setStage(event.step === "uploading" ? "uploading" : "preparing");
      return;
    }

    if (event.type === "validation-error") {
      setStage("error");
      setErrorMessages(event.errors);
      setIsBusy(false);
      return;
    }

    if (event.type === "error") {
      setStage("error");
      setErrorMessages([event.message]);
      setIsBusy(false);
      return;
    }

    setStage("success");
    setResults(event.items);
    setErrorMessages([]);
    setIsBusy(false);
  }

  async function handleProcess(): Promise<void> {
    if (!selection || !selection.validation.ok) {
      return;
    }

    setIsBusy(true);
    setStage("submitting");
    setProcessNotes(["Sending folder contents to the server."]);
    setErrorMessages([]);
    setResults([]);

    const formData = new FormData();
    formData.append(
      "manifest",
      JSON.stringify({
        files: selection.files.map((file) => ({
          id: file.id,
          relativePath: file.relativePath,
          size: file.size,
        })),
        directories: selection.directories,
      }),
    );
    formData.append("productTitleOverride", selection.productTitleOverride.trim());

    for (const file of selection.files) {
      formData.append(file.id, file.file, file.file.name);
    }

    try {
      const response = await fetch("/api/process", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { message?: string } | null;
        throw new Error(payload?.message || "The upload request failed before processing started.");
      }

      if (!response.body) {
        throw new Error("The server did not return a progress stream.");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();

        if (done) {
          break;
        }

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.trim()) {
            continue;
          }

          handleStreamEvent(JSON.parse(line) as ProcessStreamEvent);
        }
      }

      if (buffer.trim()) {
        handleStreamEvent(JSON.parse(buffer) as ProcessStreamEvent);
      }
    } catch (error) {
      setStage("error");
      setErrorMessages([
        error instanceof Error
          ? error.message
          : "The request failed unexpectedly. Please try again.",
      ]);
      setIsBusy(false);
    }
  }

  return (
    <main className="min-h-screen px-6 py-8 lg:px-10">
      <div className="mx-auto grid max-w-[1520px] gap-8 xl:grid-cols-[340px_minmax(0,1fr)]">
        <div className="xl:sticky xl:top-8 xl:self-start">
          <StepGuide steps={buildDefaultSteps(stepStatuses)} />
        </div>

        <section className="space-y-8">
          <div className="rounded-[34px] border border-slate-200/80 bg-white/78 p-8 shadow-[0_28px_80px_-55px_rgba(15,23,42,0.42)] backdrop-blur">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-500">
                  Internal workflow
                </p>
                <h1 className="mt-3 text-4xl font-semibold tracking-tight text-slate-950">
                  Validate, zip, and upload product assets without guesswork.
                </h1>
                <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-600">
                  The uploader accepts one product folder at a time, enforces the approved asset
                  structure, generates the exact zip name rules, uploads the result to S3, and
                  returns final URLs ready for spreadsheet entry.
                </p>
              </div>

              <div className="inline-flex items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-900">
                <ShieldCheck className="h-4 w-4" />
                Strict validation protects the production bucket
              </div>
            </div>
          </div>

          <UploadDropzone
            inputRef={inputRef}
            isDragging={isDragging}
            isBusy={isBusy}
            onBrowseClick={handleBrowseClick}
            onInputChange={handleInputChange}
            onDragEnter={handleDragEnter}
            onDragLeave={handleDragLeave}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
          />

          <div className="grid gap-8 lg:grid-cols-[minmax(0,1.18fr)_minmax(320px,0.82fr)]">
            <div className="space-y-8">
              <section className="rounded-[32px] border border-slate-200/80 bg-white/85 p-7 shadow-[0_24px_70px_-45px_rgba(15,23,42,0.38)]">
                <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">
                      Workflow snapshot
                    </p>
                    <h2 className="mt-3 text-2xl font-semibold tracking-tight text-slate-950">
                      Review the folder before upload starts
                    </h2>
                  </div>

                  <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-medium text-slate-700">
                    <Activity className="h-4 w-4 text-slate-500" />
                    {selection ? `${selection.files.length} file${selection.files.length === 1 ? "" : "s"} selected` : "No folder selected yet"}
                  </div>
                </div>

                <div className="mt-6 grid gap-4 xl:grid-cols-4">
                  <div className="rounded-3xl border border-slate-200 bg-slate-50 px-5 py-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
                      Product
                    </p>
                    <div className="mt-3 flex items-center gap-3">
                      <FolderOpen className="h-4 w-4 text-slate-500" />
                      <p className="text-sm font-semibold text-slate-900">
                        {selection?.productTitleOverride || "Waiting for upload"}
                      </p>
                    </div>
                  </div>

                  <div className="rounded-3xl border border-slate-200 bg-slate-50 px-5 py-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
                      Mode
                    </p>
                    <div className="mt-3 flex items-center gap-3">
                      <FolderTree className="h-4 w-4 text-slate-500" />
                      <p className="text-sm font-semibold text-slate-900">
                        {selection?.validation.ok ? getModeLabel(selection.validation.mode) : "Validation pending"}
                      </p>
                    </div>
                  </div>

                  <div className="rounded-3xl border border-slate-200 bg-slate-50 px-5 py-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
                      Zip count
                    </p>
                    <div className="mt-3 flex items-center gap-3">
                      <Package className="h-4 w-4 text-slate-500" />
                      <p className="text-sm font-semibold text-slate-900">
                        {selection?.validation.ok ? selection.validation.zipPlans.length : 0} planned
                      </p>
                    </div>
                  </div>

                  <div className="rounded-3xl border border-slate-200 bg-slate-50 px-5 py-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
                      Ready state
                    </p>
                    <div className="mt-3 flex items-center gap-3">
                      <ClipboardCheck className="h-4 w-4 text-slate-500" />
                      <p className="text-sm font-semibold text-slate-900">
                        {selection?.validation.ok ? "Approved for upload" : "Needs review"}
                      </p>
                    </div>
                  </div>
                </div>
              </section>

              <section className="rounded-[32px] border border-slate-200/80 bg-white/85 p-7 shadow-[0_24px_70px_-45px_rgba(15,23,42,0.38)]">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">
                      Step 2 preview
                    </p>
                    <h2 className="mt-3 text-2xl font-semibold tracking-tight text-slate-950">
                      Detected structure
                    </h2>
                  </div>

                  {selection?.validation.ok ? (
                    <div className="inline-flex items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-800">
                      <CheckCircle2 className="h-4 w-4" />
                      Ready for processing
                    </div>
                  ) : (
                    <div className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-600">
                      <Sparkles className="h-4 w-4" />
                      Awaiting valid folder
                    </div>
                  )}
                </div>

                {selection ? (
                  <div className="mt-6 space-y-5">
                    <div className="grid gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(280px,0.85fr)]">
                      <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
                        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">
                          Editable title
                        </p>
                        <div className="mt-3">
                          <label className="sr-only" htmlFor="product-title">
                            Product title
                          </label>
                          <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
                            <FilePenLine className="h-4 w-4 shrink-0 text-slate-400" />
                            <input
                              id="product-title"
                              type="text"
                              value={selection.productTitleOverride}
                              onChange={(event) => handleProductTitleChange(event.target.value)}
                              disabled={isBusy}
                              className="w-full bg-transparent text-lg font-semibold text-slate-950 outline-none placeholder:text-slate-400 disabled:cursor-not-allowed"
                              placeholder="Review or edit the product title"
                            />
                          </div>
                        </div>
                        <p className="mt-3 text-sm leading-6 text-slate-600">
                          Review and edit the output title here before upload. The folder structure
                          still uses the original uploaded folder.
                        </p>
                        <div className="mt-4 rounded-2xl border border-slate-200 bg-white px-4 py-3">
                          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
                            Normalized output title
                          </p>
                          <p className="mt-2 break-all font-mono text-sm text-slate-900">
                            {normalizeProductName(selection.productTitleOverride || "Product")}
                          </p>
                        </div>
                      </div>

                      <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
                        <div className="space-y-4">
                          <div>
                            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">
                              Uploaded folder
                            </p>
                            <p className="mt-3 text-lg font-semibold text-slate-950">
                              {selection.validation.productFolderName ?? "Could not detect"}
                            </p>
                          </div>

                          <div className="border-t border-slate-200 pt-4">
                            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">
                              Detected mode
                            </p>
                            <p className="mt-3 text-lg font-semibold text-slate-950">
                              {selection.validation.ok
                                ? getModeLabel(selection.validation.mode)
                                : "Validation required"}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
                      <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">
                        Zip output
                      </p>

                      {selection.validation.ok ? (
                        <div className="mt-4 space-y-3">
                          {selection.validation.zipPlans.map((zipPlan) => (
                            <div
                              key={zipPlan.zipName}
                              className="rounded-2xl border border-slate-200 bg-white px-4 py-3"
                            >
                              <p className="text-sm font-semibold text-slate-950">{zipPlan.zipName}</p>
                              <p className="mt-1 text-sm text-slate-600">
                                {zipPlan.label} - {zipPlan.relativeFiles.length} file
                                {zipPlan.relativeFiles.length === 1 ? "" : "s"}
                              </p>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="mt-4 text-sm leading-7 text-slate-600">
                          Choose a valid folder to preview the exact zip filename rules before any
                          upload happens.
                        </p>
                      )}
                    </div>

                    {selection.note ? (
                      <div className="rounded-3xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-7 text-amber-900">
                        {selection.note}
                      </div>
                    ) : null}
                  </div>
                ) : (
                  <p className="mt-6 text-sm leading-7 text-slate-600">
                    Once a folder is selected, the app will show the detected product name, asset
                    mode, and final zip names here.
                  </p>
                )}
              </section>

              {errorMessages.length > 0 ? (
                <section className="rounded-[32px] border border-rose-200/90 bg-white/90 p-7 shadow-[0_24px_70px_-45px_rgba(225,29,72,0.24)]">
                  <div className="inline-flex items-center gap-2 rounded-2xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-800">
                    <AlertTriangle className="h-4 w-4" />
                    Validation or processing issue
                  </div>
                  <div className="mt-5 space-y-3">
                    {errorMessages.map((message) => (
                      <div
                        key={message}
                        className="rounded-3xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm leading-7 text-rose-900"
                      >
                        {message}
                      </div>
                    ))}
                  </div>
                </section>
              ) : null}

              <section className="rounded-[32px] border border-slate-200/80 bg-white/85 p-7 shadow-[0_24px_70px_-45px_rgba(15,23,42,0.38)]">
                <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">
                      Step 5
                    </p>
                    <h2 className="mt-3 text-2xl font-semibold tracking-tight text-slate-950">
                      Final upload output
                    </h2>
                    <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-600">
                      Each finished artifact shows the zip filename, S3 key, and final public URL in
                      a copy-ready layout for spreadsheet entry.
                    </p>
                  </div>

                  {results.length > 1 ? (
                    <button
                      type="button"
                      onClick={async () => {
                        await navigator.clipboard.writeText(
                          results.map((item) => item.publicUrl).join("\n"),
                        );
                      }}
                      className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
                    >
                      <CheckCheck className="h-4 w-4" />
                      Copy all URLs
                    </button>
                  ) : null}
                </div>

                {results.length > 0 ? (
                  <>
                    <div className="mt-6 grid gap-4 md:grid-cols-3">
                      <div className="rounded-3xl border border-slate-200 bg-slate-50 px-5 py-4">
                        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
                          Uploaded zips
                        </p>
                        <p className="mt-3 text-2xl font-semibold tracking-tight text-slate-950">
                          {results.length}
                        </p>
                      </div>
                      <div className="rounded-3xl border border-slate-200 bg-slate-50 px-5 py-4">
                        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
                          Total packaged files
                        </p>
                        <p className="mt-3 text-2xl font-semibold tracking-tight text-slate-950">
                          {results.reduce((sum, item) => sum + item.fileCount, 0)}
                        </p>
                      </div>
                      <div className="rounded-3xl border border-slate-200 bg-slate-50 px-5 py-4">
                        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
                          Status
                        </p>
                        <div className="mt-3 inline-flex items-center gap-2 rounded-full bg-emerald-100 px-3 py-1 text-sm font-medium text-emerald-800">
                          <CheckCircle2 className="h-4 w-4" />
                          Ready to copy
                        </div>
                      </div>
                    </div>

                    <div
                      className={`mt-6 grid gap-5 ${
                        results.length > 1 ? "xl:grid-cols-2" : "grid-cols-1"
                      }`}
                    >
                      {results.map((item) => (
                        <ResultCard key={item.s3Key} item={item} />
                      ))}
                    </div>
                  </>
                ) : (
                  <div className="mt-6 rounded-[28px] border border-dashed border-slate-200 bg-slate-50/80 px-6 py-10">
                    <div className="flex items-start gap-4">
                      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-slate-500 shadow-sm">
                        <CloudUpload className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="text-base font-semibold text-slate-900">
                          Results will land here after upload completes
                        </p>
                        <p className="mt-2 max-w-2xl text-sm leading-7 text-slate-600">
                          Start the workflow once the folder structure is valid. This area will
                          switch to structured result cards with copy actions as soon as the upload
                          succeeds.
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </section>
            </div>

            <aside className="space-y-8">
              <section className="rounded-[32px] border border-slate-200/80 bg-white/85 p-7 shadow-[0_24px_70px_-45px_rgba(15,23,42,0.38)]">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">
                      Processing status
                    </p>
                    <h2 className="mt-3 text-2xl font-semibold tracking-tight text-slate-950">
                      {getStatusHeading(stage)}
                    </h2>
                  </div>

                  <div
                    className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.22em] ${
                      stage === "success"
                        ? "bg-emerald-100 text-emerald-800"
                        : stage === "error"
                          ? "bg-rose-100 text-rose-800"
                          : isBusy
                            ? "bg-sky-100 text-sky-800"
                            : "bg-slate-100 text-slate-600"
                    }`}
                  >
                    {isBusy ? (
                      <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
                    ) : stage === "success" ? (
                      <CheckCircle2 className="h-3.5 w-3.5" />
                    ) : stage === "error" ? (
                      <AlertTriangle className="h-3.5 w-3.5" />
                    ) : (
                      <CircleDashed className="h-3.5 w-3.5" />
                    )}
                    {stage}
                  </div>
                </div>

                <div className="mt-6 rounded-[28px] border border-slate-200 bg-slate-50/80 p-5">
                  <div className="flex items-center justify-between gap-4">
                    <div className="inline-flex items-center gap-3 text-sm font-medium text-slate-700">
                      <Activity className="h-4 w-4 text-slate-500" />
                      {isBusy
                        ? "The server is actively processing your upload."
                        : stage === "success"
                          ? "Processing is finished and URLs are ready."
                          : "Start the workflow to see each stage update live."}
                    </div>
                    <span className="text-sm font-semibold text-slate-900">{progressValue}%</span>
                  </div>

                  <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-200">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        stage === "error" ? "bg-rose-500" : "bg-slate-950"
                      }`}
                      style={{ width: `${progressValue}%` }}
                    />
                  </div>
                </div>

                <div className="mt-6 space-y-4">
                  {liveSteps.map((step, index) => {
                    const tone = getProcessStateTone(step.state);

                    return (
                      <div key={step.title} className="relative pl-14">
                        {index < liveSteps.length - 1 ? (
                          <div className={`absolute left-[19px] top-10 h-[calc(100%-1rem)] w-px ${tone.line}`} />
                        ) : null}

                        <div
                          className={`absolute left-0 top-1 flex h-10 w-10 items-center justify-center rounded-2xl border ${tone.dot}`}
                        >
                          {step.state === "complete" ? (
                            <CheckCircle2 className="h-4 w-4" />
                          ) : step.state === "active" ? (
                            <LoaderCircle className="h-4 w-4 animate-spin" />
                          ) : step.state === "error" ? (
                            <AlertTriangle className="h-4 w-4" />
                          ) : (
                            <ArrowRight className="h-4 w-4" />
                          )}
                        </div>

                        <div className={`rounded-3xl border px-4 py-4 ${tone.panel}`}>
                          <div className="flex items-center justify-between gap-4">
                            <p className="text-sm font-semibold text-slate-950">{step.title}</p>
                            <span className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">
                              {step.state}
                            </span>
                          </div>
                          <p className="mt-2 text-sm leading-6 text-slate-600">{step.description}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="mt-6 rounded-[28px] border border-slate-200 bg-slate-50/80 p-5">
                  <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">
                    Live event log
                  </p>
                  <div className="mt-4 space-y-3">
                    {processNotes.length > 0 ? (
                      processNotes.map((note, index) => (
                        <div
                          key={`${note}-${index}`}
                          className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm leading-6 text-slate-700"
                        >
                          <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-100 text-[11px] font-semibold text-slate-600">
                            {index + 1}
                          </span>
                          <span>{note}</span>
                        </div>
                      ))
                    ) : (
                      <div className="rounded-3xl border border-dashed border-slate-200 px-4 py-6 text-sm leading-7 text-slate-500">
                        Process notes will appear here once the folder is being handled.
                      </div>
                    )}
                  </div>
                </div>
              </section>

              <section className="rounded-[32px] border border-slate-200/80 bg-white/85 p-7 shadow-[0_24px_70px_-45px_rgba(15,23,42,0.38)]">
                <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">
                  Action
                </p>
                <div className="mt-5 space-y-4">
                  <button
                    type="button"
                    disabled={!selection?.validation.ok || isBusy}
                    onClick={handleProcess}
                    className="w-full rounded-2xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
                  >
                    {isBusy ? "Processing..." : "Generate zip(s) and upload"}
                  </button>

                  <button
                    type="button"
                    onClick={resetAll}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-slate-200 px-5 py-3 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
                  >
                    <RefreshCcw className="h-4 w-4" />
                    Reset and process another folder
                  </button>
                </div>
              </section>
            </aside>
          </div>
        </section>
      </div>
    </main>
  );
}
