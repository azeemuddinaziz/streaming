import { CheckCircle2Icon, CircleDashedIcon, LoaderCircleIcon } from "lucide-react";
import { processingSteps, progressView } from "@/lib/processing-phase";

// A processing Video's life as labelled phases (Uploaded, Processing, Ready)
// and a bar for the current one: determinate when the number is known,
// "Starting…" when it is not. The bar has a name and a value; nothing here is a
// live region, so a tick is never spoken (phase changes are, by the list).
export function ProcessingPhases({ label, progress }: { label: string; progress: number | null }) {
  const view = progressView(progress);

  return (
    <div className="grid gap-2">
      <ol aria-label={`Phases of ${label}`} className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
        {processingSteps().map((step) => (
          <li
            key={step.key}
            aria-current={step.state === "current" ? "step" : undefined}
            className={`inline-flex items-center gap-1 ${
              step.state === "next" ? "text-muted-foreground" : step.state === "current" ? "font-medium" : "text-(--color-success)"
            }`}
          >
            {step.state === "done" ? (
              <CheckCircle2Icon aria-hidden="true" className="size-3.5" />
            ) : step.state === "current" ? (
              <LoaderCircleIcon aria-hidden="true" className="size-3.5 motion-safe:animate-spin" />
            ) : (
              <CircleDashedIcon aria-hidden="true" className="size-3.5" />
            )}
            {step.label}
            <span className="sr-only">
              {step.state === "done" ? ", done" : step.state === "current" ? ", in progress" : ", up next"}
            </span>
          </li>
        ))}
      </ol>
      <div className="flex items-center gap-3">
        <div
          role="progressbar"
          aria-label={`Processing ${label}`}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={view.determinate ? view.percent : undefined}
          aria-valuetext={view.determinate ? `${view.percent} percent` : "Starting"}
          className="h-2 flex-1 overflow-hidden rounded-full bg-secondary"
        >
          {view.determinate ? (
            <div className="h-full rounded-full bg-primary transition-[width]" style={{ width: `${view.percent}%` }} />
          ) : (
            <div className="h-full w-full rounded-full bg-primary/30 motion-safe:animate-pulse" />
          )}
        </div>
        <span className="min-w-14 text-right text-sm tabular-nums text-muted-foreground">{view.text}</span>
      </div>
    </div>
  );
}
