import type { Metadata } from "next";
import Link from "next/link";
import { AccountForm } from "@/components/AccountForm";
import { safeNext, signInHref } from "@/lib/return-address";

export const metadata: Metadata = { title: "Sign up · StreamSouk" };

export default async function SignUpPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string | string[] }>;
}) {
  const next = safeNext((await searchParams).next);

  return (
    <section className="mx-auto w-full max-w-md py-8 sm:py-16">
      <div className="rounded-lg border bg-card p-6 sm:p-8">
        <h1 className="mb-6 font-serif text-3xl">Create your channel</h1>
        <AccountForm mode="sign-up" next={next} />
      </div>
      <p className="mt-6 text-center text-sm text-muted-foreground">
        Already have an account?{" "}
        <Link className="text-primary underline underline-offset-4" href={signInHref(next)}>
          Sign in
        </Link>
      </p>
    </section>
  );
}
