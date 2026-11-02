# Requirements Document

## Introduction

This feature adds professional invoice functionality to the WhatsApp messaging system, allowing dental staff to send itemized invoices to patients after appointments. The system will store fixed prices for service types (consultation, cleaning, filling, extraction, etc.) and enable manual invoice generation and delivery via WhatsApp using the existing WhatsApp infrastructure.

## Glossary

- **System**: The Dentist Admin application
- **Service Type**: A standardized dental service category (e.g., consultation, cleaning, filling, extraction) with a fixed price
- **Invoice**: A professional document containing services rendered, individual prices, and total amount for a patient
- **Staff**: Registered dental practice staff members who can send invoices to patients
- **Patient**: A registered patient who has consented to receive WhatsApp messages
- **WhatsApp Infrastructure**: The existing system for sending WhatsApp messages via wa.me links and message templates

## Requirements

### Requirement 1: Service Type Price Management

**User Story:** As a system administrator, I want to store and manage fixed prices for service types, so that invoices are consistent and accurate.

#### Acceptance Criteria

1. WHEN a staff member accesses the service price configuration, THE System SHALL display a list of all service types with their current prices
2. WHEN service prices are updated, THE System SHALL log the change with timestamp and staff identifier
3. WHERE a service type is newly added, THE System SHALL allow setting an initial price
4. WHILE a service price is displayed on an invoice, THE System SHALL use the price that was current at the time of invoice generation
5. IF a service type has no price configured, THEN THE System SHALL indicate that pricing is missing and prevent invoice generation for services with missing prices

### Requirement 2: Invoice Generation and Content

**User Story:** As a staff member, I want to generate a professional invoice for a completed appointment, so that patients receive clear and itemized billing information.

#### Acceptance Criteria

1. WHEN staff manually triggers invoice generation for an appointment, THE System SHALL collect all services performed during that appointment
2. WHEN services are retrieved for an appointment, THE System SHALL include the service type name, quantity, individual price, and subtotal for each service
3. THE System SHALL calculate and display the grand total of all services
4. THE System SHALL include patient name, phone number, and appointment date in the invoice
5. THE System SHALL include clinic name, address, and contact information in the invoice
6. WHERE services are retrieved for an invoice, THE System SHALL use the service type prices that were current at the time of invoice generation
7. IF no services are recorded for an appointment, THEN THE System SHALL prevent invoice generation and display an error message
8. IF service prices are missing for any service in the appointment, THEN THE System SHALL show which services lack pricing before allowing invoice generation

### Requirement 3: WhatsApp Invoice Delivery

**User Story:** As a staff member, I want to send an invoice to a patient via WhatsApp, so that patients receive their billing information through their preferred communication channel.

#### Acceptance Criteria

1. WHEN staff confirms invoice delivery via WhatsApp, THE System SHALL construct a WhatsApp message using the invoice data and existing WhatsApp template infrastructure
2. WHEN the WhatsApp message is constructed, THE System SHALL format the invoice professionally using line breaks and spacing appropriate for WhatsApp
3. WHERE a patient has not consented to WhatsApp messages, THEN THE System SHALL prevent invoice delivery and display an error message
4. WHERE a patient's phone number is invalid or missing, THEN THE System SHALL prevent invoice delivery and display an error message
5. WHEN staff opens the WhatsApp invoice link, THE System SHALL open wa.me with a pre-filled message containing the invoice
6. WHEN staff sends the invoice via WhatsApp, THE System SHALL record the delivery in the reminder_records table with purpose 'invoice'
7. IF WhatsApp message template for invoices is missing or invalid, THEN THE System SHALL use a fallback format and log the template error
8. WHILE staff reviews the invoice message before sending, THE System SHALL display the complete invoice content in a readable format

### Requirement 4: Invoice History and Tracking

**User Story:** As a staff member, I want to track which invoices have been sent and when, so that the practice maintains an audit trail of billing communications.

#### Acceptance Criteria

1. WHEN an invoice is generated, THE System SHALL store the invoice data in a persistent history table
2. WHEN an invoice is sent via WhatsApp, THE System SHALL update the status to 'sent' and record the timestamp
3. IF staff attempts to send an invoice that was already sent, THEN THE System SHALL require confirmation and create a new record with 'resent' status
4. WHERE invoice history is viewed, THE System SHALL display invoice date, patient name, total amount, and delivery status
5. WHEN invoice history is requested, THE System SHALL support filtering by date range, patient name, and delivery status
6. IF invoice history is requested for a date range, THE System SHALL include invoices sent during that period based on recorded timestamp

### Requirement 5: Integration with Existing Systems

**User Story:** As a staff member, I want the invoice feature to integrate with existing appointment and patient data, so that I don't need to re-enter information.

#### Acceptance Criteria

1. WHEN invoice generation is triggered, THE System SHALL automatically retrieve the appointment date and time from the existing appointments table
2. WHEN patient information is required, THE System SHALL retrieve it from the existing patients table
3. WHEN services for an appointment are requested, THE System SHALL look up services from the appointment record
4. WHERE an appointment is linked to a patient, THE System SHALL validate that the patient exists before generating an invoice
5. WHEN the clinic information is required, THE System SHALL retrieve it from environment variables or configuration
6. IF the appointment or patient record is missing or archived, THEN THE System SHALL prevent invoice generation with an appropriate error message

## Success Metrics

- **Accuracy**: 100% of invoices generated use correct, up-to-date service prices
- **Efficiency**: Staff can generate and send an invoice in under 30 seconds from start to WhatsApp message
- **Completeness**: All invoices include required information: services, prices, total, patient info, clinic info, and date
- **Integration**: 95% of invoices use data from existing appointment records without manual re-entry
- **Delivery**: 100% of invoice attempts are properly tracked in the reminder_records table
- **User satisfaction**: Staff report that invoice generation is faster and more accurate than manual processes

## Excluded Requirements

- Automated automatic invoice sending (manual trigger only)
- Integration with accounting software or payment processing
- Tax calculation or tax display on invoices
- Multiple currency support
- Invoice templates with logo or branding images
- PDF generation or download
- Invoice numbering system
- Refund processing
