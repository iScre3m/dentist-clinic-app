# Plan: Show generated invoices on /facturas

## Goal

Render the list of generated invoices on the `/facturas` page. The server load already queries `invoiceHistory`. The page component only checks for an empty list and renders nothing else.

## Affected files

- `src/routes/(app)/facturas/+page.svelte` — add invoice list rendering.
- `src/routes/(app)/facturas/+page.server.ts` — already loads invoices; verify field names match the component.

## Implementation

1. Read `invoiceHistory` schema fields to know available columns (`patientName`, `patientPhone`, `total`, `status`, `createdAt`, `appointmentStartsAt`).
2. In `+page.svelte`, replace the empty-state-only block with a conditional: empty state when no invoices, otherwise a `<ul>`/table listing each invoice with patient name, total, status, and formatted date.
3. Use existing `formatDateTime`/`formatCurrency` helpers if available; otherwise `Intl.NumberFormat` for ARS.
4. Keep empty state message "No hay facturas registradas."

## Validation

- Generate an invoice on a turno factura page.
- Navigate to `/facturas`; the new invoice appears with patient, total, and date.
- Empty state still shows when no invoices exist.

## Risks

- Field name mismatches between schema and component; verify against `invoiceHistory` definition.
- Date formatting timezone: use `America/Argentina/Buenos_Aires`.