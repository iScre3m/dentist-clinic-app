const dateTimeFormatter = new Intl.DateTimeFormat('es-AR', {
	timeZone: 'America/Argentina/Buenos_Aires',
	weekday: 'short',
	day: 'numeric',
	month: 'short',
	hour: '2-digit',
	minute: '2-digit'
});

const dateFormatter = new Intl.DateTimeFormat('es-AR', {
	timeZone: 'America/Argentina/Buenos_Aires',
	weekday: 'short',
	day: 'numeric',
	month: 'short'
});

const dateOnlyFormatter = new Intl.DateTimeFormat('es-AR', {
	timeZone: 'America/Argentina/Buenos_Aires',
	day: 'numeric',
	month: 'short',
	year: 'numeric'
});

/** en-CA formats as YYYY-MM-DD, which is how SQLite stores `local_date`. */
const localDateFormatter = new Intl.DateTimeFormat('en-CA', {
	timeZone: 'America/Argentina/Buenos_Aires',
	year: 'numeric',
	month: '2-digit',
	day: '2-digit'
});

export function formatDateTime(value: Date | null, allDay = false): string {
	if (!value) return 'Sin horario';
	return allDay ? dateFormatter.format(value) : dateTimeFormatter.format(value);
}

export function formatDate(value: Date | null): string {
	return value ? dateOnlyFormatter.format(value) : '—';
}

/**
 * Calendar date in the practice timezone. Argentina is UTC-3 all year, so a
 * timestamp near midnight belongs to the previous or next day compared with
 * UTC; appointment windows and "today" checks must use the local date.
 */
export function localDateKey(date: Date = new Date()): string {
	return localDateFormatter.format(date);
}
