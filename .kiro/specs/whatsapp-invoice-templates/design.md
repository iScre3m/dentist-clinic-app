# Design Document: WhatsApp Invoice Templates

## Overview

This design adds manual itemized invoices to the existing SvelteKit + Drizzle + SQLite application. It follows the conventions already established in `src/lib/server/db/schema.ts`, the WhatsApp service, and the `(app)` routes (see `turnos/[id]/recordatorio` as the reference pattern). No REST API layer is introduced: pages use SvelteKit load functions and form actions with `requireUser`, server-side Valibot validation, and Spanish error copy.

Decisions locked in for this design:

- This feature is an explicit scope extension of `AGENTS.md` (billing was out of scope).
- Appointment services are added manually by staff via a multi-select of active service types.
- The schema follows the existing repo conventions exactly (text UUIDs, `nowMs`, `user` table references, Drizzle enums in the established style, Valibot schemas separate from Drizzle).
- The `wa.me` link is rendered as a plain `<a>` in the page markup; it is never opened from a server action or after an `await`.

## Architecture

```
Frontend pages (load + form actions, no /api layer)
  (app)/precios               → pricing management
  (app)/turnos/[id]/factura   → services on appointment + invoice generate/preview/send
  (app)/facturas              → invoice history
        ↓
Service layer (src/lib/server/services/)
  services/pricing/index.ts       → service type prices (no change log, see Table section)
  services/invoices/index.ts      → invoice snapshots, totals, resend logic
  services/whatsapp/index.ts      → existing: TEMPLATES, renderTemplate, buildWaMeLink
        ↓
Database (Drizzle ORM, SQLite, migrations via drizzle-kit)
  New tables: service_prices, appointment_services, invoice_history
  Modified:   reminder_records.purpose gains 'invoice'
```

## Data Models

Style rules taken from the existing schema: `text` primary keys with UUIDs, `integer(..., { mode: 'timestamp_ms' })` with `default(nowMs)`, `boolean` via `integer(..., { mode: 'boolean' })`, Drizzle `enum` texts, declared indexes/unique indexes in the table callback.

### Service prices (new)

```typescript
import { boolean, index, integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';
import { user } from './schema'; // same file, references below

export const servicePrices = sqliteTable(
	'service_prices',
	{
		id: text('id').primaryKey(),
		serviceType: text('service_type').notNull(),
		name: text('name').notNull(),
		price: integer('price').notNull(), // ARS pesos, no decimals
		isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
		updatedBy: text('updated_by')
			.notNull()
			.references(() => user.id),
		updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull().default(nowMs),
		createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull().default(nowMs)
	},
	(t) => [
		uniqueIndex('service_prices_service_type_unique').on(t.serviceType),
		index('service_prices_is_active_idx').on(t.isActive)
	]
);
```

### Price updates (decision: no change log)

There is **no** `service_price_changes` table and no written reason per change. Rationale: invoices always snapshot prices at generation time, so a change log has no user-facing or functional purpose — it would be retained merely as history, which contradicts the flat 90-day retention stance ("no reason to keep information longer than 90 days"). An update simply writes the new `price`, `updatedBy`, and `updatedAt` on the `service_prices` row; the `/precios` page shows the last update (price, who, when) per service type, which covers the practice's need to see recency without keeping history. Deactivation stays `isActive = false` on the same row.

### Appointment services (new)

The source of "services performed during this appointment". Staff add them via a multi-select of active service types; quantity defaults to 1 and is editable. Unique on `(appointment_id, service_price_id)` so selecting an already-added type adds to the existing row instead of duplicating.

```typescript
export const appointmentServices = sqliteTable(
	'appointment_services',
	{
		id: text('id').primaryKey(),
		appointmentId: text('appointment_id')
			.notNull()
			.references(() => appointments.id, { onDelete: 'cascade' }),
		servicePriceId: text('service_price_id')
			.notNull()
			.references(() => servicePrices.id, { onDelete: 'restrict' }),
		quantity: integer('quantity').notNull().default(1),
		addedBy: text('added_by')
			.notNull()
			.references(() => user.id),
		createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull().default(nowMs),
		updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull().default(nowMs)
	},
	(t) => [
		uniqueIndex('appointment_services_unique').on(t.appointmentId, t.servicePriceId),
		index('appointment_services_appointment_idx').on(t.appointmentId)
	]
);
```

`onDelete: 'restrict'` on `servicePriceId`: deactivating a service type must not break historical appointment services; deactivation (`isActive = false`) replaces deletion entirely.

### Invoice history (new)

An immutable snapshot. No invoice number (numbering is excluded); the row `id` and `created_at` identify it. Patient name and phone are snapshotted deliberately (historical accuracy if the patient's data is later corrected); staff is referenced by id only and joined for display, per the no-duplication convention.

```typescript
export const invoiceHistory = sqliteTable(
	'invoice_history',
	{
		id: text('id').primaryKey(),
		appointmentId: text('appointment_id')
			.notNull()
			.references(() => appointments.id, { onDelete: 'cascade' }),
		patientId: text('patient_id')
			.notNull()
			.references(() => patients.id),
		patientName: text('patient_name').notNull(), // snapshot
		patientPhone: text('patient_phone').notNull(), // snapshot, E.164
		appointmentStartsAt: integer('appointment_starts_at', { mode: 'timestamp_ms' }).notNull(),
		services: text('services', { mode: 'json' }).notNull(), // SnapshotItem[]
		subtotal: integer('subtotal').notNull(),
		total: integer('total').notNull(),
		createdBy: text('created_by')
			.notNull()
			.references(() => user.id),
		status: text('status', { enum: ['generated', 'sent', 'resent'] })
			.notNull()
			.default('generated'),
		sentAt: integer('sent_at', { mode: 'timestamp_ms' }),
		resentReason: text('resent_reason'),
		resentOf: text('resent_of').references(() => invoiceHistory.id), // original invoice on a resend
		createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull().default(nowMs)
	},
	(t) => [
		index('invoice_history_appointment_idx').on(t.appointmentId),
		index('invoice_history_patient_idx').on(t.patientId),
		index('invoice_history_status_idx').on(t.status),
		index('invoice_history_created_at_idx').on(t.createdAt)
	]
);
```

`SnapshotItem` type (validated with Valibot when reading):

```typescript
type SnapshotItem = {
	serviceType: string;
	name: string;
	price: number;
	quantity: number;
	subtotal: number;
};
```

### Reminder records (modified)

`purpose` gains `'invoice'`; `templateKey` is `'invoice'`. Everything else is unchanged (no message bodies, no provider IDs).

```typescript
purpose: text('purpose', { enum: ['reminder', 'confirmation', 'follow_up', 'resend', 'invoice'] });
```

## Migration

Generated with `pnpm db:generate` (single migration `0004_*` creating the four new tables and, if the enum is declared as a raw text column, no data change is needed for `reminder_records`). Run with `pnpm db:migrate`.

Conventions from the repo apply: WAL mode, transactions via `db.transaction` for multi-step writes, foreign keys enforced.

### Retention (90 days, flat)

`pnpm db:prune` extends its existing 90-day policy to the new tables — nothing billing-related is kept longer than that:

- `invoice_history`: rows with `created_at` older than 90 days. Appointment cleanups cascade here too (`appointment_id ON DELETE CASCADE`), so an appointment removed by the existing prune takes its services and invoices with it.
- `service_prices` is not pruned and is never deleted: it is the practice's catalog, kept indefinitely. Deactivation (`isActive = false`) is the only "removal" and preserves the row.
- Existing `reminder_records` appointments prune behavior is unchanged; invoice-related reminder records are inside the already-pruned set.

## Valibot Schemas

New files, independent from the Drizzle schema:

- `src/lib/schemas/service-price.schema.ts` — create/update price: `serviceType` (kebab-case slug), `name` (1–60 chars), `price` (integer ≥ 0), `isActive`. No `reason` field (no change log exists).
- `src/lib/schemas/invoice.schema.ts` — add service action: `servicePriceId` (uuid), `quantity` (1–99); generate invoice: `appointmentId` (uuid); resend: `reason` (1–200 chars).

Form actions validate with these schemas on the server; client-side hints are cosmetic only.

## Service Layer

### `services/pricing/index.ts`

- `listServicePrices()` — all rows, active first (alphabetical).
- `listActiveServicePrices()` — for the multi-select on the invoice page.
- `getPriceForService(serviceType)`.
- `hasAllPrices(servicePriceIds)` → `{ ok: true } | { ok: false, missing: string[] }`.
- `updatePrice({ servicePriceId, newPrice }, staffId)` — plain update of `price`, `updatedBy`, `updatedAt`; no history row.
- `createServicePrice({ serviceType, name, price }, staffId)`.
- `setActive(servicePriceId, isActive, staffId)` — deactivation (`isActive = false`) preserves the row; always allowed.

### `services/invoices/index.ts`

- `addService(appointmentId, servicePriceId, quantity, staffId)` — upsert on the unique pair (re-select increments `quantity`; keep the `nowMs` update).
- `removeService(appointmentServiceId, staffId)`.
- `getInvoiceData(appointmentId)` — appointment + patient + appointment services joined with current prices; returns guards' results as a discriminated union used by the page and enforced again in the action:
  - appointment must exist, `calendarStatus === 'confirmed'`, `startsAt` in the past, patient linked, patient not archived.
  - ≥ 1 appointment service; every service type priced.
- `generateInvoice(appointmentId, staffId)` — transaction: read appointment services + current prices, compute subtotals/total, insert `invoice_history` with the snapshot, return the row. Duplicates allowed (a regen creates a new snapshot; the UI lists them newest-first and only the latest is actionable for sending).
- `markSent(invoiceId, staffId)` — status `'sent'`, `sentAt`; inserts the `reminder_records` row (purpose `'invoice'`) in the same transaction. This runs _after_ the assistant opens WhatsApp from the plain link and confirms — the record is confirmation, not the send.
- `markSkipped(invoiceId, staffId, reason)` — leaves a `skipped` reminder record; invoice stays `'generated'`.
- `resendInvoice(originalInvoiceId, reason, staffId)` — requires the original to be `'sent'` or `'resent'`; generates a fresh snapshot (prices may have changed), inserts a new row with status `'resent'`, `resentReason`, `resentOf` (and inserts nothing into `reminder_records` until the new send is confirmed, which then uses purpose `'invoice'` since `'resend'` is reserved for reminder resends).
- `listInvoicesByPatient(patientId)` / `listInvoicesByAppointment(appointmentId)`.

### WhatsApp template

Follows the existing `TEMPLATES` / `{{var}}` convention in `src/lib/server/services/whatsapp/index.ts` (the current system of record for templates; migrating them to `templates/whatsapp/reminder.es.md` is a separate concern and out of scope):

```typescript
invoice: 'Hola {{nombre}}, te enviamos el detalle de tu consulta del {{fecha}} en {{consultorio}}:\n\n{{servicios}}\n\nTotal: ${{total}}\n\nGracias por tu visita. Ante cualquier consulta, escribinos por acá.';
```

`{{servicios}}` is rendered by the invoice service as one line per item (`'1. Consulta — $5500'` style: `quantity × name — $subtotal`), because a flat template string cannot hold a variable-length list. Currency formatting uses `Intl` for `es-AR`. Fallback if the template is missing: `renderTemplate` already returns `''` for unknown keys; the invoice service checks for empty render and throws a Spanish error instead of sending a broken message.

`buildWaMeLink` (digits only, contracted) is reused unchanged; generated URLs are never logged.

## Pages and Actions

### `(app)/precios` — pricing management

- **Load:** `listServicePrices()` with `updatedBy` joined for display (last price + who/when per type).
- **Components:** list rows (type, name, ARS price, active badge, last update by) + "Nueva práctica" (create) + edit dialog (new price) + activate/deactivate.
- **Actions:** `create`, `update`, `set_active`. All guarded by `requireUser`; errors rendered inline in Spanish.
- Explicit empty state when no service types exist ("Cargá la primera práctica para poder facturar") with the create action.

### `(app)/turnos/[id]/factura` — appointment invoice (one page, mirrors `recordatorio`)

- **Guards in load + re-checked in actions** (Spanish 4xx errors, same style as `recordatorio`): appointment exists, linked patient, patient not archived, `calendarStatus === 'confirmed'`, `startsAt` in the past.
- **Sections:**
  1. **Servicios del turno** — multi-select of active service types (checkbox-style list inside a shadcn-svelte popover/dropdown) with per-row quantity stepper and remove button; saved via form actions (`add_service`, `remove_service`, `set_quantity`).
  2. **Factura** — itemized preview: per-service quantity × name × snapshot price → subtotal, grand total, patient name/phone, appointment date (formatted `es-AR` / `America/Argentina/Buenos_Aires`), clinic info from env. Blocked states render the specific Spanish error and hide the invoice (no services / missing prices, listing `name`s / cancelled / future appointment).
  3. **Enviar por WhatsApp** — shown only when consent = granted, no opt-out, phone valid. The message preview and the **plain `<a href="https://wa.me/...?text=...">`** (digits only) are rendered by the load function; the anchor has `target="_blank" rel="noopener"`. Copy-to-clipboard button with selectable-text fallback. A separate form action records confirmation: `mark_sent` (or `mark_skipped` with optional reason) — this action never builds the link itself.
  4. **Historial de facturas del turno** — previous snapshots (date, total, status), with **Reenviar** (confirmation dialog + required reason) creating a `'resent'` snapshot; the fresh message + plain link renders after the action returns.
- Patient-level exceptions (denied consent, opt-out, invalid phone) show inline explanatory copy and no link, never a disabled grayed-out button.

### `(app)/facturas` — invoice history

- **Load:** latest 20 invoices, filters via query params: date range, patient name search, status.
- **Actions:** none (read-only view; resend happens from the appointment page where the snapshot can be rebuilt).
- Empty state: "No hay facturas todavía".

### Navigation

- Pricing and history links from the app header/nav alongside pacientes, turnos, follow-ups.
- Appointment rows / appointment detail gain a **Factura** link (only meaningful for past appointments; keep it visible — the page's guard explains itself).

### Clinic configuration

New env vars (documented placeholders in `.env.example`):

```
CLINIC_NAME="Consultorio Dra. Laura"
CLINIC_PHONE="+54 9 11 5555 5555"
CLINIC_ADDRESS="Calle Falsa 123, CABA"
```

Read server-side only; missing values fail with a clear startup/validation error rather than rendering an incomplete invoice.

## Error Handling Summary

| Scenario                                 | Behavior                                                                      |
| ---------------------------------------- | ----------------------------------------------------------------------------- |
| No services recorded                     | Block generation; inline Spanish message telling staff to add services        |
| Service type without price               | Block generation; list which practices lack pricing with a link to `/precios` |
| Cancelled/deleted appointment            | Block generation                                                              |
| Future appointment                       | Block generation ("las facturas se emiten después del turno")                 |
| Patient missing/archived                 | Block generation                                                              |
| Consent denied / opt-out / invalid phone | Hide the WhatsApp section entirely; show the reason inline                    |
| Already sent invoice                     | Send button replaced by "Reenviar" flow (confirm + required reason)           |
| Empty/incomplete message render          | Service throws; inline error, no link rendered                                |
| Missing clinic env vars                  | Clear startup error; invoice page blocks with guidance                        |

## Correctness Properties

1. **Price snapshot** — for any invoice, its stored per-item prices equal the `service_prices` values current at generation; later changes never mutate existing snapshots. (Req 1.4, 3.5)
2. **Consent enforcement** — for any invoice send path, patients with `whatsappConsent !== 'granted'`, an `optedOutAt` value, or an invalid phone never render a link and never reach `markSent`. (Req 4.4, 4.5)
3. **Send is explicit** — `sentAt`/`'sent'` status and the `reminder_records` row are written only by staff confirmation actions, never as a side effect of generating or rendering. (Req 4.6)
4. **Resend requires reason** — a `'resent'` snapshot always has a non-empty `resentReason`, `resentOf`, and a new snapshot of current prices. (Req 5.3)
5. **Totals are derivable** — for any invoice snapshot, `total === Σ(subtotal_i)` and `subtotal_i === price_i × quantity_i`. (Req 3.1, 3.2)
6. **No duplicate appointment-service rows** — adding an existing type again updates the row's quantity instead of creating a second row. (Req 2.2)
7. **Protected access** — every load/action touching pricing, services, invoices, or history requires an authenticated session. (Security section of AGENTS.md)

## Testing Strategy

Unit (Vitest, mocked `better-sqlite3`/in-memory DB where the repo tests do the same):

1. Pricing: list/create/update, `updatedAt`/`updatedBy` recorded on change, `hasAllPrices` with missing/inactive entries.
2. Invoice service: guards (cancelled, future, archived, no services, missing prices), snapshot integrity, totals math, upsert-on-reselect, `markSent`/`markSkipped` reminder records, resend reason enforcement.
3. WhatsApp: invoice template rendering (list interpolation, empty-render fallback), `buildWaMeLink` digits-only.
4. Schemas: Valibot bounds (quantity 1–99, price ≥ 0, resend reason required).

Property-based (small generators; note repo tooling may not include fast-check — if not installed, cover each property with many fixed cases instead of adding a dependency, per "avoid new dependencies"):

- Properties 1, 2, 5, 6 from the correctness list across randomized service/quantity/price combinations.

E2E (Playwright, FAKE_CALENDAR fixtures, never opening real `wa.me` links):

- Add services → generate → see preview + plain anchor → confirm sent → history shows it; dashboard/patient views unaffected.
- Block paths: no services, cancelled appointment, denied consent (no link), resend forced confirmation.

## Out of Scope (unchanged)

Accounting/payments, taxes, multi-currency, PDFs/logo, invoice numbering, refunds, automatic sending, editing a generated invoice's fields, migrating templates to the `.md` file (existing behavior kept).
