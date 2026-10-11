export type NavIcon = "home" | "subscriptions" | "studio" | "upload" | "sign-in";

export type NavItem = {
  href: string;
  label: string;
  icon: NavIcon;
  // The bottom bar's centred Upload.
  emphasised?: boolean;
};

const HOME: NavItem = { href: "/", label: "Home", icon: "home" };
const SUBSCRIPTIONS: NavItem = { href: "/subscriptions", label: "Subscriptions", icon: "subscriptions" };
const STUDIO: NavItem = { href: "/studio", label: "Studio", icon: "studio" };
const UPLOAD: NavItem = { href: "/upload", label: "Upload", icon: "upload", emphasised: true };
const SIGN_IN: NavItem = { href: "/sign-in", label: "Sign in", icon: "sign-in" };

// Signed out, Subscriptions and Studio are hidden, not disabled.
export function sidebarItems(signedIn: boolean): NavItem[] {
  return signedIn ? [HOME, SUBSCRIPTIONS, STUDIO] : [HOME];
}

export function bottomBarItems(signedIn: boolean): NavItem[] {
  return signedIn ? [HOME, SUBSCRIPTIONS, UPLOAD, STUDIO] : [HOME, SIGN_IN];
}

// Home is only the root; the others also cover the pages beneath them.
export function isActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

// The watch page gives the player the width, so its sidebar is always an overlay.
export function isWatchPath(pathname: string): boolean {
  return pathname.startsWith("/watch/");
}

// A cookie, not localStorage, so the server render already knows the state.
export const SIDEBAR_COOKIE = "sidebar";

export function parseSidebarCookie(value: string | undefined): boolean {
  return value === "collapsed";
}

export function sidebarCookie(collapsed: boolean): string {
  return `${SIDEBAR_COOKIE}=${collapsed ? "collapsed" : "expanded"}; path=/; max-age=31536000; samesite=lax`;
}

// The on-screen keyboard shrinks the visual viewport but not the layout one; a
// browser toolbar collapsing changes it only a little.
export function isKeyboardOpen(visualHeight: number, layoutHeight: number): boolean {
  return layoutHeight > 0 && visualHeight < layoutHeight * 0.75;
}
