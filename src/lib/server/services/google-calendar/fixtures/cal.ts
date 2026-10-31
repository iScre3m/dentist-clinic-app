/**
 * Fake calendar fixtures for FAKE_CALENDAR=1 development and unit tests.
 *
 * Each fixture represents a Google Calendar event as the API would return it.
 * The sync service (fullSync / incrementalSync) processes these the same way
 * it would a real API response, so we can verify matching, upserts, and
 * unmatched-event handling without credentials.
 *
 * To use: set FAKE_CALENDAR=1 in .env and the sync service will read from
 * these fixtures instead of calling the Google Calendar API.
 *
 * Format: one fixture per line as JSON. The sync service reads them in order.
 */

export const FIXTURES: Array<unknown> = [
	/**
	 * Evento con paciente ya registrado (Lucía Fernández, +54 9 11 5555-0001).
	 * Debe emparejarse automáticamente y crear/actualizar el turno.
	 */
	{
		id: 'dev-event-1',
		summary: 'Turno — Lucía Fernández',
		description: 'Paciente: +54 9 11 5555-0001',
		start: {
			dateTime: '2026-11-02T10:00:00-03:00',
		},
		end: {
			dateTime: '2026-11-02T10:45:00-03:00',
		},
		recurringEventId: 'dev-recur-1',
	},

	/**
	 * Evento con paciente Mateo Ramírez (número mexicano +52 55 12345678),
	 * sin descripción de paciente → debe aparecer como sin paciente.
	 */
	{
		id: 'dev-event-2',
		summary: 'Turno — Mateo Ramírez',
		description: '',
		start: {
			dateTime: '2026-11-03T14:30:00-03:00',
		},
		end: {
			dateTime: '2026-11-03T15:15:00-03:00',
		},
		recurringEventId: 'dev-recur-2',
	},

	/**
	 * Evento sin descripción de paciente → sin paciente, aparece en la lista
	 * "Eventos sin paciente".
	 */
	{
		id: 'dev-event-3',
		summary: 'Turno',
		description: '',
		start: {
			date: '2026-11-05',
		},
		end: {
			date: '2026-11-05',
		},
		allDay: true,
		recurringEventId: 'dev-recur-3',
	},

	/**
	 * Evento cancelado en Google → debe almacenarse con calendar_status cancelled.
	 */
	{
		id: 'dev-event-4',
		summary: 'Turno — Paciente eliminado',
		description: 'Paciente: +54 9 11 5555-0002',
		start: {
			dateTime: '2026-11-07T09:00:00-03:00',
		},
		end: {
			dateTime: '2026-11-07T09:45:00-03:00',
		},
		status: 'cancelled',
		recurringEventId: 'dev-recur-4',
	},

	/**
	 * Evento con teléfono inválido/fixto → no se empareja, aparece como sin paciente.
	 */
	{
		id: 'dev-event-5',
		summary: 'Turno — Fijo',
		description: 'Paciente: 011 5555-0001', // fijo, no celular
		start: {
			dateTime: '2026-11-08T11:00:00-03:00',
		},
		end: {
			dateTime: '2026-11-08T11:45:00-03:00',
		},
		recurringEventId: 'dev-recur-5',
	},

	/**
	 * Evento nuevo sin paciente (aparecerá en la lista de eventos sin paciente).
	 */
	{
		id: 'dev-event-6',
		summary: 'Nuevo turno sin paciente',
		description: '',
		start: {
			dateTime: '2026-11-10T15:00:00-03:00',
		},
		end: {
			dateTime: '2026-11-10T15:45:00-03:00',
		},
	},
];