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

export function formatDateTime(value: Date | null, allDay = false): string {
	if (!value) return 'Sin horario';
	return allDay ? dateFormatter.format(value) : dateTimeFormatter.format(value);
}
