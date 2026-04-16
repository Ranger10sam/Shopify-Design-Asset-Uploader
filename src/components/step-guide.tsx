import {
  Check,
  CloudUpload,
  Copy,
  FolderSearch,
  PackageCheck,
  type LucideIcon,
} from "lucide-react";

export type StepStatus = "pending" | "current" | "complete" | "error";

interface StepItem {
  title: string;
  description: string;
  status: StepStatus;
  icon: LucideIcon;
}

interface StepGuideProps {
  steps: StepItem[];
}

function getStepTone(status: StepStatus): string {
  switch (status) {
    case "complete":
      return "border-emerald-300/70 bg-emerald-50 text-emerald-900";
    case "current":
      return "border-sky-400/80 bg-sky-50 text-slate-950 shadow-[0_20px_45px_-30px_rgba(14,116,144,0.45)]";
    case "error":
      return "border-rose-300/80 bg-rose-50 text-rose-900";
    default:
      return "border-slate-200 bg-white/70 text-slate-600";
  }
}

function getIconTone(status: StepStatus): string {
  switch (status) {
    case "complete":
      return "bg-emerald-600 text-white";
    case "current":
      return "bg-slate-950 text-white";
    case "error":
      return "bg-rose-600 text-white";
    default:
      return "bg-slate-200 text-slate-500";
  }
}

export function buildDefaultSteps(statuses: StepStatus[]): StepItem[] {
  return [
    {
      title: "Upload folder",
      description: "Choose a single product folder from your desktop.",
      status: statuses[0],
      icon: FolderSearch,
    },
    {
      title: "Validate structure",
      description: "Confirm the asset folder matches the strict accepted layout.",
      status: statuses[1],
      icon: PackageCheck,
    },
    {
      title: "Prepare zip(s)",
      description: "Create the correct zip output for the detected asset mode.",
      status: statuses[2],
      icon: Check,
    },
    {
      title: "Upload to S3",
      description: "Send the generated zip file(s) to the configured S3 bucket.",
      status: statuses[3],
      icon: CloudUpload,
    },
    {
      title: "Copy result URL(s)",
      description: "Copy the final public URLs into your spreadsheet.",
      status: statuses[4],
      icon: Copy,
    },
  ];
}

export function StepGuide({ steps }: StepGuideProps) {
  return (
    <aside className="rounded-[32px] border border-slate-200/80 bg-white/85 p-6 shadow-[0_24px_70px_-45px_rgba(15,23,42,0.45)] backdrop-blur">
      <div className="mb-6">
        <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">
          Guided workflow
        </p>
        <h2 className="mt-3 text-2xl font-semibold tracking-tight text-slate-950">
          Design Asset Uploader
        </h2>
      </div>

      <div className="space-y-4">
        {steps.map((step, index) => (
          <div
            key={step.title}
            className={`rounded-3xl border p-4 transition ${getStepTone(step.status)}`}
          >
            <div className="flex items-start gap-4">
              <div
                className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl transition ${getIconTone(step.status)}`}
              >
                <step.icon className="h-5 w-5" />
              </div>

              <div>
                <span className="text-xs font-semibold uppercase tracking-[0.26em] text-slate-500">
                  Step {index + 1}
                </span>
                <p className="mt-2 text-base font-semibold">{step.title}</p>
                <p className="mt-1 text-sm leading-6 text-current/80">{step.description}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </aside>
  );
}
