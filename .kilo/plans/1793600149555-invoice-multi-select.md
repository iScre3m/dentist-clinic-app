# Plan: Multi-select add prácticas on invoice page

## Goal
Add a UI on `/turnos/[id]/factura` to select one or more service prices (prácticas) with quantities and add them to the appointment, using the existing server actions.

## Context
- Server load already returns `activePrices`, `services`, `invoiceData`, `blockedMessage`, `message`, `waMeLink`.
- Actions already exist: `add_service`, `remove_service`, `set_quantity`, `generate`, `mark_sent`, `mark_skipped`, `resend`.
- SvelteKit form actions with `use:enhance`.

## Design decisions (confirmed + refined)
- Single `<select>` for service price + quantity stepper (1–99) + "Agregar" button. Repeat to add more.
- Matches existing `add_service` action; no new server code needed.
- List current services with quantity steppers and remove buttons.
- Show blocked message when present.
- Show itemized preview + wa.me link only when invoiceData exists.
- Confirm sent / mark skipped actions included.
- Add an editable textarea (seeded from `data.message`) plus "Copiar mensaje" and "Abrir en WhatsApp" button, mirroring the reminder page. Build the wa.me link client-side from `appointment.patientPhone` digits and the edited text, so edits are reflected.
- Keep the server-built `waMeLink` as fallback when the textarea is untouched.

## Files
- `src/routes/(app)/turnos/[id]/factura/+page.svelte` — full UI.

## Validation
- Lint/type check pass.
- Add service → list updates.
- Generate → preview + link.
- Confirm sent / skipped works.

## Open
- Whether to allow multi-select in one submit (would need new action). Recommended: single select + quantity, repeated adds.
