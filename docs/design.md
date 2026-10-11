# Design direction

Visual direction for the StreamSouk web app. Light theme only for v2.0.0; dark mode is a later release.

## Style

Clean, editorial and calm, so the videos are the loudest thing on the page. Reference sites: Vidyet and AutoSend.

- A warm off-white page with plain white cards, separated by hairline borders and not by shadows
- A serif display face for page titles only. Section headings and all interface text are sans
- A neutral sans for body and interface text
- Monospace only for numbers that benefit from alignment (counts, durations, timecodes), never for decorative labels
- Generous whitespace, and a single accent color used sparingly (primary buttons, links, focus, active state)
- Rounded corners, modest and consistent

The app has no marketing or landing page. The home page is a showcase of public Videos, so the design is a product surface, not a pitch. The serif display type is for page titles and is not meant to carry the interface. The UI/UX revamp (#72) dropped the editorial flourishes (italic emphasis, uppercase mono section labels) the first version of this document called for.

## Fonts

All from Google Fonts, loaded with Next.js `next/font`.

| Role | Font |
|---|---|
| Display (page titles only) | Instrument Serif |
| Body and UI | Inter |
| Numbers and timecodes | JetBrains Mono |

## Color tokens

Components use only these semantic tokens and never a raw hex value. The brand can then be changed by editing this one set, and dark mode later becomes a second set of values for the same names.

| Token | Value | Use |
|---|---|---|
| `--color-bg` | `#FAF8F4` | Page background |
| `--color-surface` | `#FFFFFF` | Cards, inputs, menus |
| `--color-ink` | `#1C1917` | Primary text |
| `--color-muted` | `#5F594F` | Secondary text |
| `--color-border` | `#E4DED3` | Hairlines and card edges |
| `--color-border-strong` | `#8C857A` | Form-control borders |
| `--color-accent` | `#C2410C` | Primary buttons, links, active state |
| `--color-accent-hover` | `#9A3412` | Hover and pressed |
| `--color-accent-soft` | `#FDEBDD` | Tinted backgrounds, badges |
| `--color-on-accent` | `#FFFFFF` | Text on the accent |
| `--color-success` | `#15803D` | Ready |
| `--color-warning` | `#B45309` | Processing |
| `--color-danger` | `#B91C1C` | Failed, destructive actions |
| `--color-info` | `#1D4ED8` | Informational notices |

The accent is a burnt terracotta, a nod to a market stall (the "souk" in the name), and unlike the amber and indigo used by the reference sites.

Contrast, measured against WCAG: ink 16.5:1 on the page, muted 6.5:1, white on accent 5.2:1, accent text on the page 4.9:1, the status colors 4.7:1 or better, and the strong border 3.4:1 (the 3:1 needed for form controls). The plain `--color-border` is decorative only and never the sole cue for a control.

### shadcn variables

shadcn/ui components read their own variable names, mapped once in `web/src/app/globals.css` onto the tokens above: `--background` → bg, `--foreground` → ink, `--card` and `--popover` → surface, `--primary` → accent, `--primary-foreground` → on-accent, `--secondary` and `--accent` (shadcn's hover tint, not our brand accent) → accent-soft, `--muted` → bg, `--muted-foreground` → muted, `--destructive` → danger, `--border` → border, `--input` → border-strong, `--ring` → accent. New code uses either set of names, never a raw color or a Tailwind palette color (`bg-blue-500`). Edit the token values, not the mapping.

## Layout and navigation

- Desktop: a top bar (logo, a prominent Upload button when signed in, an avatar menu holding the account name and Sign out) and a left sidebar (Home, Subscriptions, Studio). On the watch page the sidebar is an overlay opened by a hamburger so the player gets the width. The collapsed state is kept in a cookie.
- Phones (below about 768px): a top bar with the logo and the avatar menu, and a bottom bar (signed in: Home, Subscriptions, a centred Upload, Studio; signed out: Home, Sign in) that hides in fullscreen and while the keyboard is open.
- Signed out, Studio and Subscriptions are hidden, not disabled. The active destination carries `aria-current="page"`.
- The top bar keeps room for a future search field.

## Patterns

- **Lists:** Home, Subscriptions and the Channel page use infinite scroll: the first page is server-rendered, a visible "Load more" button stays available, a live region announces each batch, and Back restores the position. The Studio uses numbered pages. Comments use "Load more".
- **Loading:** skeletons that mirror the final layout; a spinner only inside a button that was pressed. Thumbnails sit in a 16:9 frame with a neutral placeholder.
- **Feedback:** `AlertDialog` for destructive confirmations (never `window.confirm`), a toast for a success, inline text for field errors and for rate limits (`Retry-After`), which stay next to the content.
- **Forms:** labels always visible, validation shown as the person types where a rule is knowable, inline errors tied to fields, unsaved-changes protection on long forms.
- **Components:** shadcn/ui on Radix (ADR 0002), mapped onto the tokens above, in `web/src/components/ui`: Button, Input, Textarea, Label, Checkbox, Dialog, AlertDialog, Popover, DropdownMenu, Tabs, Skeleton, Badge, Spinner, and the Sonner toaster (mounted once in the root layout; call `toast()` from `sonner`).

## Rules

- Never use color alone to convey a Video's state (processing, ready, failed). Pair it with a label or an icon.
- Focus rings are always visible, in the accent color.
- Declare `color-scheme: light` for now. Do not hard-code light-only assumptions into components.
