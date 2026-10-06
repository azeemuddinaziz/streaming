# Design direction

Visual direction for the StreamSouk web app. Light theme only for v2.0.0; dark mode is a later release.

## Style

Clean, editorial and calm, so the videos are the loudest thing on the page. Reference sites: Vidyet and AutoSend.

- A warm off-white page with plain white cards, separated by hairline borders and not by shadows
- A serif display face for headlines, with one italic word or phrase for emphasis ("Public videos, *worth watching*")
- A neutral sans for body and interface text
- Small monospace uppercase labels above sections ("PUBLIC VIDEOS", "001")
- Generous whitespace, and a single accent color used sparingly (primary buttons, links, focus, active state)
- Rounded corners, modest and consistent

The app has no marketing or landing page. The home page is a showcase of public Videos, so the design is a product surface, not a pitch. The serif display type is for page titles and section headings and is not meant to carry the interface.

## Fonts

All from Google Fonts, loaded with Next.js `next/font`.

| Role | Font |
|---|---|
| Display (headlines) | Instrument Serif, with its italic |
| Body and UI | Inter |
| Labels and numbers | JetBrains Mono |

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

## Rules

- Never use color alone to convey a Video's state (processing, ready, failed). Pair it with a label or an icon.
- Focus rings are always visible, in the accent color.
- Declare `color-scheme: light` for now. Do not hard-code light-only assumptions into components.
