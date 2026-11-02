# Design Document: WhatsApp Invoice Templates

## Overview

This design document outlines the architecture and implementation approach for adding professional invoice functionality to the WhatsApp messaging system. The feature enables dental staff to send itemized invoices to patients after appointments via WhatsApp, integrating seamlessly with the existing SvelteKit + Drizzle ORM + SQLite architecture.

## Architecture

### System Components

```
┌─────────────────────────────────────────────────────────────────────┐
│                        Frontend UI Layer                             │
│  ┌─────────────────┐  ┌──────────────────┐  ┌──────────────────┐   │
│  │ PricingManager   │  │ InvoiceGenerator │  │ WhatsAppSender   │   │
│  │   (Svelte)       │  │   (Svelte)       │  │   (Svelte)       │   │
│  └─────────────────┘  └──────────────────┘  └──────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────────┐
│                        API Endpoints Layer                           │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐   │
│  │ /api/prices      │  │ /api/invoices    │  │ /api/whatsapp    │   │
│  │   (server.ts)    │  │   (server.ts)    │  │   (server.ts)    │   │
│  └──────────────────┘  └──────────────────┘  └──────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────────┐
│                        Service Layer                                 │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐   │
│  │  PricingService  │  │  InvoiceService  │  │ WhatsAppService  │   │
│  └──────────────────┘  └──────────────────┘  └──────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────────┐
│                        Database Layer (Drizzle ORM)                  │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │  SQLite Database with new tables:                             │  │
│  │  - service_prices (for current prices)                        │  │
│  │  - invoice_history (for invoice audit trail)                  │  │
│  └───────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
```

## Data Models

### Service Prices

```typescript
import { sqliteTable, text, integer, boolean } from 'drizzle-orm/sqlite-core';

export const servicePrices = sqliteTable('service_prices', {
  id: text('id').primaryKey(),
  serviceType: text('service_type').notNull().unique(),
  name: text('name').notNull(),
  price: integer('price').notNull(),
  currency: text('currency', { enum: ['ARS'] }).notNull().default('ARS'),
  isActive: boolean('is_active').notNull().default(true),
  updatedBy: text('updated_by')
    .notNull()
    .references(() => user.id),
  updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
    .notNull()
    .default(sql`(unixepoch() * 1000)`)
});

export type ServicePrice = typeof servicePrices.$inferSelect;
export type NewServicePrice = typeof servicePrices.$inferInsert;
```

### Invoice History

```typescript
export const invoiceHistory = sqliteTable('invoice_history', {
  id: text('id').primaryKey(),
  invoiceNumber: text('invoice_number').notNull().unique(),
  appointmentId: text('appointment_id')
    .notNull()
    .references(() => appointments.id, { onDelete: 'cascade' }),
  patientId: text('patient_id')
    .notNull()
    .references(() => patients.id),
  patientName: text('patient_name').notNull(),
  patientPhone: text('patient_phone').notNull(),
  invoiceDate: text('invoice_date').notNull(),
  services: text('services', { mode: 'json' }).notNull(),
  subtotal: integer('subtotal').notNull(),
  total: integer('total').notNull(),
  currency: text('currency', { enum: ['ARS'] }).notNull().default('ARS'),
  staffId: text('staff_id')
    .notNull()
    .references(() => user.id),
  staffName: text('staff_name').notNull(),
  status: text('status', { enum: ['generated', 'sent', 'resent'] })
    .notNull()
    .default('generated'),
  whatsappRecordedAt: integer('whatsapp_recorded_at', { mode: 'timestamp_ms' }),
  createdAt: integer('created_at', { mode: 'timestamp_ms' })
    .notNull()
    .default(sql`(unixepoch() * 1000)`),
  updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
    .notNull()
    .default(sql`(unixepoch() * 1000)`)
});

export type InvoiceHistory = typeof invoiceHistory.$inferSelect;
export type NewInvoiceHistory = typeof invoiceHistory.$inferInsert;
```

## Components and Interfaces

### 1. Pricing Management Interface

**Route:** `/pricing` (new page)

**Components:**
- `PricingManager.svelte` - Main container component
- `ServicePriceRow.svelte` - Individual service price display and edit
- `PriceChangeModal.svelte` - Modal for price changes with history

**API Endpoints:**
- `GET /api/prices` - Retrieve all active service prices
- `POST /api/prices` - Update service price

**Request/Response:**

**GET /api/prices Response:**
```json
{
  "prices": [
    {
      "id": "uuid-1",
      "serviceType": "consultation",
      "name": "Consultoria",
      "price": 5500,
      "currency": "ARS",
      "isActive": true,
      "updatedBy": "staff-id",
      "updatedAt": "2024-01-15T10:30:00Z"
    }
  ]
}
```

**POST /api/prices Request:**
```json
{
  "serviceType": "consultation",
  "price": 5500,
  "reason": "Annual price adjustment"
}
```

**POST /api/prices Response:**
```json
{
  "success": true,
  "updatedPrice": {
    "id": "uuid-1",
    "serviceType": "consultation",
    "name": "Consultoria",
    "price": 5500,
    "currency": "ARS",
    "isActive": true
  }
}
```

### 2. Invoice Generation Interface

**Route:** `/turnos/[id]/factura` (new sub-route)

**Components:**
- `InvoiceGenerator.svelte` - Main invoice generation interface
- `InvoicePreview.svelte` - Invoice data preview before sending

**API Endpoints:**
- `GET /api/invoices/appointment/:id` - Get invoice data for appointment
- `POST /api/invoices` - Generate invoice

**Request/Response:**

**GET /api/invoices/appointment/:id Response:**
```json
{
  "appointment": {
    "id": "appointment-uuid",
    "summary": "Chequeo general",
    "startsAt": "2024-01-20T10:00:00Z",
    "endsAt": "2024-01-20T11:00:00Z"
  },
  "patient": {
    "id": "patient-uuid",
    "name": "Juan Perez",
    "phone": "+5491112345678",
    "whatsappConsent": "granted"
  },
  "services": [
    {
      "serviceType": "consultation",
      "name": "Consultoria",
      "price": 5500,
      "quantity": 1,
      "subtotal": 5500
    }
  ],
  "subtotal": 13500,
  "currency": "ARS"
}
```

**POST /api/invoices Request:**
```json
{
  "appointmentId": "appointment-uuid",
  "services": [
    {
      "serviceType": "consultation",
      "name": "Consultoria",
      "price": 5500,
      "quantity": 1,
      "subtotal": 5500
    }
  ],
  "subtotal": 5500,
  "currency": "ARS"
}
```

**POST /api/invoices Response:**
```json
{
  "success": true,
  "invoice": {
    "id": "invoice-uuid",
    "invoiceNumber": "INV-2024-001",
    "appointmentId": "appointment-uuid",
    "patientName": "Juan Perez",
    "patientPhone": "+5491112345678",
    "invoiceDate": "2024-01-15",
    "services": [...],
    "subtotal": 5500,
    "total": 5500,
    "currency": "ARS"
  }
}
```

### 3. WhatsApp Invoice Sender

**Route:** `/turnos/[id]/factura/enviar` (new sub-route)

**Components:**
- `WhatsAppInvoiceSender.svelte` - Main WhatsApp sending interface

**API Endpoints:**
- `POST /api/whatsapp/invoice` - Send invoice via WhatsApp

**Request/Response:**

**POST /api/whatsapp/invoice Request:**
```json
{
  "invoiceId": "invoice-uuid"
}
```

**POST /api/whatsapp/invoice Response:**
```json
{
  "success": true,
  "waLink": "https://wa.me/5491112345678?text=...",
  "messagePreview": "Invoice message text..."
}
```

## Database Schema

### Migration File: `0004_invoicing_system.sql`

```sql
-- Service Prices Table
CREATE TABLE service_prices (
    id TEXT PRIMARY KEY NOT NULL,
    service_type TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    price INTEGER NOT NULL,
    currency TEXT NOT NULL DEFAULT 'ARS',
    is_active BOOLEAN NOT NULL DEFAULT 1,
    updated_by TEXT NOT NULL REFERENCES user(id),
    updated_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
);

CREATE INDEX service_prices_service_type_idx ON service_prices(service_type);
CREATE INDEX service_prices_is_active_idx ON service_prices(is_active);

-- Invoice History Table
CREATE TABLE invoice_history (
    id TEXT PRIMARY KEY NOT NULL,
    invoice_number TEXT NOT NULL UNIQUE,
    appointment_id TEXT NOT NULL REFERENCES appointments(id) ON DELETE CASCADE,
    patient_id TEXT NOT NULL REFERENCES patients(id),
    patient_name TEXT NOT NULL,
    patient_phone TEXT NOT NULL,
    invoice_date TEXT NOT NULL,
    services TEXT NOT NULL,
    subtotal INTEGER NOT NULL,
    total INTEGER NOT NULL,
    currency TEXT NOT NULL DEFAULT 'ARS',
    staff_id TEXT NOT NULL REFERENCES user(id),
    staff_name TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'generated',
    whatsapp_recorded_at INTEGER,
    created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
    updated_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
);

CREATE INDEX invoice_history_appointment_idx ON invoice_history(appointment_id);
CREATE INDEX invoice_history_patient_idx ON invoice_history(patient_id);
CREATE INDEX invoice_history_status_idx ON invoice_history(status);
CREATE INDEX invoice_history_created_at_idx ON invoice_history(created_at);
CREATE INDEX invoice_history_invoice_number_idx ON invoice_history(invoice_number);
```

## Integration Points

### Existing WhatsApp Infrastructure

The design integrates with the existing WhatsApp infrastructure in `src/lib/server/services/whatsapp/index.ts`:

1. **Template Rendering:** Uses existing `renderTemplate()` function
2. **wa.me Link Building:** Uses existing `buildWaMeLink()` function
3. **Message Format:** Follows existing WhatsApp message conventions

### New WhatsApp Template

```typescript
// Add to TEMPLATES object
invoice: `*Factura {invoice_number}*\n\nPaciente: {patient_name}\nFecha: {invoice_date}\n\nServicios:\n{services_list}\n\nSubtotal: ${subtotal}\nTotal: ${total}\n\nConsultorio Dra. Laura\nTelefono: +54 9 11 1111 1111`
```

### Reminder Records Integration

Invoices are recorded in the existing `reminder_records` table:
- `purpose`: 'invoice'
- `template_key`: 'invoice'
- `status`: 'sent' (when delivered)
- Records both initial sending and resends

## Error Handling

### 1. Missing Service Prices

**Scenario:** Attempting to generate invoice when some services have no price.

**Handling:**
- Validate all services have prices before generation
- Return specific error message listing missing prices
- Allow staff to add missing prices before retrying

**Response:**
```json
{
  "success": false,
  "error": "Missing service prices",
  "missingPrices": ["extraction"]
}
```

### 2. Patient WhatsApp Consent

**Scenario:** Patient has not consented to WhatsApp messages.

**Handling:**
- Check consent before generating WhatsApp link
- Return clear error message
- Allow alternative delivery methods (print, email)

**Response:**
```json
{
  "success": false,
  "error": "Patient has not consented to WhatsApp messages"
}
```

### 3. Invoice Already Sent

**Scenario:** Staff attempts to send invoice that was already sent.

**Handling:**
- Check current status
- Require confirmation for resending
- Create new record with 'resent' status
- Update reminder_records with resent flag

**Response:**
```json
{
  "success": true,
  "action": "resent",
  "message": "Invoice resent successfully"
}
```

### 4. Invalid Patient Phone

**Scenario:** Patient's phone number is missing or invalid.

**Handling:**
- Validate phone format before building WhatsApp link
- Return specific error message
- Allow manual phone entry or alternative delivery

**Response:**
```json
{
  "success": false,
  "error": "Invalid or missing phone number"
}
```

### 5. Appointment Without Services

**Scenario:** Attempting to generate invoice for appointment with no recorded services.

**Handling:**
- Validate services exist before generation
- Prevent invoice creation
- Allow staff to add service information to appointment first

**Response:**
```json
{
  "success": false,
  "error": "No services recorded for this appointment"
}
```

### 6. Price History Accuracy

**Scenario:** Invoice needs to show price that was current at time of invoice generation, not current price.

**Handling:**
- Snapshot prices at invoice generation time
- Store in `services` JSON field
- Use historical prices for any future invoice review

**Implementation:**
```typescript
// Store snapshot of prices at invoice generation time
const serviceSnapshot = {
  serviceType: service.serviceType,
  name: currentPrice.name,
  price: currentPrice.price,
  quantity: service.quantity,
  subtotal: currentPrice.price * service.quantity
};
```

### 7. Concurrent Price Updates

**Scenario:** Price updated while staff is preparing invoice.

**Handling:**
- Snapshot prices at invoice generation time
- Invoice uses prices that were current at that moment
- Staff sees snapshot, not real-time prices

**Implementation:**
```typescript
// Get prices at invoice generation time
const pricesAtGeneration = await getCurrentPrices();

// Use these prices for invoice calculation
const invoiceServices = appointmentServices.map(s => ({
  ...s,
  price: pricesAtGeneration[s.serviceType].price,
  subtotal: pricesAtGeneration[s.serviceType].price * s.quantity
}));
```

## Correctness Properties

### Property 2: Invoice Price Snapshot

*For any* invoice generated, the services stored should use prices that were current at the time of generation, not any subsequent price changes.

**Validates: Requirements 1.4, 2.6**

**Test Strategy:** Generate random invoice, then update the price, then verify the invoice still shows the original price. Test with multiple price changes over time.

### Property 3: WhatsApp Consent Enforcement

*For any* invoice send attempt, if the patient has not granted WhatsApp consent or has opted out, the system should prevent delivery and return an appropriate error.

**Validates: Requirements 3.3, 3.4**

**Test Strategy:** Generate invoices for patients with various consent states (granted, denied, opted out). Verify delivery is prevented and correct error is returned.

### Property 4: Invoice Number Uniqueness

*For any* invoice generation request, the system should create a unique invoice number and reject duplicate requests.

**Validates: Requirements 4.1**

**Test Strategy:** Generate multiple invoices rapidly in parallel. Verify all invoice numbers are unique and no duplicates are created.

### Property 5: Invoice Status Sequence

*For any* invoice, the status should follow a valid sequence (generated → sent → resent) and prevent invalid transitions.

**Validates: Requirements 4.3**

**Test Strategy:** Test all valid status transitions and verify invalid transitions are rejected with appropriate errors.

### Property 6: Invoice Number Format

*For any* invoice generated, the invoice number should follow the format 'INV-YYYY-NNN' where YYYY is the current year and NNN is a sequential number.

**Validates: Requirements 4.1**

**Test Strategy:** Generate invoices across multiple years and verify the format is consistent and sequential.

## Testing Strategy

### Unit Tests

1. **Pricing Service:**
   - Price retrieval returns correct data
   - Price updates create history records
   - Missing prices validation works

2. **Invoice Service:**
   - Invoice generation creates records
   - Totals calculation is accurate
   - Price snapshotting works correctly

3. **WhatsApp Service:**
   - WhatsApp link generation works
   - Consent validation works
   - Patient validation works

### Integration Tests

1. **End-to-End Invoice Generation:**
   - Complete invoice generation flow
   - Price snapshotting with history
   - WhatsApp integration

2. **Price History Accuracy:**
   - Invoice shows correct historical price
   - Price changes don't affect existing invoices

3. **WhatsApp Integration:**
   - Consent checking
   - Phone validation
   - Reminder records creation

### Property-Based Testing

See Correctness Properties section above for specific properties to test with property-based testing libraries.

## Implementation Checklist

### Phase 1: Database Schema
- [ ] Create `service_prices` table
- [ ] Create `invoice_history` table
- [ ] Create database migration scripts
- [ ] Update Drizzle schema definitions

### Phase 2: Backend Services
- [ ] Implement PricingService methods
- [ ] Implement InvoiceService methods
- [ ] Update WhatsApp service with invoice template
- [ ] Implement API endpoints

### Phase 3: Frontend Components
- [ ] Create PricingManager.svelte
- [ ] Create ServicePriceRow.svelte
- [ ] Create InvoiceGenerator.svelte
- [ ] Create InvoicePreview.svelte
- [ ] Create WhatsAppInvoiceSender.svelte

### Phase 4: Integration
- [ ] Connect frontend to API endpoints
- [ ] Implement pricing management UI
- [ ] Implement invoice generation flow
- [ ] Implement WhatsApp sending flow
- [ ] Implement invoice history display

### Phase 5: Testing
- [ ] Write unit tests
- [ ] Write integration tests
- [ ] Test error handling scenarios
- [ ] Test price history accuracy
- [ ] Test WhatsApp consent validation

### Phase 6: Documentation
- [ ] Update user documentation
- [ ] Create staff training materials
- [ ] Document API endpoints
- [ ] Document data models

## Conclusion

This design provides a comprehensive blueprint for implementing WhatsApp invoice functionality in the Dentist Admin application. The solution leverages the existing architecture patterns and integrates seamlessly with the current WhatsApp infrastructure while maintaining data integrity and providing a robust user interface for staff.