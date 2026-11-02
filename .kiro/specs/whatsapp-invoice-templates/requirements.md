# Requirements Document

## Introduction

This feature adds manual itemized invoice functionality to the WhatsApp messaging system, allowing dental staff to send itemized invoices to patients after appointments. Staff record which services were performed on an appointment (multi-select from a fixed catalog of service types with fixed prices), generate an invoice, preview it, and deliver it via WhatsApp using the existing `wa.me` link + template infrastructure. Nothing is sent automatically.

## Scope Note

This spec deliberately extends the product scope defined in `AGENTS.md`, which listed billing and invoices as out of scope. The practice has explicitly requested this feature as a scope revision. Everything else in `AGENTS.md` remains authoritative: no accounting/payments integration, no PDF, no automatic sending, and the technical conventions (validation, security, architecture, UX) must be followed.

Related deliberate revisions to `AGENTS.md`:

- `reminder_records.purpose` is extended with the value `'invoice'`.
- Three new tables (`service_prices`, `appointment_services`, `invoice_history`) are added to the MVP data model, following the same conventions as the rest of the schema.

## Glossary

- **System**: The Dentist Admin application
- **Service Type**: A standardized dental service category (e.g., consultation, cleaning, filling, extraction) with a fixed price, managed by staff
- **Appointment Service**: A service type (with quantity) recorded by staff on an appointment
- **Invoice**: A document containing services rendered, individual prices, and the total amount for a patient
- **Staff**: Registered dental practice staff members who can record services, generate, and send invoices
- **Patient**: A registered patient; invoice delivery respects WhatsApp consent and opt-out state
- **WhatsApp Infrastructure**: The existing system for preparing WhatsApp messages via templates and `wa.me` links

## Requirements

### Requirement 1: Service Type Price Management

**User Story:** As a staff member, I want to store and manage fixed prices for service types, so that invoices are consistent and accurate.

#### Acceptance Criteria

1. WHEN a staff member opens the pricing page, THE System SHALL display a list of all service types with their current prices
2. WHEN a price is updated, THE System SHALL record the update on the service type (`price`, `updated_by`, `updated_at`); the System intentionally keeps no price-change log because invoices always snapshot prices at generation time
3. WHERE a service type is newly added, THE System SHALL allow setting an initial price
4. WHILE a service type is displayed on an invoice, THE System SHALL use the price that was current at the time of invoice generation (price snapshot)
5. IF a service type is inactive, THEN THE System SHALL hide it from the service multi-select but keep it resolvable for historical invoices
6. THE System SHALL keep prices in Argentine pesos (ARS) as integer amounts without decimals

### Requirement 2: Recording Services on Appointments

**User Story:** As a staff member, I want to record which services were performed during an appointment, so that an itemized invoice can be generated later.

#### Acceptance Criteria

1. WHEN staff opens the invoice page for an appointment, THE System SHALL show a multi-select of active service types to add services to the appointment
2. WHEN staff adds a service, THE System SHALL store the service type, a quantity (default 1, editable between 1 and 99), and who added it; repeated service types are added once with the cumulative quantity, not as duplicate rows
3. WHEN staff removes a service, THE System SHALL delete that appointment service row
4. THE System SHALL record services only for appointments linked to an existing, non-archived patient
5. THE System SHALL store only service type, quantity, and staff reference; no clinical notes, diagnoses, or treatment details

### Requirement 3: Invoice Generation and Content

**User Story:** As a staff member, I want to generate a professional invoice for a completed appointment, so that patients receive clear and itemized billing information.

#### Acceptance Criteria

1. WHEN staff opens the invoice page for a past appointment, THE System SHALL show all recorded services with the service type name, quantity, the price current at generation time, and the subtotal per service
2. THE System SHALL calculate and display the grand total of all services
3. THE System SHALL include patient name, phone number (E.164), and appointment date/time in the invoice
4. THE System SHALL include clinic name, phone, and address from environment configuration in the invoice
5. WHERE services are priced for an invoice, THE System SHALL snapshot the prices current at generation time into the invoice record; later price changes SHALL NOT affect existing invoices
6. IF no services are recorded for an appointment, THEN THE System SHALL prevent invoice generation and explain that services must be added first
7. IF any recorded service type has no price, THEN THE System SHALL show which services lack pricing and prevent invoice generation
8. IF the appointment is cancelled or deleted in the calendar, THEN THE System SHALL prevent invoice generation
9. IF the appointment start time is not in the past, THEN THE System SHALL prevent invoice generation with an appropriate message

### Requirement 4: WhatsApp Invoice Delivery

**User Story:** As a staff member, I want to send an invoice to a patient via WhatsApp, so that patients receive their billing information through their preferred communication channel.

#### Acceptance Criteria

1. WHEN staff confirms invoice delivery, THE System SHALL render the invoice message from the Spanish template infrastructure, formatting it with line breaks appropriate for WhatsApp
2. THE System SHALL show the complete invoice message preview before delivery, plus a copy-to-clipboard convenience (with the message in a selectable field as fallback)
3. THE System SHALL render the `wa.me` link as a plain anchor element (`<a href="https://wa.me/<digits>?text=...">`) in the page, digits only in the phone, so the browser treats opening it as a user gesture; the link must never be opened programmatically from a server action or after an `await`
4. WHERE a patient has not granted WhatsApp consent or has opted out, THEN THE System SHALL show no WhatsApp action at all and explain why
5. WHERE a patient's phone number is invalid or missing, THEN THE System SHALL show an inline error and no link
6. WHEN staff records the delivery, THE System SHALL store a `reminder_records` row with purpose `'invoice'`, template key `'invoice'`, and status (`sent` or `skipped`)
7. IF the invoice was already sent, THEN THE System SHALL require explicit confirmation plus a written reason before a resend, creating a new invoice record with status `'resent'` and a new reminder record
8. THE System SHALL never store the message body, `wa.me` URL, or any provider identifier

### Requirement 5: Invoice History and Tracking

**User Story:** As a staff member, I want to track which invoices have been sent and when, so that the practice maintains an audit trail of billing communications.

#### Acceptance Criteria

1. WHEN an invoice is generated, THE System SHALL store a snapshot of the invoice data (services, prices, totals, patient name and phone at that moment) in an invoice history table
2. WHEN an invoice is confirmed sent, THE System SHALL update its status to `'sent'` and record the timestamp
3. IF staff resends intentionally, THE System SHALL create a new record with status `'resent'`, the written reason, and a reference to the original invoice
4. WHEN invoice history is viewed, THE System SHALL display invoice date, patient name, total amount, and delivery status
5. THE System SHALL show a patient's invoice history on the patient detail page and an appointment's invoice history on the appointment invoice page
6. IF no invoices exist, THEN invoice views SHALL show an explicit empty state

## Success Metrics

- **Accuracy**: 100% of invoices generated use the prices current at generation time
- **Efficiency**: Staff can record services and send an invoice in under 60 seconds from start to WhatsApp message
- **Completeness**: All invoices include services, prices, total, patient info, clinic info, and appointment date
- **Delivery**: 100% of invoice delivery attempts are tracked in `reminder_records` with purpose `'invoice'`
- **Snapshot integrity**: every invoice stores the prices that were current at generation time, with the updating staff member and timestamp visible on the pricing page

## Data Retention

All billing data follows the same flat 90-day retention policy the app already applies to reminders and past appointments — there is no reason to keep information longer than that. **The service type catalog is the one exception:** active service types and their current prices do not expire and shall not be deleted.

1. THE System SHALL delete records older than 90 days from the new billing tables: `invoice_history` (by `created_at`)
2. WHERE an appointment deletion cascades (via `appointment_services` and `invoice_history` foreign keys), THEN deleting the appointment SHALL remove its services and invoices with it
3. THE System SHALL keep service types and their current prices indefinitely: they are reference data with no date of "use", never expire, and shall never be deleted — staff stop offering one only by deactivating it (`isActive = false`), which removes it from the multi-select but keeps the row resolvable for historical invoices and appointment services
4. Retention SHALL run through the existing `pnpm db:prune` script, not a new scheduler

## Excluded Requirements

- Automatic invoice sending (manual trigger only)
- Integration with accounting software or payment processing
- Tax calculation or tax display on invoices
- Multiple currency support
- Invoice templates with logo or branding images
- PDF generation or download
- Invoice numbering system
- Refund processing
- Editing quantities or prices on the invoice after generation (staff must correct the appointment services and regenerate)
