import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SubscribeButton } from "@/components/SubscribeButton";
import { getSubscriptions } from "@/lib/api-client";

export const metadata: Metadata = { title: "Subscriptions · StreamSouk" };
export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<{ page?: string }> };

export default async function SubscriptionsPage({ searchParams }: Props) {
  const cookieStore = await cookies();
  if (!cookieStore.has("token")) redirect("/sign-in");

  const parsed = Number((await searchParams).page);
  const page = Number.isSafeInteger(parsed) && parsed >= 1 ? parsed : 1;
  const result = await getSubscriptions(page, cookieStore.toString());
  if (!result.ok && result.reason === "signed-out") redirect("/sign-in");

  return (
    <section className="subscriptions">
      <p className="eyebrow">Subscriptions</p>
      <h1>
        Your <em>subscriptions</em>
      </h1>

      {!result.ok ? (
        <p role="alert">Your subscriptions could not be loaded right now. Try again in a moment.</p>
      ) : result.channels.length === 0 ? (
        <p>
          {page === 1 ? (
            <>
              You have not subscribed to any channels yet. <Link href="/">Find something to watch</Link>.
            </>
          ) : (
            <>
              There is nothing on this page. <Link href="/subscriptions">Back to the first page</Link>.
            </>
          )}
        </p>
      ) : (
        <>
          <ul className="subscription-list" aria-label="Subscribed channels">
            {result.channels.map((channel) => (
              <li key={channel.name}>
                <Link href={`/channels/${encodeURIComponent(channel.name)}`}>
                  <strong>{channel.name}</strong>
                </Link>
                <SubscribeButton
                  channelName={channel.name}
                  signedIn
                  isOwner={false}
                  subscribers={channel.subscribers}
                  subscribed
                />
              </li>
            ))}
          </ul>
          {(page > 1 || result.hasMore) && (
            <nav className="pager" aria-label="Pages">
              {page > 1 ? (
                <Link href={page === 2 ? "/subscriptions" : `/subscriptions?page=${page - 1}`} rel="prev">
                  ← Newer
                </Link>
              ) : (
                <span />
              )}
              <span className="hint">Page {page}</span>
              {result.hasMore ? (
                <Link href={`/subscriptions?page=${page + 1}`} rel="next">
                  Older →
                </Link>
              ) : (
                <span />
              )}
            </nav>
          )}
        </>
      )}
    </section>
  );
}
