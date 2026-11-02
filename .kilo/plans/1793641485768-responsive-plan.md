# Plan: Responsive Design Pass

## Goal

Make the dental practice admin app fully responsive across mobile (320–480), large mobile (481–767), tablet (768–1023), and desktop (1024+), preserving functionality, design identity, and business logic.

## Highest-impact issues identified

1. App layout header nav (`src/routes/(app)/+layout.svelte`) uses a horizontal `flex` nav with no mobile collapse; links overflow on small screens.
2. Dashboard upcoming appointments row uses `flex items-center justify-between` with many buttons; overflows on mobile.
3. Forms in unmatched events and precios use fixed widths (`w-48`) and dense inline layouts.
4. Factura page has dense multi-column service/quantity controls.
5. Tables/lists need horizontal scroll containers or stacking.

## Affected boundaries

- `src/routes/(app)/+layout.svelte` — responsive header/nav (hamburger on mobile).
- Shared UI: `card`, `button`, `input`, `badge`, `table` if present.
- Pages: dashboard, pacientes, follow-ups, precios, facturas, turnos/[id]/factura, turnos/[id]/recordatorio.

## Implementation steps

1. Add a mobile hamburger menu to the app layout header; hide nav links below `md`, show in a collapsible panel. Keep desktop layout unchanged at `md+`.
2. Dashboard: wrap appointment action buttons in a `flex-wrap` container; stack on mobile; keep badges readable.
3. Factura page: stack service selector, quantity, and add button vertically on small screens; keep desktop inline.
4. Pacientes list and follow-ups: ensure cards/rows wrap; avoid fixed widths; use `min-w-0` and `truncate` for long text.
5. Tables: wrap in `overflow-x-auto` containers.
6. Dialogs/modals: ensure `max-w` and `w-full` with viewport padding.
7. Global: add `overflow-x-hidden` on body; ensure images/media `max-w-full`.

## Validation

- Run `pnpm run check` and existing tests.
- Manual inspection at 320, 375, 390, 430, 768, 1024, 1366, 1920.
- Confirm no horizontal scroll and all actions reachable.

## Risks

- Tailwind breakpoints must match project config; use existing `sm`/`md`/`lg`.
- Avoid changing business logic.