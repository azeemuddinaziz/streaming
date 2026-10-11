"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signInHref } from "@/lib/return-address";

// A "Sign in to ..." prompt: sign-in brings the person back to this page.
export function SignInLink({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? "/";
  return (
    <Link className="text-primary underline underline-offset-4" href={signInHref(pathname)}>
      {children}
    </Link>
  );
}
