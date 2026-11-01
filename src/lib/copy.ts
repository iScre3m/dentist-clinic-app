/**
 * All user-facing copy lives here, in es-AR. Components and server actions
 * import strings from this module instead of hardcoding them, so wording can
 * be reviewed and changed in one place.
 *
 * State labels are shared maps keyed by the stored enum value; a missing key
 * should never happen, but rendering the raw value beats crashing.
 */

export const attendanceLabels: Record<string, string> = {
	scheduled: 'Número sin confirmar',
	confirmed: 'Confirmado',
	attended: 'Asistió',
	no_show: 'No vino'
};

/** Badge colours per attendance state; `attended` keeps the default badge. */
export const attendanceBadgeClasses: Record<string, string> = {
	scheduled: 'border-amber-200 bg-amber-50 text-amber-800',
	confirmed: 'border-emerald-200 bg-emerald-50 text-emerald-800',
	attended: '',
	no_show: 'border-red-200 bg-red-50 text-red-800'
};

export const calendarStatusLabels: Record<string, string> = {
	confirmed: 'En el calendario',
	cancelled: 'Cancelado en el calendario',
	deleted: 'Borrado del calendario'
};

export const reminderStatusLabels: Record<string, string> = {
	prepared: 'Preparado',
	sent: 'Enviado',
	skipped: 'Omitido'
};

export const consentLabels: Record<string, string> = {
	granted: 'Consentimiento otorgado',
	denied: 'Baja de WhatsApp'
};

/** Unverified is informational, never a block, so it shares the soft amber. */
export const unverifiedBadgeClass = 'border-amber-200 bg-amber-50 text-amber-800';

export const consentBadgeClasses: Record<string, string> = {
	granted: 'border-emerald-200 bg-emerald-50 text-emerald-800',
	denied: 'border-red-200 bg-red-50 text-red-800'
};

export const consentSourceLabels: Record<string, string> = {
	registration: 'Registración del paciente',
	staff: 'Registro del personal'
};

export const followUpsCopy = {
	page: {
		title: 'Seguimientos',
		subtitle: 'Tareas administrativas de tratamiento pendientes.'
	},
	summary: {
		pending: (n: number) => `${n} seguimiento${n === 1 ? '' : 's'} pendiente${n === 1 ? '' : 's'}.`,
		overdue: (n: number) => `${n} vencido${n === 1 ? '' : 's'}`
	},
	list: {
		emptyTitle: 'No hay seguimientos pendientes.',
		emptyHint: 'Creá un seguimiento desde el detalle de un paciente.',
		dueLabel: 'Vence',
		lastContactLabel: 'Último contacto',
		contactDateLabel: 'Fecha de contacto',
		contactDatePlaceholder: 'aaaa-mm-dd',
		complete: 'Completar',
		cancel: 'Cancel',
		recordContact: 'Registrar contacto'
	},
	create: {
		title: 'Nuevo seguimiento',
		descriptionLabel: 'Descripción',
		descriptionPlaceholder: 'Ej: Coordinar la segunda sesión del tratamiento.',
		dueDateLabel: 'Fecha de vencimiento',
		patientLabel: 'Paciente',
		patientPlaceholder: 'Elegí un paciente',
		submit: 'CreAR seguimiento'
	},
	messages: {
		created: 'Seguimiento creado.',
		contactRecorded: 'Contacto registrado.',
		completed: 'Seguimiento completado.',
		cancelled: 'Seguimiento cancelado.',
		invalidForm: 'Revisá los datos cargados.',
		notFound: 'No encontramos ese seguimiento.',
		cannotComplete: 'No se puede completar ese seguimiento.',
		cancelledState: 'No se puede registrar contacto en un seguimiento cancelado.'
	}
};

/** Why a WhatsApp number was rejected, shared by every phone form. */
export function phoneFailureMessage(reason: string): string {
	switch (reason) {
		case 'not-mobile':
			return 'Necesitamos un número de celular, porque WhatsApp no funciona con líneas fijas.';
		default:
			return 'El número no parece válido. Solo aceptamos celulares argentinos; revisá el código de área y el número.';
	}
}

export const patientsCopy = {
	page: {
		title: 'Pacientes',
		subtitle: 'Pacientes registrados en el consultorio.'
	},
	search: {
		label: 'Buscar pacientes',
		placeholder: 'Nombre o número de WhatsApp',
		button: 'Buscar',
		clear: 'Limpiar búsqueda',
		showArchived: 'Ver archivados',
		hideArchived: 'Ocultar archivados'
	},
	list: {
		emptyTitle: 'Todavía no hay pacientes registrados.',
		emptyHint:
			'Compartí la página de registro con el paciente para que cargue su nombre y su número de WhatsApp.',
		registrationLink: 'Página de registro',
		emptySearch: (query: string) => `No encontramos pacientes que coincidan con «${query}».`,
		shownOfTotal: (shown: number, total: number) => `Mostrando ${shown} de ${total}.`,
		narrowHint: 'Usá la búsqueda por nombre o número para acotar la lista.',
		registeredLabel: 'Alta'
	},
	badges: {
		unverified: 'Número sin confirmar',
		verified: 'Número confirmado',
		archived: 'Archivado'
	},
	detail: {
		back: 'Pacientes',
		contactTitle: 'Contacto',
		phoneLabel: 'WhatsApp',
		emailLabel: 'Correo',
		emailEmpty: 'Sin correo registrado',
		registeredLabel: 'Alta',
		verifiedAtLabel: 'Número confirmado el',
		confirmPhone: 'Confirmar número',
		confirmPhoneHint: 'Confirmá el número cuando el paciente lo verifique en consulta o por WhatsApp.',
		editTitle: 'Editar datos',
		editNameLabel: 'Nombre y apellido',
		editPhoneLabel: 'Número de WhatsApp',
		editPhoneHint: 'Se guarda normalizado al formato internacional, por ejemplo +54 9 11 5555-0001.',
		editEmailLabel: 'Correo (opcional)',
		editEmailHint: 'Dejalo vacío si el paciente no dio un correo.',
		editSave: 'Guardar cambios',
		consentTitle: 'Consentimiento de WhatsApp',
		consentRecordedLabel: 'Registrado el',
		consentVersionLabel: 'Versión del texto',
		optOutLabel: 'Baja registrada el',
		grantConsent: 'Otorgar consentimiento',
		denyConsent: 'Registrar baja',
		denyConsentConfirm:
			'¿Registrar la baja de WhatsApp? No se le van a mandar más recordatorios por este medio.',
		archiveTitle: 'Archivar paciente',
		archiveText:
			'El paciente deja de aparecer en la lista y en la búsqueda. Sus turnos, recordatorios y seguimientos se conservan.',
		archiveButton: 'Archivar paciente',
		archiveConfirm: '¿Archivar este paciente? Podés revertirlo corrigiendo el registro.',
		archivedNotice: 'Este paciente está archivado.',
		upcomingTitle: 'Próximos turnos',
		upcomingEmpty: 'No hay turnos próximos.',
		pastTitle: 'Turnos anteriores',
		pastEmpty: 'No hay turnos anteriores registrados.',
		remindersTitle: 'Recordatorios',
		remindersEmpty: 'Todavía no hay recordatorios registrados.',
		reminderTemplateLabel: 'Plantilla',
		lastReminderLabel: 'Último recordatorio',
		followUpsTitle: 'Seguimientos',
		followUpsOpenEmpty: 'No hay seguimientos pendientes.',
		followUpsDoneEmpty: 'No hay seguimientos completados.',
		dueLabel: 'Vence',
		completedLabel: 'Completado',
		lastContactLabel: 'Último contacto'
	},
	messages: {
		notFound: 'No encontramos ese paciente.',
		updated: 'Datos actualizados.',
		updatedNewPhone: 'Datos actualizados. El número nuevo queda sin confirmar hasta la próxima consulta.',
		phoneTaken: 'Otro paciente ya usa ese número. Corregí el número o buscá al paciente existente.',
		verified: 'Número confirmado.',
		alreadyVerified: 'El número ya estaba confirmado.',
		consentGranted: 'Consentimiento otorgado.',
		consentDenied: 'Baja registrada. No se le van a mandar más recordatorios.',
		archived: 'Paciente archivado.',
		archiveBlocked: (count: number) =>
			count === 1
				? 'No se puede archivar: el paciente tiene 1 turno futuro pendiente.'
				: `No se puede archivar: el paciente tiene ${count} turnos futuros pendientes.`,
		invalidForm: 'Revisá los datos cargados.'
	}
};

export const reminderCopy = {
	button: {
		send: 'Enviar recordatorio',
		resend: 'Reenviar recordatorio',
		invite: 'Enviar invitación a registrarse',
		copy: 'Copiar mensaje',
		sent: 'Marcar como enviado',
		skipped: 'Marcar como omitido'
	},
	label: {
		template: 'Plantilla',
		message: 'Mensaje',
		lastReminder: 'Último recordatorio',
		resendReason: 'Motivo del reenvío'
	},
	message: {
		sent: 'Recordatorio enviado.',
		skipped: 'Recordatorio omitido.',
		resendRequired: 'Escribí un motivo para reenviar el recordatorio.',
		alreadySent: 'Ya se envió un recordatorio para este turno.',
		notEligible: 'No se puede enviar recordatorio: falta consentimiento o número válido.',
		noPhone: 'El paciente no tiene un número de WhatsApp válido.',
		consentMissing: 'El paciente no dio consentimiento para recibir recordatorios por WhatsApp.',
		consentDenied: 'El paciente pidió no recibir mensajes de WhatsApp.'
	},
	error: {
		notFound: 'No encontramos ese turno.',
		notFuture: 'Solo se pueden enviar recordatorios para turnos futuros.',
		cancelled: 'Este turno fue cancelado o borrado del calendario.'
	}
};
