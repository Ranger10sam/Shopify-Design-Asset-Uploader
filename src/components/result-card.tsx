"use client";

import { useState } from "react";

import { Check, Copy, Files, Link2, PackageOpen } from "lucide-react";

import type { UploadResultItem } from "@/lib/process-events";

interface ResultCardProps {
  item: UploadResultItem;
}

export function ResultCard({ item }: ResultCardProps) {
  const [copied, setCopied] = useState(false);

  async function handleCopy(): Promise<void> {
    await navigator.clipboard.writeText(item.publicUrl);
    setCopied(true);

    window.setTimeout(() => {
      setCopied(false);
    }, 1800);
  }

  return (
    <article className="flex h-full flex-col rounded-[30px] border border-emerald-200/90 bg-white p-6 shadow-[0_24px_60px_-48px_rgba(16,185,129,0.8)]">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-emerald-800">
            <Check className="h-3.5 w-3.5" />
            Upload complete
          </div>
          <h4 className="mt-4 break-all text-xl font-semibold tracking-tight text-slate-950">
            {item.zipName}
          </h4>
        </div>

        <button
          type="button"
          onClick={handleCopy}
          className="inline-flex shrink-0 items-center justify-center gap-2 self-start rounded-2xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
        >
          {copied ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
          {copied ? "Copied" : "Copy URL"}
        </button>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
            Files packaged
          </p>
          <div className="mt-2 flex items-center gap-2 text-slate-900">
            <Files className="h-4 w-4 text-slate-500" />
            <span className="text-lg font-semibold">{item.fileCount}</span>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
            Artifact type
          </p>
          <div className="mt-2 flex items-center gap-2 text-slate-900">
            <PackageOpen className="h-4 w-4 text-slate-500" />
            <span className="text-lg font-semibold">Zip file</span>
          </div>
        </div>
      </div>

      <dl className="mt-5 space-y-4 text-sm">
        <div>
          <dt className="font-semibold text-slate-500">S3 key</dt>
          <dd className="mt-2 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 font-mono text-[13px] leading-6 break-all text-slate-700">
            {item.s3Key}
          </dd>
        </div>

        <div>
          <dt className="font-semibold text-slate-500">Public URL</dt>
          <dd className="mt-2 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 font-mono text-[13px] leading-6 text-slate-700">
            <span className="inline-flex items-start gap-2 break-all">
              <Link2 className="mt-1 h-4 w-4 shrink-0 text-slate-400" />
              {item.publicUrl}
            </span>
          </dd>
        </div>
      </dl>
    </article>
  );
}
