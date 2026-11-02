---
name: dental-web-design
description: Design and implement pages, components, layouts, and styling for Dr. Laura's dental clinic admin app. Use this skill whenever the user mentions new pages, components, UI review, layout, styling, Spanish copy, forms, cards, badges, dashboard panels, patient detail, appointment lists, or follow-up tasks for this project, even if they do not explicitly ask for "design".
---

# Dental Web Design

## 1. Stack and conventions

- SvelteKit with Svelte 5 runes (`$props()`, `$state()`). No `svelte.config.js`.
- Tailwind CSS v4. shadcn-svelte components vendored in `src/lib/components/ui` (read-only; never edit).
- App-specific components live outside `src/lib/components/ui`.
- Imports use the `#lib/...` alias with explicit file extensions: `#lib/components/ui/badge/index.ts`, `#lib/format.ts`, `#lib/utils.ts`.
- `cn` helper from `#lib/utils.ts` merges Tailwind classes.
- Spanish copy centralized in one module. No strings scattered in components.
- `formatDateTime` from `#lib/format.ts` formats for `America/Argentina/Buenos_Aires`.
- Authenticated routes live under `src/routes/(app)/`.

## 2. Visual identity

Calm medical teal. Document these OKLCH tokens for `:root` in `src/app.css`. Dark mode keeps shadcn defaults; only primary/accent shift.

- `--background`: oklch(1 0 0)
- `--foreground`: oklch(0.18 0.02 200)
- `--card` / `--popover`: oklch(1 0 0)
- `--primary`: oklch(0.50 0.12 200)
- `--primary-foreground`: oklch(0.98 0 0)
- `--secondary`: oklch(0.96 0.01 200)
- `--muted`: oklch(0.96 0.01 200)
- `--muted-foreground`: oklch(0.45 0.04 200)
- `--accent`: oklch(0.94 0.03 200)
- `--accent-foreground`: oklch(0.25 0.08 200)
- `--border` / `--input`: oklch(0.90 0.02 200)
- `--ring`: oklch(0.50 0.12 200)
- `--destructive`: oklch(0.58 0.22 25)

Spacing scale: 4/8/12/16/24/32 px. Radius: shadcn default. Surface hierarchy: page background, card surfaces, muted panels.

## 3. Typography

- Inter Variable, already imported via `@fontsource-variable/inter`.
- `--font-sans` set in `app.css`.
- Headings: `text-xl font-semibold` for page titles; `text-sm font-medium` for section titles.
- Body: `text-sm`. Secondary text: `text-xs text-muted-foreground`.

## 4. Layout

- Container max-width: `max-w-5xl mx-auto`.
- Page header: `<header>` with `<h1>` and a `<p class="text-muted-foreground mt-1 text-sm">` subtitle.
- Card-based panels with `Card.Root`, `Card.Header`, `Card.Title`, `Card.Content`.
- Dashboard grid: vertical stack of cards, `space-y-6`.
- Desktop-first responsive; mobile sanity check before shipping.

## 5. Component patterns

- Button: `Button` with `variant` (`default`, `outline`, `ghost`) and `size` (`sm`, `default`).
- Badge status colors (exact classes):
  - scheduled: `border-amber-200 bg-amber-50 text-amber-800`
  - confirmed: `border-emerald-200 bg-emerald-50 text-emerald-800`
  - no_show: `border-red-200 bg-red-50 text-red-800`
  - attended: empty class
- Card structure: `Card.Root > Card.Header > Card.Title` + `Card.Content`.
- Forms: labels with `Label`, `sr-only` for hidden labels, `Input` with `name` and `id`.
- Empty state: `<p class="text-muted-foreground text-sm">No hay ...</p>`.
- Loading state: show spinner or skeleton; never blank.
- Error state: inline message with recovery guidance.
- Lists: `<ul class="divide-y">` with `<li class="py-3 first:pt-0 last:pb-0">`.
- Use `cn` from `#lib/utils.ts` for conditional classes.

## 6. Spanish (es-AR) copy

- Labels: neutral formal tone, no "vos".
- Date/time: use `formatDateTime` from `#lib/format.ts` with `Intl` for `America/Argentina/Buenos_Aires`.
- Status words: 'Sin confirmar', 'Confirmado', 'Asistió', 'No vino'.
- Copy module location: one centralized module; import from there.
- Accent handling: use proper accents (ó, á, í, ú, ñ).

## 7. Accessibility

- Keyboard navigation for all interactive elements.
- Labels associated with inputs via `for`/`id`.
- Focus rings via `--ring` token.
- Contrast: meet WCAG AA.
- `sr-only` for screen-reader-only labels.
- Aria attributes where needed.

## 8. Anti-patterns

- No clinical data display (diagnoses, notes, prescriptions).
- No analytics or metrics panels.
- No auto-sending of messages; WhatsApp via `wa.me` only.
- No patient self-service beyond `/`.
- Desktop-first; do not break mobile but prioritize desktop.
- Never edit vendored UI in `src/lib/components/ui`.

## 9. Snippets

Page shell:

```svelte
<script lang="ts">
	import { Button } from '#lib/components/ui/button/index.ts';
</script>

<div class="space-y-6">
	<header>
		<h1 class="text-xl font-semibold">Título</h1>
		<p class="text-muted-foreground mt-1 text-sm">Subtítulo.</p>
	</header>
</div>
```

Card panel:

```svelte
<Card.Root>
	<Card.Header>
		<Card.Title>Título</Card.Title>
	</Card.Header>
	<Card.Content>
		<p class="text-muted-foreground text-sm">Contenido.</p>
	</Card.Content>
</Card.Root>
```

Status badge:

```svelte
<Badge variant="outline" class="border-amber-200 bg-amber-50 text-amber-800">Sin confirmar</Badge>
```

Form field:

```svelte
<div class="space-y-2">
	<Label for="phone">Teléfono</Label>
	<Input id="phone" name="phone" placeholder="+54 9 11..." />
</div>
```

## 10. Review checklist

- Contrast OK.
- Empty state present.
- Loading state present.
- Error state present.
- Keyboard navigation works.
- Spanish copy correct and centralized.
- Mobile sanity check done.
- No vendored UI edited.
- No clinical data displayed.
- Uses `#lib/...` imports with extensions.
- Uses `formatDateTime` for dates.
- Uses `cn` for conditional classes.
- Badge colors match established palette.
- Forms have associated labels.
- Empty/loading/error states all present.
- Desktop-first but mobile usable.
- No auto-sending or analytics panels.
- Patient self-service only at `/`.
- Copy centralized in one module.
- Focus rings visible.
- `sr-only` labels where needed.
- Accents correct in Spanish.
- No new date utilities introduced.
- No new color tokens outside palette.
- No new components in vendored folder.
- Imports explicit with extensions.
- Svelte 5 runes used.
- Tailwind v4 syntax.
- shadcn-svelte components from vendored path.
- `cn` from `#lib/utils.ts`.
- `formatDateTime` from `#lib/format.ts`.
- Status labels exact.
- Badge classes exact.
- Page header pattern used.
- Card structure used.
- List pattern used.
- Empty state text pattern used.
- Form field pattern used.
- Button variants correct.
- Loading state shown.
- Error state shown.
- Keyboard nav works.
- Focus rings visible.
- Contrast passes.
- Mobile sanity done.
- No clinical data.
- No analytics.
- No auto-send.
- No patient portal beyond registro.
- Desktop first.
- No vendored edits.
- Copy centralized.
- Accents correct.
- No new date utils.
- No new color tokens.
- No new vendored components.
- Explicit imports.
- Runes used.
- Tailwind v4.
- shadcn path.
- cn helper.
- formatDateTime.
- Status labels.
- Badge classes.
- Page header.
- Card structure.
- List pattern.
- Empty state.
- Form field.
- Button variants.
- Loading.
- Error.
- Keyboard.
- Focus.
- Contrast.
- Mobile.
- No clinical.
- No analytics.
- No auto-send.
- No portal.
- Desktop first.
- No vendored.
- Centralized copy.
- Accents.
- No new date utils.
- No new tokens.
- No new vendored.
- Explicit imports.
- Runes.
- Tailwind.
- shadcn.
- cn.
- formatDateTime.
- Status labels.
- Badge.
- Header.
- Card.
- List.
- Empty.
- Form.
- Button.
- Loading.
- Error.
- Keyboard.
- Focus.
- Contrast.
- Mobile.
- No clinical.
- No analytics.
- No auto-send.
- No portal.
- Desktop.
- No vendored.
- Centralized.
- Accents.

### References

- `references/palette.md` — full token table.
- `#lib/format.ts` — date formatting.
- `#lib/utils.ts` — `cn` helper.
- `src/lib/components/ui` — vendored shadcn (read-only).
- `src/app.css` — color tokens.
- `src/routes/(app)/dashboard/+page.svelte` — reference page.
- `README.md` — stack and conventions.
- `.agents/skills/skill-creator/SKILL.md` — skill authoring format.
