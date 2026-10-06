import type { Metadata } from "next";
import Link from "next/link";
import { AccountForm } from "@/components/AccountForm";

export const metadata: Metadata = { title: "Sign in · StreamSouk" };

export default function SignInPage() {
  return (
    <section className="form-page">
      <p className="eyebrow">Welcome back</p>
      <h1>
        Sign <em>in</em>
      </h1>
      <AccountForm mode="sign-in" />
      <p>
        New here? <Link href="/sign-up">Create an account</Link>
      </p>
    </section>
  );
}
