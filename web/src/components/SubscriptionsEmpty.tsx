import Link from "next/link";
import { Button } from "@/components/ui/button";

// Shown when the person subscribes to no one (also after removing the last one).
export function SubscriptionsEmpty() {
  return (
    <div className="grid justify-items-start gap-3 rounded-lg border bg-card p-6">
      <p>You have not subscribed to any channels yet.</p>
      <Button asChild>
        <Link href="/">Find something to watch</Link>
      </Button>
    </div>
  );
}
