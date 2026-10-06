"use client";

import { useRouter } from "next/navigation";
import { signOut } from "@/lib/api-client";

export function SignOutButton() {
  const router = useRouter();

  async function onClick() {
    await signOut();
    router.push("/");
    router.refresh();
  }

  return (
    <button className="button button-secondary" type="button" onClick={onClick}>
      Sign out
    </button>
  );
}
