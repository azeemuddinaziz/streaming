# Tailwind and shadcn/ui (Radix) for the web app

The web app's UI is rebuilt on Tailwind CSS and shadcn/ui, using Radix primitives, with the semantic tokens in `docs/design.md` mapped onto shadcn's CSS variables. We chose this over staying with hand-written CSS and hand-built components (the v2 state: one `globals.css`, a Share popover and menus written by hand) because the revamp needs dialogs, popovers, menus, tabs and toasts, which are exactly where hand-rolled code goes wrong on focus, keyboard and screen-reader behaviour. shadcn copies the components into the repo, so there is no runtime dependency to be locked into. Radix was chosen over Base UI for its documentation and maturity; the `migrate-radix-to-base` skill makes a later move possible.

## Consequences

- Tailwind and `globals.css` coexist while screens migrate one ticket at a time (#72); each ticket deletes the rules it replaces, and the cleanup ticket removes what is left.
- Components must use semantic tokens only, never raw colors or Tailwind palette colors, so a later dark mode is a second set of values for the same names.
- shadcn components live in `web/src/components/ui` and are ours to edit; upgrading them is a manual diff, not a version bump.
- Reversing this means rewriting every component, which is why it is recorded.
