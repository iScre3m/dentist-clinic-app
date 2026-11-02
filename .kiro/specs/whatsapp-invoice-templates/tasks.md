# Implementation Plan: WhatsApp Invoice Templates

## Overview

Implementation plan for the WhatsApp Invoice Templates feature: manual itemized invoices built from staff-recorded appointment services, delivered via a rendered `wa.me` anchor using the existing WhatsApp infrastructure. SvelteKit pages + form actions (no `/api` layer), Drizzle migrations, Valibot schemas, Spanish (es-AR) UI copy.

Reference pattern for pages: `src/routes/(app)/turnos/[id]/recordatorio/`.

## Tasks

-[x] 1. Database schema and migration
  -[x] 1.1 Update Drizzle schema
    - Add `servicePrices`, `appointmentServices`, `invoiceHistory` to `src/lib/server/db/schema.ts` per the design (text UUIDs, `nowMs`, `user` refs, declared unique/index callbacks)
    - Extend `reminderRecords.purpose` enum with `'invoice'`
    - Export types: `ServicePrice`, `AppointmentService`, `InvoiceHistory`, `New…`
    - _Requirements: 2.1, 3.5, 4.6, 5.1–“5.3_
  -[x] 1.2 Generate and run migration
    - `pnpm db:generate` (single `0004_*` migration), verify FKs, unique `(appointment_id, service_price_id)`, indexes
    - `pnpm db:migrate` and confirm tables in the local DB
    - _Requirements: 2.1, 5.1_
  -[x] 1.3 Update seed and prune scripts
    - `scripts/seed.ts`: seed a realistic set of service types with ARS prices and some appointments with recorded services (synthetic names only)
    - `scripts/prune.ts`: flat 90-day retention everywhere –” delete `invoice_history` older than 90 days (by `created_at`); the `service_prices` catalog is permanent and never pruned or deleted; appointment cascades take `appointment_services` and their invoices with them. There is no `service_price_changes` table (prices are snapshot at invoice time; see design)
    - _Requirements: 1.1, 5.4, Retention 1–“4_

-[x] 2. Valibot schemas
  -[x] 2.1 Create `src/lib/schemas/service-price.schema.ts`
    - create/update price, activate/deactivate; no change-log fields (design decision: none kept)
    - _Requirements: 1.1, 1.2, 1.6_
  -[x] 2.2 Create `src/lib/schemas/invoice.schema.ts`
    - add/remove/set-quantity service (uuid + quantity 1–“99), generate invoice, resend with required reason
    - _Requirements: 2.1, 2.2, 3.1, 4.7_

-[x] 3. Env and clinic config
  -[x] 3.1 Add `CLINIC_NAME`, `CLINIC_PHONE`, `CLINIC_ADDRESS` to `.env.example` (placeholders) and a small typed server config reader that fails clearly when missing
    - _Requirements: 3.4_

-[x] 4. Pricing service
  -[x] 4.1 Create `src/lib/server/services/pricing/index.ts`
    - `listServicePrices`, `listActiveServicePrices`, `getPriceForService`, `hasAllPrices`
    - `createServicePrice`, `updatePrice` (plain update of price/updatedBy/updatedAt), `setActive`
    - _Requirements: 1.1, 1.2, 1.3, 1.5_
  -[x] 4.2 Unit tests for pricing
    - price-updates record who/when on the row; `hasAllPrices` catches missing/inactive/priced; snapshots unaffected by later changes
    - _Requirements: 1.2, 1.4_

-[x] 5. Invoice service
  -[x] 5.1 Appointment services
    - `addService` (upsert on unique pair → reselect bumps quantity), `removeService`, `setQuantity`
    - _Requirements: 2.1–“2.3_
  -[x] 5.2 Invoice generation
    - `getInvoiceData` guard union (cancelled / future / archived / no patient / no services / missing prices, with names of unpriced practices)
    - `generateInvoice` (transaction, price snapshot, totals math)
    - _Requirements: 3.1–“3.9_
  -[x] 5.3 Send confirmation and resend
    - `markSent` (transaction: status `'sent'` + `sentAt` + `reminder_records` purpose `'invoice'`), `markSkipped`
    - `resendInvoice` (requires previous sent/resent, fresh snapshot, `resentReason`, `resentOf`)
    - `listInvoicesByPatient`, `listInvoicesByAppointment`
    - _Requirements: 4.6, 4.7, 5.1–“5.4_
  -[x] 5.4 Unit tests for invoice service
    - guards, upsert-on-reselect, snapshot integrity, totals, send-confirmation-only-after-user-action, resend reason enforcement
    - _Requirements: 2.2, 2.3, 3.5–“3.9, 4.3, 4.6, 4.7_

- [x] 6. WhatsApp integration
  - [x] 6.1 Add `invoice` template to `TEMPLATES` and render `{{servicios}}` list in the invoice service; empty-render fallback error; wire clinic env vars
    - _Requirements: 4.1, 4.2, 3.4_
  - [x] 6.2 Unit tests
    - message rendering, es-AR money formatting, `buildWaMeLink` digits-only, no-logging of the URL
    - _Requirements: 4.1, 4.2_

- [x] 7. Pages
  - [x] 7.1 `(app)/precios` pricing page
    - list + create + edit (price) + activate/deactivate; last update (who/when) per row; empty state
    - _Requirements: 1.1–“1.3, 1.5_
  - [x] 7.2 `(app)/turnos/[id]/factura` appointment invoice page
    - services multi-select (checkbox-style dropdown) with quantity steppers; blocked-state messages; itemized invoice preview with snapshot prices; message preview + **plain `<a>` wa.me link** rendered by load (never opened after an await) + copy fallback; confirm sent / mark skipped actions; appointment invoice history with resend flow
    - _Requirements: 2.1–“2.3, 3.1–“3.9, 4.1–“4.8, 5.5_
  - [x] 7.3 `(app)/facturas` history page
    - latest 20 with date / patient name / total / status filters; empty state
    - _Requirements: 5.4, 5.6_
  - [x] 7.4 Navigation and entry points
  - [x] 7.5 Add Factura button in dashboard appointment rows (entry point to /turnos/[id]/factura)
    - header links for `Precios` and `Facturas`; `Factura` link on past appointments (dashboard/patient detail)
    - _Requirements: 3.1, 5.4_

- [x] 8. E2E tests (Playwright, fixtures only, never a real `wa.me` navigation)
  - [x] 8.1 Happy path: add services → generate → anchor present → confirm sent → history reflects it
  - [x] 8.2 Blocked paths: no services, cancelled appointment, denied consent (no link rendered), resend requires confirmation + reason
  - [x] 8.3 Auth: unauthenticated requests to pricing/invoice/history are redirected
    - _Requirements: 3.3, 3.8, 4.4, 4.7, 5.4_

## Notes

- No `/api/*` endpoints: use SvelteKit form actions mirroring the existing pages.
- `reminder_records` gains purpose `'invoice'`; `'resend'` purpose stays reserved for reminder resends –” invoice resends are confirmed with purpose `'invoice'`.
- Do not store message bodies or `wa.me` URLs anywhere.
- Check repo tooling before adding fast-check: if absent, cover correctness properties with deterministic many-case tests instead of new dependencies.

## Post-implementation adjustments

- Dashboard: clicking "Confirmar" grants WhatsApp consent (`granted`, source `staff`) so reminders become available.
- `/facturas`: server load now queries `invoiceHistory`; page renders invoice list (patient, total, date) with empty state.
- `/turnos/[id]/factura`: textarea uses writable `$derived`; quantity defaults to 1 and resets on service change; generate button only shown when not blocked.
- Dashboard and factura forms invalidate data after attendance changes.

```json
{
	"waves": [
		{ "id": 0, "tasks": ["1.1", "1.3"] },
		{ "id": 1, "tasks": ["1.2", "2.1", "2.2", "3.1"] },
		{ "id": 2, "tasks": ["4.1", "5.1", "6.1"] },
		{ "id": 3, "tasks": ["4.2", "5.2", "5.3", "6.2"] },
		{ "id": 4, "tasks": ["5.4", "7.1"] },
		{ "id": 5, "tasks": ["7.2", "7.3", "7.4"] },
		{ "id": 6, "tasks": ["8.1", "8.2", "8.3"] }
	]
}
```

