import { Clapperboard, House, LogIn, SquarePlay, Upload } from "lucide-react";
import type { NavIcon as Name } from "@/lib/nav";

const ICONS = {
  home: House,
  subscriptions: SquarePlay,
  studio: Clapperboard,
  upload: Upload,
  "sign-in": LogIn,
} as const;

// Decorative: every destination is also labelled in text.
export function NavIcon({ name, className }: { name: Name; className?: string }) {
  const Icon = ICONS[name];
  return <Icon aria-hidden="true" className={className ?? "size-5"} />;
}
