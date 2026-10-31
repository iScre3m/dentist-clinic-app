# AGENTS.md

## Project Overview

Build a lightweight web application for Dr. Laura's dental practice. The
practice has one dentist and one assistant.

The application supports the administrative workflows that are currently
difficult to manage manually:

1.  Reduce missed appointments by making appointment status and reminder
    history visible.
2.  Make it easy for the assistant to send WhatsApp appointment
    reminders manually.
3.  Help the practice follow up with patients who have incomplete,
    multi-session treatment plans.

This is an MVP for a single dental practice. Prefer the simplest
reliable implementation that solves these workflows. Do not introduce
infrastructure or features without a clear MVP requirement.

## Product Principles

-   Google Calendar remains the source of truth for appointment
    scheduling.
-   The assistant continues creating, rescheduling, and cancelling
    appointments in Google Calendar.
-   This application complements Google Calendar; it is not a
    replacement calendar.
-   WhatsApp reminders are sent manually by the assistant. Do not
    implement automatic reminder scheduling or automatic message sending
    in the MVP.
-   The application never contacts the WhatsApp Business Platform. It
    renders a message from a Spanish template and opens a `wa.me` link;
    the assistant sends the message from their own WhatsApp.
-   Reminder records only reflect what the assistant confirms. There is no
    provider message ID, delivery receipt, or read receipt.
-   Clinical decisions, including whether a treatment is complete, are
    made by the practice. The application records that decision; it never
    infers or substitutes for it.
-   The application is for administrative coordination, not clinical
    care.
-   Minimize the amount of patient information collected and stored.
-   Prefer explicit, understandable workflows over automation that could
    send messages or change appointment states unexpectedly.

## Technology Stack

Use the following stack unless the repository already contains an
established, justified alternative:

### Application

-   TypeScript
-   SvelteKit
-   Svelte 5
-   Tailwind CSS
-   shadcn-svelte
-   pnpm

### Validation and data

-   Valibot for runtime validation and TypeScript type inference.
-   SQLite as the MVP database.
-   Drizzle ORM and Drizzle Kit for database access, schema definitions,
    and migrations.
-   Better Auth for authentication, unless an existing project decision
    has already established another approach.

### Integrations

-   Google Calendar API for reading and synchronizing appointment
    events.
-   WhatsApp via `wa.me` deep links for manually initiated messages. No
    provider API, no access token, and no webhook.

### Quality

-   Playwright for end-to-end testing.
-   Vitest may be used for unit tests where it provides clear value.
-   ESLint and Prettier for linting and formatting.
-   Git and GitHub for version control.

### Explicitly not part of the current stack

-   PostgreSQL
-   Docker
-   GitHub Actions or other CI/CD workflows
-   Inngest, Trigger.dev, Redis, message queues, or dedicated background
    workers
-   Automatic WhatsApp reminder scheduling
-   WhatsApp Business Platform API, provider webhooks, and delivery or
    read receipts

Do not add these technologies unless the project requirements are
deliberately revised.

## MVP Scope

### 1. Authentication and users

-   Provide authenticated access to the application.
-   Support the two staff members: the dentist and the assistant.
-   Both accounts use the same user entity, the same dashboard, and
    identical permissions. Do not model a role distinction between
    dentist and assistant. The only distinction the data model makes is
    between a staff user and a patient.
-   Patients never log in: there are no patient accounts, passwords, or
    sessions. They have exactly one public page — the registration form —
    where they enter their name, WhatsApp number, and consent.
-   Staff never create patient records. They may correct a name or number,
    but new patients come from the registration form.
-   Do not build multi-tenant organization management, social login,
    complex role hierarchies, or user invitation workflows unless
    specifically requested.
-   Protect all server-side routes and operations that expose patient or
    appointment information.

### 2. Patient management

Support the minimum information needed for appointment coordination:

-   Patient name, used only in messages. It is not an identifier, is not
    unique, and is never used for matching.
-   WhatsApp phone number in E.164 format. This is the patient's unique
    identifier and is required; there is no patient account or
    self-registration. International numbers are supported, not only
    Argentine ones.
-   Email address, if useful and provided.
-   WhatsApp consent status and relevant consent/opt-out information.
-   Links to the patient's appointments and follow-up tasks.

A patient is identified by their phone number. Two patients cannot share
a number, and correcting a number updates that patient instead of
creating a second record. The same person registering two different
numbers becomes two patients; that is acceptable and no merge is needed.

A number starts as unverified and staff confirm it at the first visit.
Unverified is shown as a badge, never as a block.

Phone normalization:

-   Normalize every number on save with `libphonenumber-js`, using the
    country selected for the patient (default `AR`). Store only E.164,
    for example `+5491155555555` or `+525512345678`.
-   Let the library apply each country's mobile rules. Argentina needs the
    `9` after the country code (`+54 9 11 ...`); Mexico dropped its `1` and
    normalizes to `+52 55 ...`. Never hardcode one country's rule for all
    patients.
-   Reject numbers that are not valid mobile numbers for their country,
    and explain why instead of saving a guess.
-   The same E.164 value is used for calendar matching, duplicate
    detection, and the WhatsApp link, so those three can never disagree.

Registration and consent:

-   Patients register through a public page: name, WhatsApp number, and a
    checkbox accepting reminders and notices by WhatsApp. No password, no
    account, no login.
-   Registration records `consent_source = 'registration'`,
    `consent_recorded_at`, and the version of the consent text shown.
-   Registration is idempotent: a number that already exists updates the
    consent and never creates a second patient. The page must not reveal
    whether a number is already registered.
-   The consent text lives in its own file and is versioned. Changing it
    requires a new version so earlier consents stay traceable.
-   Staff may correct a name or number and may record a withdrawal
    (`opted_out_at`). Staff cannot create patients.
-   Rate-limit registrations to a few per hour per IP. No captcha and no
    extra fields.
-   Consent is only for administrative reminders and notices. Do not use
    the checkbox to bundle clinical communication or marketing.

Do not add detailed medical histories, diagnoses, clinical notes,
prescriptions, treatment recommendations, insurance, billing, or payment
information.

Validate all incoming data on the server with Valibot. Client-side
validation may improve usability but is never a substitute for
server-side validation.

### 3. Google Calendar integration

Google Calendar is the scheduling source of truth.

The MVP should:

-   Connect to the designated Google Calendar with a Google service
    account. The calendar is shared read-only with the service account;
    no user OAuth consent flow and no refresh token are stored.
-   Read and synchronize relevant calendar events.
-   Store the Google Calendar event ID for each locally associated
    appointment.
-   Associate calendar events with patients where possible.
-   Display appointment date, time, and relevant status in the
    application.
-   Reflect changes to event time, cancellation, or deletion when
    synchronization runs.
-   Avoid creating duplicate local appointments when an event is
    synchronized more than once.
-   Handle expired credentials, permission errors, API failures, and
    temporarily unavailable services gracefully.

Event identity rules:

-   Uniqueness is enforced on the pair
    `(google_calendar_id, google_event_id)`, not on the event ID alone.
-   Recurring events keep `recurring_event_id` on every instance, while
    each instance has its own `google_event_id`.
-   A cancelled instance is stored with calendar status `cancelled`; it is
    not deleted, so the assistant can still see that it disappeared.
-   All-day events have a date instead of a date/time. Store the local
    date and mark the event as all-day.
-   Store the current sync token so an incremental sync can resume without
    re-reading the whole calendar.

For the MVP, the assistant should continue creating, rescheduling, and
cancelling appointments in Google Calendar. Do not build a full calendar
editor or two-way appointment creation workflow unless explicitly
requested.

Synchronization is a read-only pull from Google Calendar into the local
database. It runs only on explicit triggers:

-   A **Sync now** action on the dashboard.
-   An incremental sync when an authenticated user opens the app, at most
    once every few minutes.

There is no cron job, scheduler, or background worker. If a sync fails,
show the error and the last successful sync time; never display stale
events as if they were current.

Sync window and tokens:

-   A full sync covers 30 days in the past and 90 days ahead.
-   An incremental sync sends only the stored `syncToken`, with
    `showDeleted=true` and `singleEvents=true`, and filters to the window
    locally.
-   On `410 GONE`, discard the token and repeat a full sync.
-   Changing the request parameters also requires a full sync.
-   Events outside the window are ignored rather than stored.

Do not assume every calendar event can be matched to a patient
automatically. Provide a clear workflow for the assistant to associate
or resolve unmatched events.

Matching rule:

-   The patient is identified by phone number. Sync looks for a phone
    number in the event description (for example
    `Paciente: +54 9 11 5555-5555`), normalizes it to E.164, and matches
    the patient with the same number.
-   If the phone number is missing, malformed, or belongs to no patient,
    the event stays unmatched and appears in the assistant's resolve list.
-   Never create a patient automatically from a calendar event.
-   Unmatched events can only be linked to an existing registered patient.
    Staff cannot create a patient from an event.
-   When the event's phone belongs to no registered patient, the resolve
    list offers **Enviar invitación a registrarse**: a `wa.me` link with
    the registration URL and the Spanish invitation template.

Google Calendar access:

-   Use a service account in a Google Cloud project with the Calendar API
    enabled.
-   Share the practice calendar with the service account's email using the
    read-only **See all event details** permission.
-   Request only the `calendar.readonly` scope.
-   Provide the key through the environment as
    `GOOGLE_SERVICE_ACCOUNT_JSON` (base64-encoded JSON), never in git.
-   If the key is revoked or the calendar is unshared, fail with a clear
    error and show the last successful sync time.

### 4. Manual WhatsApp reminders

The assistant manually initiates each reminder. The application prepares
the message and hands it to WhatsApp; it never sends anything itself.

The MVP should:

-   Provide a clear **Send WhatsApp reminder** action on every upcoming
    appointment, both from the appointment detail and from the dashboard.
    The assistant decides when to send; nothing waits for a schedule.
-   Render the message from a small set of Spanish templates kept in a
    dedicated template file, separate from the code that renders and
    links them.
-   Let the assistant preview and edit the message before it leaves the
    application.
-   After the preview, the assistant clicks a plain
    `<a href="https://wa.me/<digits>?text=<url-encoded message>">` link, so
    the browser treats it as a user gesture. Never open the link from a
    server action or after an `await`, which popup blockers stop.
-   Copy the rendered message to the clipboard as a convenience; when the
    clipboard is unavailable, show the text in a selectable field.
-   Build the URL with digits only: no `+`, spaces, or separators.
-   Offer the reminder only when the patient has `consent = granted`, a
    usable mobile number, and no opt-out. For `unknown`, offer **Enviar
    invitación a registrarse** instead. For `denied` or an opt-out, offer
    no WhatsApp action at all.
-   Show an inline error and no link when the number is invalid, is not a
    mobile number, or the patient opted out.
-   Ask the assistant to confirm that the message was sent, then store a
    local record of the attempt.
-   Prevent accidental duplicate sends for the same appointment and
    reminder purpose, while allowing an intentional resend with an
    explicit action and a new record.

Because there is no provider integration:

-   Do not store provider message IDs. There are none.
-   Do not display **delivered** or **read** states. The application
    cannot observe them.
-   Store the reminder status as `prepared`, `sent` (confirmed by the
    assistant), or `skipped`, together with the template key and the user
    who recorded it.
-   **Confirmed** (the patient explicitly confirmed attendance) stays an
    appointment state and is never inferred from a reminder.

#### Sending on demand

-   The assistant can prepare and send a reminder for any upcoming
    appointment at any time.
-   The dashboard lists upcoming appointments with their last reminder
    status and a **Send reminder** action for each one.
-   There is no schedule, cycle, or due date. The application never decides
    that a reminder is due.
-   An appointment without a reminder is shown for information, not as a
    failed task.
-   The selected template is chosen by the assistant; the default is the
    `initial` template.

Do not automatically send reminders, schedule future reminders, or
create automated reminder sequences in the MVP.

### 5. Appointment and attendance tracking

-   Display upcoming appointments and their reminder status.
-   Allow the assistant to record a patient's explicit attendance
    confirmation.
-   Track attendance with distinct states: scheduled, confirmed, attended,
    and no-show. Cancellation is not a local attendance state; it comes
    from the calendar status.
-   Keep cancellation and no-show separate: a cancelled appointment did
    not happen, a no-show is a recorded absence.
-   Never mark an appointment as a no-show solely because its scheduled
    time has passed.
-   Require an authorized user to record or confirm a no-show.
-   Do not overwrite Google Calendar scheduling data with locally
    inferred attendance information.

### 6. Treatment follow-up tasks

This is an administrative follow-up feature, not a clinical
treatment-planning system.

-   Allow an authorized user to create a follow-up task for a patient.
-   Store only a short administrative description, due date, status, and
    the responsible user.
-   Display pending and overdue tasks to the assistant.
-   Allow the assistant to record the date of the most recent contact
    attempt and to mark the task complete.
-   Whether a treatment plan or clinical treatment is complete is an
    explicit decision recorded by a staff user. Both accounts can record
    it; the practice decides internally who does.
-   Do not infer clinical completion from a patient's lack of response
    or from a task being closed.
-   Do not generate diagnoses, treatment advice, or clinical
    recommendations.

### 7. Dashboard

Prioritize a simple staff-oriented dashboard showing:

-   Today's and upcoming appointments, each with its last reminder status
    and a **Send reminder** action.
-   Reminder records that were prepared but never confirmed as sent.
-   Appointments awaiting confirmation.
-   Recently missed appointments.
-   Unmatched calendar events that need a patient.
-   Pending and overdue follow-up tasks.

Every panel needs an explicit empty state and one obvious next action, for
example "No appointments today" or "3 events need a patient".

Sort panels soonest first, cap each list at 20 rows, and link to the full
list when there are more.

Do not build an analytics or metrics panel in the MVP. Any number shown on
the dashboard comes from the panels above and must be derived from
recorded data.

### 8. Patient detail

For one patient, show:

-   Contact data: name, WhatsApp number with a **Confirmar número** action,
    and consent state with the date it was recorded.
-   **Enviar recordatorio** when consent allows it, otherwise **Enviar
    invitación a registrarse**.
-   Upcoming appointments with attendance status and last reminder.
-   Past appointments with their outcome, plus a way to record a missing
    one.
-   Reminder history: date, template, and who recorded it.
-   Open and completed follow-up tasks.
-   Archive action, blocked while future appointments exist.

Every action confirms its result and keeps the user on the same screen.

## Architecture and Code Organization

-   Build a modular monolith using SvelteKit.
-   Keep frontend components, server-side business logic, database
    access, and external integrations clearly separated.
-   Use SvelteKit server routes/actions for trusted operations and
    external API calls.
-   Keep Google Calendar calls and WhatsApp message rendering behind small
    service modules rather than embedding them throughout UI components.
-   Keep Valibot schemas independent from Drizzle database schema
    definitions. Reuse validation schemas where appropriate, but do not
    couple UI form models directly to database rows.
-   Keep secrets and provider credentials on the server.
-   Use environment variables for configuration and provide a documented
    `.env.example` containing placeholders only.
-   Do not expose the service-account key, API keys, access tokens, or
    other secrets to client-side code.
-   Avoid premature abstractions, microservices, event buses, and
    generic frameworks.

A possible structure (adapt to the existing repository rather than
reorganizing unnecessarily):

``` text
src/
  lib/
    components/
    schemas/
      patient.schema.ts
      appointment.schema.ts
      follow-up.schema.ts
    server/
      auth/
      db/
        schema.ts
        index.ts
      services/
        patients/
        appointments/
        google-calendar/
        whatsapp/
        follow-ups/
  routes/
    (auth)/
      login/
    (app)/
      dashboard/
      patients/
      appointments/
      follow-ups/
drizzle/
tests/
templates/
  whatsapp/
    reminder.es.md
```

### Environment variables

Document every variable in `.env.example` with placeholders only:

-   `DATABASE_PATH` — absolute path to the SQLite file on durable storage.
-   `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`.
-   `APP_URL`.
-   `GOOGLE_SERVICE_ACCOUNT_JSON` — base64-encoded service-account key.
-   `GOOGLE_CALENDAR_ID` — the practice calendar.
-   `FAKE_CALENDAR` — `1` in development and tests to read fixtures
    instead of Google.

### Seeding and bootstrap

-   `pnpm db:seed` creates the two staff accounts and synthetic patients,
    appointments, and follow-ups.
-   `pnpm db:prune` deletes reminder records and past appointments older
    than 90 days, keeping unresolved past appointments.
-   `pnpm staff:update` changes a staff name, email, or password. Staff
    data is never edited from the UI.
-   Seeding is idempotent and refuses to run when `NODE_ENV=production`.
-   There is no signup route, no invitation flow, and no password reset by
    email.

## MVP Data Model

Keep the schema small. Store only what the workflows above need, and
derive state from stored facts instead of duplicating it.

### users

-   `id`, `name`, `email` (unique), `created_at`.
-   One staff user type only: the dentist and the assistant are equal
    users, with no role column.
-   Two seeded accounts in the MVP; no invitation or signup flow.

### patients

-   `id`, `name`, `phone` (E.164, required, unique), `phone_verified_at`,
    `email` (optional).
-   The phone number is the patient's identity; the internal `id` is only
    the row key used by foreign keys.
-   `name` is a label for messages: not unique, not used for matching.
-   `whatsapp_consent` (`unknown` | `granted` | `denied`),
    `consent_source` (`registration` | `staff`), `consent_text_version`,
    `consent_recorded_at`, `registered_at`, `opted_out_at`.
-   `archived_at` instead of hard deletion. Archiving hides the patient
    from lists and search but keeps their appointments, reminder records,
    and follow-up tasks.
-   Block archiving a patient who still has future appointments, and say
    how many, so nobody loses a pending reminder.
-   A patient is never deleted while it has linked records; anonymize
    inactive patients after the retention period instead.
-   No clinical, billing, insurance, or payment fields.

### appointments

-   `id`, `patient_id` (nullable until matched), `google_calendar_id`,
    `google_event_id`, `recurring_event_id`, `summary`.
-   `all_day`, `local_date` (required for all-day events), `starts_at` and
    `ends_at` in UTC (nullable for all-day events; never fabricate a
    midnight timestamp).
-   `attendance_status` (`scheduled` | `confirmed` | `attended` |
    `no_show`), `calendar_status` (`confirmed` | `cancelled` | `deleted`).
-   `confirmed_at`, `outcome_recorded_by`, `outcome_recorded_at`.
-   Unique index on `(google_calendar_id, google_event_id)`; indexes on
    `starts_at` and `patient_id`.
-   `patient_id` stays null while the event is unmatched.
-   Cancellation is derived from `calendar_status`; there is no local
    cancelled attendance state.
-   Synchronization writes only `calendar_status`, `starts_at`, `ends_at`,
    `all_day`, `local_date`, and `summary`. It never writes
    `attendance_status` or the outcome fields.
-   If an event is cancelled in Google after an outcome was recorded, keep
    both facts: show the outcome and the cancellation side by side and
    never erase the outcome. `attended` wins over `cancelled` for
    attendance reporting.
-   Do not store the event description. Extract the phone number during
    sync and discard it.

### reminder_records

-   `id`, `appointment_id`, `purpose` (`reminder` | `confirmation` |
    `follow_up` | `resend`), `template_key`.
-   `status` (`prepared` | `sent` | `skipped`), `recorded_by`,
    `recorded_at`, `resent_reason`.
-   A row is created when the assistant opens the reminder preview. An
    existing `prepared` row for the same appointment and purpose is reused
    instead of creating another.
-   No database uniqueness rule on sends. Sending again requires an
    explicit confirmation in the UI and a written `resent_reason` on the
    new record.
-   A `prepared` row left unconfirmed for 24 hours is flagged on the
    dashboard and can be marked `sent` or `skipped`.
-   Do not store the message body or any provider identifier.

### follow_ups

-   `id`, `patient_id`, `description`, `due_at`, `status` (`open` |
    `done` | `cancelled`), `assigned_to`.
-   `last_contact_at` is the most recent contact date and is overwritten on
    each attempt. There is no per-attempt log.
-   `completed_by`, `completed_at`.
-   Index on `(status, due_at)`.

### calendar_sync_state

-   `id`, `google_calendar_id` (unique), `sync_token`, `last_synced_at`,
    `last_error`.

## SQLite and Drizzle Requirements

-   Use SQLite for the MVP and Drizzle ORM for queries and migrations.
-   Keep database access on the server.
-   Use foreign keys and appropriate constraints for relational
    integrity.
-   Add indexes for frequently queried fields, such as Google event IDs,
    patient references, appointment dates, and task statuses.
-   Store dates/times consistently. Define and document the timezone
    policy; the practice operates in Argentina, so handle the
    `America/Argentina/Buenos_Aires` timezone explicitly for calendar
    display and appointment interpretation.
-   Use migrations through Drizzle Kit. Do not rely on manually editing
    production database files.
-   Configure SQLite appropriately for the deployment environment,
    including WAL mode where supported and suitable for the selected
    driver.
-   Use transactions for operations that must succeed or fail together.
-   Use unique constraints for external identifiers and idempotency keys
    where applicable.
-   Back up the SQLite database regularly and document how to restore a
    backup.
-   Retain only what the workflows need: reminder records and past
    appointments older than 90 days are removed by `pnpm db:prune`, except
    past appointments with no recorded outcome, which stay until resolved.
-   Never assume the deployment filesystem is persistent. Before
    deployment, verify that the chosen host supports a durable disk/file
    path and that the application reads and writes the database at that
    persistent location.
-   Do not place the production database inside a temporary, ephemeral,
    or publicly served directory.
-   Do not commit database files, credentials, tokens, or production
    data to Git.

SQLite is an intentional MVP choice. Do not introduce PostgreSQL or
database-specific abstractions for a hypothetical future migration.
Avoid unnecessary SQLite-specific coupling in business logic where
reasonably practical.

## External Integration Reliability

### Google Calendar

-   Treat event IDs as external identifiers and enforce uniqueness
    locally.
-   Make synchronization safe to repeat.
-   Handle updates, cancellations, deletions, and events that cannot be
    matched to a patient.
-   Do not assume an API call succeeded if it timed out or returned an
    error.
-   Log useful operational details without logging tokens or unnecessary
    patient information.

### WhatsApp

-   There is no provider call, webhook, or delivery tracking to reconcile.
    The reminder record is a manual log.
-   Opening a `wa.me` link is not sending. Only mark a record as `sent`
    after the assistant confirms it.
-   If the assistant closes the tab without confirming, leave the record as
    `prepared` so the outstanding action stays visible.
-   Keep message templates in `templates/whatsapp/reminder.es.md`, separate
    from the code that renders and links them.
-   Respect consent and opt-out status before offering the action.
-   Never log the generated `wa.me` URL: it contains the patient's phone
    number and message text.

Do not introduce automatic scheduling or background-job infrastructure
for these integrations in the MVP. Use explicit user actions and
ordinary server requests.

## Security and Privacy

Patient contact information and appointment details must be treated as
sensitive.

-   Require authentication for application access.
-   Enforce authorization on the server, not only by hiding UI controls.
-   Rate-limit login attempts and rely on Better Auth's session handling;
    do not build custom token or session logic.
-   Use HTTPS in production.
-   Keep secrets in environment variables or the hosting provider's
    secret manager.
-   Validate and normalize input on the server.
-   Use parameterized queries through Drizzle.
-   Apply least-privilege access to the Google Calendar credentials.
-   Collect and retain only information required for the stated
    workflows.
-   Record and respect WhatsApp consent and opt-out requests.
-   Avoid logging message bodies, access tokens, patient phone numbers,
    or unnecessary personal data.
-   Use synthetic patient data in development, demos, and automated
    tests.
-   Do not use real patient data in screenshots, test fixtures, or
    public repositories.
-   Protect the service-account key: it is the only credential with
    calendar access. Rotate it if it is exposed.
-   Document backup access and retention practices.
-   Review applicable Argentine personal-data and
    healthcare-confidentiality requirements before production use.

## Testing and Quality

Use Playwright for the most important end-to-end workflows. Add Vitest
unit tests where they provide useful coverage without unnecessary test
infrastructure.

Prioritize tests for:

1.  Authentication and access control for unauthenticated requests.
2.  Patient creation, editing, and validation.
3.  Google Calendar event synchronization and duplicate-event
    prevention.
4.  Calendar event updates and cancellations.
5.  Matching calendar events to patients by phone number, including
    invalid and unknown numbers.
6.  WhatsApp consent and opt-out enforcement, and phone normalization.
7.  Reminder rendering from the Spanish template and correct `wa.me` link
    construction.
8.  Duplicate-send prevention and intentional resend behavior.
9.  Keeping `prepared`, `sent`, and `confirmed` distinct.
10. Sending a reminder on demand from the dashboard, including an
    invalid phone number, missing consent, and a blocked popup.
11. Attendance, cancellation, and no-show state transitions.
12. Follow-up task creation, overdue display, and completion.
13. Database migrations and important constraints.

Use mocked Google Calendar responses and never open a real `wa.me` link
in automated tests. Do not send real messages or use real patient data in
tests.

Tests should verify user-visible behavior and important business rules,
not implementation details that can change without affecting behavior.

## User Experience and Accessibility

-   Optimize the interface for the assistant's daily workflow.
-   Write the interface in Spanish (es-AR). Format dates and times with
    `Intl` for `America/Argentina/Buenos_Aires`, and keep user-facing copy
    in one module instead of scattering strings through components.
-   Make the next required action obvious.
-   Use clear labels and status descriptions rather than ambiguous icons
    alone.
-   Clearly distinguish prepared, sent, confirmed, cancelled, attended,
    no-show, and overdue states.
-   Ask for confirmation before destructive actions or intentional
    duplicate resends.
-   Provide understandable error messages and recovery guidance.
-   Ensure forms are keyboard accessible and have associated labels.
-   Provide loading, empty, success, and failure states.
-   Keep the interface responsive, but prioritize a practical desktop
    workflow for the assistant.

## Out of Scope

Do not implement these features unless the user explicitly changes the
product scope:

-   Billing, invoices, payments, or accounting.
-   Insurance management.
-   Electronic health records or detailed clinical histories.
-   Diagnoses, prescriptions, clinical decision support, or treatment
    recommendations.
-   A replacement for Google Calendar.
-   Automatic WhatsApp reminders or automated message sequences.
-   WhatsApp Business Platform integration, provider-managed templates,
    and delivery or read receipts.
-   Cron jobs, scheduled jobs, or background workers of any kind.
-   Automatic no-show classification.
-   Patient self-service portal or patient mobile app; the single
    registration page is the only patient-facing surface.
-   Multi-clinic or multi-tenant architecture.
-   Multiple-dentist scheduling and complex resource allocation.
-   AI chatbot or autonomous patient communication.
-   Microservices, Docker, Kubernetes, Redis, or dedicated background
    workers.
-   GitHub Actions or CI/CD pipelines.

## Development Workflow for Coding Agents

Before changing code:

1.  Inspect the existing repository, package scripts, dependencies, and
    established conventions.
2.  Read this file and any relevant project documentation.
3.  Identify the smallest change that satisfies the requested task.
4.  Check whether a suitable component, schema, service, or utility
    already exists.
5.  Do not replace established libraries or restructure the project
    without a clear reason.

While implementing:

-   Use TypeScript types; avoid `any` unless there is a documented
    reason.
-   Keep components focused and business logic out of presentation
    components.
-   Validate all untrusted input on the server with Valibot.
-   Keep secrets and external API calls server-side.
-   Handle loading, empty, success, and error states.
-   Avoid adding dependencies for functionality that can be implemented
    simply with the existing stack.
-   Do not add features beyond the requested scope.
-   Do not fabricate API responses, reminder send confirmations, or
    calendar synchronization results.

Before completing a task:

-   Run the relevant lint, type-check, and test commands that are
    available in the repository.
-   Run relevant Playwright tests when changing user workflows.
-   Report any checks that could not be run and why.
-   Summarize the changes and mention any required environment
    variables, migrations, or manual setup.
-   Never claim a test, integration, migration, or deployment succeeded
    unless it was actually verified.

## MVP Success Measures

The application should help the practice evaluate:

-   No-show rate compared with the previous baseline (approximately 30%,
    subject to verification).
-   Percentage of appointments with an explicit attendance confirmation.
-   WhatsApp reminders prepared versus confirmed as sent, and the number
    of intentional resends.
-   Number of pending or overdue treatment follow-up tasks.
-   Assistant time spent manually managing reminders and follow-ups.

Treat improvement targets as hypotheses to measure, not guaranteed
outcomes.
