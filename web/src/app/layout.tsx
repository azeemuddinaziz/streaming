import type { Metadata } from "next";
import { Inter, Instrument_Serif, JetBrains_Mono } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import { cookies } from "next/headers";
import { AppShell } from "@/components/AppShell";
import { SiteFooter } from "@/components/SiteFooter";
import { getCurrentUser } from "@/lib/api-client";
import { SIDEBAR_COOKIE, parseSidebarCookie } from "@/lib/nav";
import { WEB_ORIGIN } from "@/lib/share-metadata";
import "./globals.css";

const display = Instrument_Serif({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-display",
});
const body = Inter({ subsets: ["latin"], variable: "--font-body" });
// Not --font-mono: that name is Tailwind's own theme variable, mapped in globals.css.
const mono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-jetbrains" });

export const metadata: Metadata = {
  metadataBase: new URL(WEB_ORIGIN),
  title: "StreamSouk",
  description: "Public videos, worth watching.",
};

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const cookieStore = await cookies();
  // No sign-in cookie means nobody is signed in, so there is nothing to ask.
  const account = cookieStore.has("token")
    ? await getCurrentUser(cookieStore.toString())
    : null;
  const collapsed = parseSidebarCookie(cookieStore.get(SIDEBAR_COOKIE)?.value);

  return (
    <html
      lang="en"
      className={`${display.variable} ${body.variable} ${mono.variable}`}
    >
      <body>
        <a className="skip-link" href="#main">
          Skip to content
        </a>
        <AppShell accountName={account?.user.name ?? null} initialCollapsed={collapsed}>
          <main id="main" className="page flex-1">
            {children}
          </main>
          <SiteFooter />
        </AppShell>
        <Toaster />
      </body>
    </html>
  );
}
