# Plan: Create a website design skill for Dr. Laura's clinic

## Goal
Create a project-local skill that guides design and implementation of new pages and components for the dental clinic admin app. The skill follows the clinic's calm medical identity, SvelteKit + Svelte 5 + Tailwind + shadcn-svelte stack, and es-AR copy conventions.

## Skill location
`.agents/skills/dental-web-design/SKILL.md` (project-local, mirrors the global skill layout).

## Concrete palette (calm medical teal)
Document these OKLCH tokens for `:root` in `src/app.css` (dark mode keeps shadcn defaults, only primary/accent shift):
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
- `--destructive`: oklch(0.58 0.22 25) (unchanged red)

## Skill content (SKILL.md)
- Frontmatter: name `dental-web-design`, description with pushy trigger phrasing covering new pages, components, UI review, layout, styling, Spanish copy.
- Sections:
  1. Stack and conventions (Svelte 5 runes, Tailwind v4, shadcn-svelte, `#lib` alias, `src/lib/components/ui` vendored and read-only, `components.json` aliases, copy centralized in one module).
  2. Visual identity: calm medical palette with the concrete tokens above; spacing scale; radius; surface hierarchy.
  3. Typography: Inter Variable (already imported), size/weight rules, heading hierarchy.
  4. Layout: container max-width, page header pattern, card-based panels, dashboard grid, desktop-first responsive.
  5. Component patterns: Button variants/sizes, Badge status colors (amber scheduled, emerald confirmed, red no-show, gray attended), Card structure, forms with labels and `sr-only`, empty/loading/error states, tables/lists, `cn` helper usage.
  6. Spanish (es-AR) copy: labels, date/time via `Intl` for `America/Argentina/Buenos_Aires` using `#lib/format.ts`, tone (neutral formal, no "vos"), accent handling, status words, copy module location.
  7. Accessibility: keyboard, labels, focus rings, contrast, `sr-only`, aria.
  8. Anti-patterns: no clinical data display, no analytics panels, no auto-sending, no patient self-service beyond `/`, desktop-first, don't edit vendored UI.
  9. Snippets: page shell, card panel, status badge, form field (Svelte 5 + Tailwind + shadcn imports).
  10. Review checklist: contrast, empty state, loading state, error state, keyboard nav, Spanish copy, mobile sanity.

## Risks
- Kilo may load project skills from a different directory. Mitigation: verify after creation; if not loaded, move to `.kilo/skills/` or global `~/.agents/skills/`.
- Palette tokens change `app.css`; skill documents only. Implementation is a separate task.
- Snippets may drift from shadcn-svelte API versions; keep imports aligned with repo.

## Implementation steps
1. Create directory `.agents/skills/dental-web-design/`.
2. Write `SKILL.md` with the sections and concrete tokens above.
3. Optionally add `references/palette.md` duplicating the token table.

## Validation
- Read the skill back; confirm frontmatter valid and under 500 lines.
- Run `pnpm check` and `pnpm lint` (no source changes, but verify project still builds).

## Out of scope
- Changing `app.css` tokens now (skill only documents; implementation later).
- Creating components (skill guides, not implements).
- Marketing/landing pages; this is an admin app.

