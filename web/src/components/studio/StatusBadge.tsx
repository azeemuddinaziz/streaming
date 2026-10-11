import { CheckCircle2Icon, LoaderCircleIcon, AlertTriangleIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { StudioStatus } from "@/lib/studio-list";

const STATUS = {
  PROCESSING: { label: "Processing", icon: LoaderCircleIcon, tone: "text-(--color-warning)" },
  READY: { label: "Ready", icon: CheckCircle2Icon, tone: "text-(--color-success)" },
  FAILED: { label: "Failed", icon: AlertTriangleIcon, tone: "text-(--color-danger)" },
} as const;

export const STATUS_LABEL: Record<StudioStatus, string> = {
  PROCESSING: STATUS.PROCESSING.label,
  READY: STATUS.READY.label,
  FAILED: STATUS.FAILED.label,
};

// A Video's processing state as a label and an icon, tinted by its token; the
// color is never the only cue (docs/design.md).
export function StatusBadge({ status }: { status: StudioStatus }) {
  const { label, icon: Icon, tone } = STATUS[status];
  return (
    <Badge variant="outline" className={tone} data-status={status}>
      <Icon aria-hidden="true" />
      {label}
    </Badge>
  );
}
