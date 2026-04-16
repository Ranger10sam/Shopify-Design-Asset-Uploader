import type { ChangeEvent, DragEvent, RefObject } from "react";

import { FolderArchive, MousePointerClick, UploadCloud } from "lucide-react";

interface UploadDropzoneProps {
  inputRef: RefObject<HTMLInputElement | null>;
  isDragging: boolean;
  isBusy: boolean;
  onBrowseClick: () => void;
  onInputChange: (event: ChangeEvent<HTMLInputElement>) => void;
  onDragEnter: (event: DragEvent<HTMLDivElement>) => void;
  onDragLeave: (event: DragEvent<HTMLDivElement>) => void;
  onDragOver: (event: DragEvent<HTMLDivElement>) => void;
  onDrop: (event: DragEvent<HTMLDivElement>) => void;
}

export function UploadDropzone({
  inputRef,
  isDragging,
  isBusy,
  onBrowseClick,
  onInputChange,
  onDragEnter,
  onDragLeave,
  onDragOver,
  onDrop,
}: UploadDropzoneProps) {
  return (
    <div
      className={`relative overflow-hidden rounded-[32px] border bg-white/90 p-8 transition ${
        isDragging
          ? "border-sky-500 shadow-[0_30px_80px_-55px_rgba(14,116,144,0.85)]"
          : "border-slate-200/80 shadow-[0_24px_70px_-45px_rgba(15,23,42,0.38)]"
      }`}
      onDragEnter={onDragEnter}
      onDragLeave={onDragLeave}
      onDragOver={onDragOver}
      onDrop={onDrop}
    >
      <input
        ref={inputRef}
        type="file"
        className="hidden"
        multiple
        webkitdirectory=""
        onChange={onInputChange}
      />

      <div className="pointer-events-none absolute inset-x-10 top-0 h-px bg-gradient-to-r from-transparent via-slate-200 to-transparent" />

      <div className="flex items-start justify-between gap-6">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">
            Step 1
          </p>
          <h3 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">
            Select the product folder
          </h3>
          <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-600">
            Drag one product folder into this area, or use the folder picker. The app will inspect
            only the <span className="font-semibold text-slate-900">asset</span> folder and block
            anything that does not match the accepted structure exactly.
          </p>
        </div>

        <div className="hidden rounded-3xl border border-slate-200 bg-slate-50 p-4 text-slate-700 xl:block">
          <FolderArchive className="h-8 w-8" />
        </div>
      </div>

      <div className="mt-8 grid gap-4 lg:grid-cols-[1fr_auto]">
        <button
          type="button"
          onClick={onBrowseClick}
          disabled={isBusy}
          className="inline-flex items-center justify-center gap-3 rounded-2xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
        >
          <MousePointerClick className="h-4 w-4" />
          Pick product folder
        </button>

        <div className="inline-flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
          <UploadCloud className="h-4 w-4 text-slate-500" />
          Best experience in desktop Chrome or Edge
        </div>
      </div>
    </div>
  );
}
