import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AlertTriangleIcon } from "lucide-react";
import { SubscriptionList } from "@/components/SubscriptionList";
import { Button } from "@/components/ui/button";
import { getSubscriptions } from "@/lib/api-client";

export const metadata: Metadata = { title: "Subscriptions · StreamSouk" };
export const dynamic = "force-dynamic";

export default async function SubscriptionsPage() {
  const cookieStore = await cookies();
  if (!cookieStore.has("token")) redirect("/sign-in");

  // Only the first page is fetched here; SubscriptionList loads the rest in the browser.
  const result = await getSubscriptions(1, cookieStore.toString());
  if (!result.ok && result.reason === "signed-out") redirect("/sign-in");

  return (
    <section>
      <h1 className="mb-6 font-serif text-4xl sm:text-5xl">Subscriptions</h1>

      {!result.ok ? (
        <div
          role="alert"
          className="flex min-h-48 flex-col items-center justify-center gap-3 rounded-lg border bg-card p-8 text-center"
        >
          <AlertTriangleIcon aria-hidden="true" className="size-8 text-muted-foreground" />
          <p className="font-semibold">Your subscriptions could not be loaded</p>
          <p className="text-sm text-muted-foreground">Try again in a moment.</p>
          <Button asChild variant="outline">
            {/* A full load, so the API is asked again. */}
            <a href="/subscriptions">Try again</a>
          </Button>
        </div>
      ) : result.channels.length === 0 ? (
        <div className="grid justify-items-start gap-3 rounded-lg border bg-card p-6">
          <p>You have not subscribed to any channels yet.</p>
          <Button asChild>
            <Link href="/">Find something to watch</Link>
          </Button>
        </div>
      ) : (
        <SubscriptionList channels={result.channels} hasMore={result.hasMore} />
      )}
    </section>
  );
}
