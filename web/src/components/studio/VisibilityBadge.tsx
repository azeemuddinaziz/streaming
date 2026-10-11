import { GlobeIcon, LinkIcon, LockIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";

const VISIBILITY = {
  PRIVATE: { label: "Private", icon: LockIcon },
  UNLISTED: { label: "Unlisted", icon: LinkIcon },
  PUBLIC: { label: "Public", icon: GlobeIcon },
} as const;

export function VisibilityBadge({ visibility }: { visibility: keyof typeof VISIBILITY }) {
  const { label, icon: Icon } = VISIBILITY[visibility];
  return (
    <Badge variant="secondary">
      <Icon aria-hidden="true" />
      {label}
    </Badge>
  );
}
