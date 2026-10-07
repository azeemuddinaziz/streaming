import Link from "next/link";
import { cookies } from "next/headers";
import { SignOutButton } from "@/components/SignOutButton";
import { getCurrentUser } from "@/lib/api-client";

export async function SiteHeader() {
  const cookieStore = await cookies();
  // No sign-in cookie means nobody is signed in, so there is nothing to ask.
  const account = cookieStore.has("token")
    ? await getCurrentUser(cookieStore.toString())
    : null;

  return (
    <header className="site-header">
      <div className="page">
        <Link className="brand" href="/">
          StreamSouk
        </Link>
        <nav className="account-nav" aria-label="Account">
          {account ? (
            <>
              <Link href="/studio">Studio</Link>
              <Link href="/upload">Upload</Link>
              <span>
                Signed in as <strong>{account.user.name}</strong>
              </span>
              <SignOutButton />
            </>
          ) : (
            <>
              <Link href="/sign-in">Sign in</Link>
              <Link className="button" href="/sign-up">
                Sign up
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
