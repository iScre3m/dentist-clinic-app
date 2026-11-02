# Implementation Plan: WhatsApp Invoice Templates

## Overview

This implementation plan covers the WhatsApp Invoice Templates feature, which adds professional invoice functionality to the WhatsApp messaging system. The feature enables dental staff to send itemized invoices to patients after appointments via WhatsApp, integrating with the existing SvelteKit + Drizzle ORM + SQLite architecture.

## Tasks

- [ ] 1. Set up database schema and migrations
  - [ ] 1.1 Create database migration file for new tables
    - Create `service_prices` table with columns: id, service_type, name, price, currency, is_active, updated_by, updated_at
    - Create `invoice_history` table with columns: id, invoice_number, appointment_id, patient_id, patient_name, patient_phone, invoice_date,   services, subtotal, total, currency, staff_id, staff_name, status, whatsapp_recorded_at, created_at, updated_at
    - Add appropriate indexes for all tables
    - _Requirements: 4.1, 4.3, 5.1_

  - [ ] 1.2 Update Drizzle schema definitions
    - Add `servicePrices` table definition to `schema.ts`
    - Add `invoiceHistory` table definition to `schema.ts`
    - Export new types: ServicePrice, NewServicePrice, InvoiceHistory, NewInvoiceHistory
    - _Requirements: 4.1, 4.3, 5.1_

  - [ ] 1.3 Run database migration
    - Execute the migration file to create new tables
    - Verify tables are created with correct schema
    - _Requirements: 4.1, 4.3, 5.1_

- [ ] 2. Implement backend services
  - [ ] 2.1 Create PricingService
    - Implement `getAllPrices()` method to retrieve all active service prices
    - Implement `updatePrice(serviceType, price, reason, staffId)` method to update prices and create history record
    - Implement `getPriceForService(serviceType)` method to retrieve a single price
    - Implement `hasAllPrices(serviceTypes)` validation method
    - _Requirements: 1.1, 1.2, 1.5_

  - [ ] 2.2 Create InvoiceService
    - Implement `generateInvoice(appointmentId, services, staffId)` method to create invoice records
    - Implement `getInvoiceById(invoiceId)` method to retrieve invoice by ID
    - Implement `getInvoicesByAppointmentId(appointmentId)` method to retrieve invoices for an appointment
    - Implement `getInvoicesByDateRange(startDate, endDate)` method for filtering
    - Implement `updateInvoiceStatus(invoiceId, status)` method for status updates
    - Implement `getInvoiceNumber()` method to generate unique invoice numbers (INV-YYYY-NNN format)
    - _Requirements: 2.1, 2.2, 2.3, 4.1, 4.2, 4.3, 4.4_

  - [ ] 2.3 Update WhatsAppService
    - Add `invoice` template to TEMPLATES object
    - Implement `generateInvoiceMessage(invoiceData)` method to format invoice for WhatsApp
    - Implement `sendInvoiceViaWhatsApp(invoiceId, staffId)` method to send invoice
    - Create reminder_records entry with purpose='invoice' when sending
    - Handle invoice resends with status='resent' and new reminder record
    - _Requirements: 3.1, 3.2, 3.4, 3.5, 3.6_

- [ ] 3. Implement API endpoints
  - [ ] 3.1 Create pricing API endpoints
    - `GET /api/prices` - Retrieve all active service prices
    - `POST /api/prices` - Update service price with history tracking
    - Return proper error responses for validation failures
    - _Requirements: 1.1, 1.2, 1.5_

  - [ ] 3.2 Create invoice API endpoints
    - `GET /api/invoices/appointment/:id` - Get invoice data for appointment
    - `POST /api/invoices` - Generate invoice with service data
    - `GET /api/invoices/history` - Get invoice history with filtering
    - `POST /api/invoices/:id/resent` - Resend invoice with confirmation
    - Return proper error responses for validation failures
    - _Requirements: 2.1, 2.2, 2.3, 4.1, 4.2, 4.3, 4.4, 4.5_

  - [ ] 3.3 Create WhatsApp invoice endpoints
    - `POST /api/whatsapp/invoice` - Send invoice via WhatsApp
    - Validate patient WhatsApp consent
    - Validate patient phone number
    - Return WhatsApp link with pre-filled message
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8_

- [ ] 4. Implement frontend components
  - [ ] 4.1 Create PricingManager.svelte
    - Display list of all service types with current prices
    - Implement inline price editing with validation
    - Add price change modal with reason input
    - Show service type that lacks pricing
    - _Requirements: 1.1, 1.5_

  - [ ] 4.2 Create ServicePriceRow.svelte
    - Display individual service type, name, and price
    - Implement edit button for price changes
    - Show validation errors for missing prices
    - _Requirements: 1.1, 1.5_

  - [ ] 4.3 Create PriceChangeModal.svelte
    - Modal form for price changes
    - Input for new price with validation
    - Input for change reason
    - Confirmation and cancel buttons
    - _Requirements: 1.2_

  - [ ] 4.4 Create InvoiceGenerator.svelte
    - Display appointment summary with services
    - Show price calculation for each service
    - Display subtotal and total amounts
    - Include patient information
    - Include clinic information
    - Validate all services have prices before generating
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8_

  - [ ] 4.5 Create InvoicePreview.svelte
    - Professional invoice preview before sending
    - Display all invoice details in formatted layout
    - Include services with prices and subtotals
    - Display totals clearly
    - Include patient and clinic information
    - _Requirements: 2.1, 2.2, 2.3, 3.8_

  - [ ] 4.6 Create WhatsAppInvoiceSender.svelte
    - Button to generate WhatsApp link
    - Display WhatsApp message preview
    - Open wa.me link in new tab
    - Record delivery in reminder_records table
    - Handle resends with confirmation
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8_

  - [ ] 4.7 Create invoice history component
    - Display list of all invoices with filtering
    - Show invoice date, patient name, total amount, status
    - Implement date range filtering
    - Implement patient name filtering
    - Implement status filtering
    - _Requirements: 4.4, 4.5, 4.6_

- [ ] 5. Implement route pages
  - [ ] 5.1 Create /pricing route
    - Set up pricing page with PricingManager component
    - Implement navigation to pricing page
    - _Requirements: 1.1_

  - [ ] 5.2 Create /turnos/[id]/factura route
    - Set up invoice generation page with InvoiceGenerator component
    - Implement navigation from appointment view
    - _Requirements: 2.1_

  - [ ] 5.3 Create /turnos/[id]/factura/enviar route
    - Set up WhatsApp invoice sending page with WhatsAppInvoiceSender component
    - Implement navigation from invoice preview
    - _Requirements: 3.1_

- [ ] 6. Implement testing
  - [ ] 6.1 Write unit tests for PricingService
    - Test getAllPrices() returns correct data
    - Test updatePrice() creates history record
    - Test hasAllPrices() validation works
    - _Requirements: 1.1, 1.2, 1.5_

  - [ ] 6.2 Write unit tests for InvoiceService
    - Test generateInvoice() creates records
    - Test totals calculation is accurate
    - Test invoice number generation is unique
    - Test status transitions work correctly
    - _Requirements: 2.1, 2.2, 2.3, 4.1, 4.3_

  - [ ] 6.3 Write unit tests for WhatsAppService
    - Test generateInvoiceMessage() formats correctly
    - Test sendInvoiceViaWhatsApp() validates consent
    - Test reminder_records creation
    - _Requirements: 3.1, 3.2, 3.3, 3.4_

  - [ ] 6.4 Write integration tests for complete flows
    - Test complete invoice generation flow
    - Test price history accuracy
    - Test WhatsApp integration end-to-end
    - Test error handling scenarios
    - _Requirements: 1.1, 1.2, 1.5, 2.1, 2.2, 2.3, 2.7, 2.8, 3.1, 3.2, 3.3, 3.4, 4.1, 4.2, 4.3, 4.4, 5.1_

  - [ ] 6.5 Write property tests for correctness properties
    - **Property 1: Price History Integrity** - Verify every price update creates history record
    - **Property 2: Invoice Price Snapshot** - Verify invoices use prices at generation time
    - **Property 3: WhatsApp Consent Enforcement** - Verify consent prevents delivery
    - **Property 4: Invoice Number Uniqueness** - Verify unique invoice numbers
    - **Property 5: Invoice Status Sequence** - Verify valid status transitions
    - **Property 6: Invoice Number Format** - Verify INV-YYYY-NNN format
    - _Requirements: 1.2, 1.4, 2.6, 3.3, 3.4, 4.1, 4.3_

- [ ] 7. Documentation
  - [ ] 7.1 Create staff documentation
    - Document how to access pricing management
    - Document how to update service prices
    - Document how to generate invoices
    - Document how to send invoices via WhatsApp
    - _Requirements: 1.1, 1.2, 2.1, 3.1_

  - [ ] 7.2 Document API endpoints
    - Document /api/prices endpoints
    - Document /api/invoices endpoints
    - Document /api/whatsapp/invoice endpoint
    - Include request/response examples
    - Include error responses
    - _Requirements: 1.1, 2.1, 3.1_

  - [ ] 7.3 Document data models
    - Document service_prices table structure
    - Document invoice_history table structure
    - Document relationships between tables
    - _Requirements: 1.1, 2.1, 4.1_

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties
- Unit tests validate specific examples and edge cases

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.2"] },
    { "id": 1, "tasks": ["1.3", "2.1", "2.2"] },
    { "id": 2, "tasks": ["2.3", "3.1", "3.2"] },
    { "id": 3, "tasks": ["3.3", "4.1", "4.2", "4.3"] },
    { "id": 4, "tasks": ["4.4", "4.5", "4.6", "4.7"] },
    { "id": 5, "tasks": ["5.1", "5.2", "5.3"] },
    { "id": 6, "tasks": ["6.1", "6.2", "6.3"] },
    { "id": 7, "tasks": ["6.4", "6.5"] },
    { "id": 8, "tasks": ["7.1", "7.2", "7.3"] }
  ]
}
```
