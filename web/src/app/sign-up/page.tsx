import type { Metadata } from "next";
import Link from "next/link";
import { AccountForm } from "@/components/AccountForm";

export const metadata: Metadata = { title: "Sign up · StreamSouk" };

export default function SignUpPage() {
  return (
    <section className="form-page">
      <p className="eyebrow">Join</p>
      <h1>
        Create your <em>channel</em>
      </h1>
      <AccountForm mode="sign-up" />
      <p>
        Already have an account? <Link href="/sign-in">Sign in</Link>
      </p>
    </section>
  );
}
