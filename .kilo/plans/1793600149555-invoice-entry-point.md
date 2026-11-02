# Plan: Add entry point to invoice page

## Goal
Make the invoice page reachable from the UI. Currently `/turnos/[id]/factura` has no link from any page.

## Approach
Add a "Factura" button in the dashboard "Próximos turnos" list, next to each appointment's reminder action. The invoice server already blocks future appointments with "Las facturas se emiten después del turno.", so clicking on an upcoming appointment shows that message; clicking on a past appointment (if present in the list) opens the invoice flow.

## Files to change
- `src/routes/(app)/dashboard/+page.svelte` — add a `Factura` button in the appointment row actions, using `window.location.href = '/turnos/' + appointment.id + '/factura'` (matching the existing reminder button pattern).

## Validation
- Lint and type check pass.
- Button appears on dashboard appointment rows.
- Clicking navigates to `/turnos/<id>/factura`.

## Out of scope
- Patient detail page and a dedicated "Turnos anteriores" panel (not implemented yet).
