import { sql } from 'drizzle-orm';
import {
	type AnySQLiteColumn,
	index,
	integer,
	sqliteTable,
	text,
	uniqueIndex
} from 'drizzle-orm/sqlite-core';

const nowMs = sql`(unixepoch() * 1000)`;

/**
 * Better Auth tables. The staff account lives in `user`; there are no roles.
 * Names and fields must match what the drizzle adapter expects.
 */
export const user = sqliteTable('user', {
	id: text('id').primaryKey(),
	name: text('name').notNull(),
	email: text('email').notNull().unique(),
	emailVerified: integer('email_verified', { mode: 'boolean' }).notNull().default(false),
	image: text('image'),
	createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull().default(nowMs),
	updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull().default(nowMs)
});

export const session = sqliteTable('session', {
	id: text('id').primaryKey(),
	expiresAt: integer('expires_at', { mode: 'timestamp_ms' }).notNull(),
	token: text('token').notNull().unique(),
	createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull().default(nowMs),
	updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull().default(nowMs),
	ipAddress: text('ip_address'),
	userAgent: text('user_agent'),
	userId: text('user_id')
		.notNull()
		.references(() => user.id, { onDelete: 'cascade' })
});

export const account = sqliteTable('account', {
	id: text('id').primaryKey(),
	accountId: text('account_id').notNull(),
	providerId: text('provider_id').notNull(),
	userId: text('user_id')
		.notNull()
		.references(() => user.id, { onDelete: 'cascade' }),
	accessToken: text('access_token'),
	refreshToken: text('refresh_token'),
	idToken: text('id_token'),
	accessTokenExpiresAt: integer('access_token_expires_at', { mode: 'timestamp_ms' }),
	refreshTokenExpiresAt: integer('refresh_token_expires_at', { mode: 'timestamp_ms' }),
	scope: text('scope'),
	password: text('password'),
	createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull().default(nowMs),
	updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull().default(nowMs)
});

export const verification = sqliteTable('verification', {
	id: text('id').primaryKey(),
	identifier: text('identifier').notNull(),
	value: text('value').notNull(),
	expiresAt: integer('expires_at', { mode: 'timestamp_ms' }).notNull(),
	createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull().default(nowMs),
	updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull().default(nowMs)
});

/** Patients are identified by phone number. Staff never create them. */
export const patients = sqliteTable(
	'patients',
	{
		id: text('id').primaryKey(),
		name: text('name').notNull(),
		phone: text('phone').notNull(),
		phoneVerifiedAt: integer('phone_verified_at', { mode: 'timestamp_ms' }),
		email: text('email'),
		whatsappConsent: text('whatsapp_consent', {
			enum: ['granted', 'denied']
		})
			.notNull()
			.default('denied'),
		consentSource: text('consent_source', { enum: ['registration', 'staff'] }),
		consentTextVersion: integer('consent_text_version'),
		consentRecordedAt: integer('consent_recorded_at', { mode: 'timestamp_ms' }),
		registeredAt: integer('registered_at', { mode: 'timestamp_ms' }).notNull().default(nowMs),
		optedOutAt: integer('opted_out_at', { mode: 'timestamp_ms' }),
		archivedAt: integer('archived_at', { mode: 'timestamp_ms' }),
		createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull().default(nowMs),
		updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull().default(nowMs)
	},
	(t) => [
		uniqueIndex('patients_phone_unique').on(t.phone),
		index('patients_archived_idx').on(t.archivedAt)
	]
);

/** Local mirror of Google Calendar events. Sync never writes attendance. */
export const appointments = sqliteTable(
	'appointments',
	{
		id: text('id').primaryKey(),
		patientId: text('patient_id').references(() => patients.id, { onDelete: 'set null' }),
		googleCalendarId: text('google_calendar_id').notNull(),
		googleEventId: text('google_event_id').notNull(),
		recurringEventId: text('recurring_event_id'),
		summary: text('summary'),
		allDay: integer('all_day', { mode: 'boolean' }).notNull().default(false),
		localDate: text('local_date'),
		startsAt: integer('starts_at', { mode: 'timestamp_ms' }),
		endsAt: integer('ends_at', { mode: 'timestamp_ms' }),
		attendanceStatus: text('attendance_status', {
			enum: ['scheduled', 'confirmed', 'attended', 'no_show']
		})
			.notNull()
			.default('scheduled'),
		calendarStatus: text('calendar_status', {
			enum: ['confirmed', 'cancelled', 'deleted']
		})
			.notNull()
			.default('confirmed'),
		confirmedAt: integer('confirmed_at', { mode: 'timestamp_ms' }),
		outcomeRecordedBy: text('outcome_recorded_by').references(() => user.id),
		outcomeRecordedAt: integer('outcome_recorded_at', { mode: 'timestamp_ms' }),
		createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull().default(nowMs),
		updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull().default(nowMs)
	},
	(t) => [
		uniqueIndex('appointments_calendar_event_unique').on(t.googleCalendarId, t.googleEventId),
		index('appointments_starts_at_idx').on(t.startsAt),
		index('appointments_patient_idx').on(t.patientId),
		index('appointments_calendar_status_idx').on(t.calendarStatus)
	]
);

/** Manual WhatsApp send log. No provider IDs, no message bodies. */
export const reminderRecords = sqliteTable(
	'reminder_records',
	{
		id: text('id').primaryKey(),
		appointmentId: text('appointment_id')
			.notNull()
			.references(() => appointments.id, { onDelete: 'cascade' }),
		purpose: text('purpose', {
			enum: ['reminder', 'confirmation', 'follow_up', 'resend', 'invoice']
		})
			.notNull()
			.default('reminder'),
		templateKey: text('template_key').notNull(),
		status: text('status', { enum: ['prepared', 'sent', 'skipped'] })
			.notNull()
			.default('prepared'),
		recordedBy: text('recorded_by')
			.notNull()
			.references(() => user.id),
		recordedAt: integer('recorded_at', { mode: 'timestamp_ms' }).notNull().default(nowMs),
		resentReason: text('resent_reason'),
		createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull().default(nowMs),
		updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull().default(nowMs)
	},
	(t) => [
		index('reminder_records_appointment_idx').on(t.appointmentId),
		index('reminder_records_status_idx').on(t.status)
	]
);

/** Administrative follow-up, never clinical. */
export const followUps = sqliteTable(
	'follow_ups',
	{
		id: text('id').primaryKey(),
		patientId: text('patient_id')
			.notNull()
			.references(() => patients.id),
		description: text('description').notNull(),
		dueAt: integer('due_at', { mode: 'timestamp_ms' }).notNull(),
		status: text('status', { enum: ['open', 'done', 'cancelled'] })
			.notNull()
			.default('open'),
		assignedTo: text('assigned_to').references(() => user.id),
		lastContactAt: integer('last_contact_at', { mode: 'timestamp_ms' }),
		completedBy: text('completed_by').references(() => user.id),
		completedAt: integer('completed_at', { mode: 'timestamp_ms' }),
		createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull().default(nowMs),
		updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull().default(nowMs)
	},
	(t) => [index('follow_ups_status_due_idx').on(t.status, t.dueAt)]
);

/** Incremental sync state per calendar. */
export const calendarSyncState = sqliteTable('calendar_sync_state', {
	id: text('id').primaryKey(),
	googleCalendarId: text('google_calendar_id').notNull().unique(),
	syncToken: text('sync_token'),
	lastSyncedAt: integer('last_synced_at', { mode: 'timestamp_ms' }),
	lastFullSyncAt: integer('last_full_sync_at', { mode: 'timestamp_ms' }),
	lastError: text('last_error'),
	createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull().default(nowMs),
	updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull().default(nowMs)
});

/** Fixed-price catalog. Permanent: never deleted, only deactivated. */
export const servicePrices = sqliteTable(
	'service_prices',
	{
		id: text('id').primaryKey(),
		serviceType: text('service_type').notNull(),
		name: text('name').notNull(),
		price: integer('price').notNull(),
		isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
		updatedBy: text('updated_by')
			.notNull()
			.references(() => user.id),
		createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull().default(nowMs),
		updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull().default(nowMs)
	},
	(t) => [
		uniqueIndex('service_prices_service_type_unique').on(t.serviceType),
		index('service_prices_is_active_idx').on(t.isActive)
	]
);

/** Services performed on an appointment, recorded by staff. */
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

/** Immutable invoice snapshot with prices at generation time. Pruned older than 90 days. */
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
		patientName: text('patient_name').notNull(),
		patientPhone: text('patient_phone').notNull(),
		appointmentStartsAt: integer('appointment_starts_at', { mode: 'timestamp_ms' }).notNull(),
		services: text('services', { mode: 'json' }).notNull(),
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
		resentOf: text('resent_of').references((): AnySQLiteColumn => invoiceHistory.id),
		createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull().default(nowMs)
	},
	(t) => [
		index('invoice_history_appointment_idx').on(t.appointmentId),
		index('invoice_history_patient_idx').on(t.patientId),
		index('invoice_history_status_idx').on(t.status),
		index('invoice_history_created_at_idx').on(t.createdAt)
	]
);

export type Patient = typeof patients.$inferSelect;
export type NewPatient = typeof patients.$inferInsert;
export type Appointment = typeof appointments.$inferSelect;
export type NewAppointment = typeof appointments.$inferInsert;
export type ReminderRecord = typeof reminderRecords.$inferSelect;
export type FollowUp = typeof followUps.$inferSelect;
export type ServicePrice = typeof servicePrices.$inferSelect;
export type NewServicePrice = typeof servicePrices.$inferInsert;
export type AppointmentService = typeof appointmentServices.$inferSelect;
export type NewAppointmentService = typeof appointmentServices.$inferInsert;
export type InvoiceHistory = typeof invoiceHistory.$inferSelect;
export type NewInvoiceHistory = typeof invoiceHistory.$inferInsert;
