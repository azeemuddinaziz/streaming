import type { Metadata } from "next";
import Link from "next/link";
import { AccountForm } from "@/components/AccountForm";
import { safeNext, signUpHref } from "@/lib/return-address";

export const metadata: Metadata = { title: "Sign in · StreamSouk" };

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string | string[] }>;
}) {
  const next = safeNext((await searchParams).next);

  return (
    <section className="mx-auto w-full max-w-md py-8 sm:py-16">
      <div className="rounded-lg border bg-card p-6 sm:p-8">
        <h1 className="mb-6 font-serif text-3xl">Sign in</h1>
        <AccountForm mode="sign-in" next={next} />
      </div>
      <p className="mt-6 text-center text-sm text-muted-foreground">
        New here?{" "}
        <Link className="text-primary underline underline-offset-4" href={signUpHref(next)}>
          Create an account
        </Link>
      </p>
    </section>
  );
}
