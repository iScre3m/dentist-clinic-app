export const TEMPLATES = {
	initial: 'Hola {{nombre}}, te escribimos de {{consultorio}} para recordarte tu turno del {{fecha}} a las {{hora}}. ¿Podés confirmarnos si vas a poder asistir?',
	upcoming_48h: 'Hola {{nombre}}, te recordamos tu turno del {{fecha}} a las {{hora}} en {{consultorio}}. Respondé "Sí" para confirmar o "NO" si necesitás reprogramarlo.',
	confirmation_request: 'Hola {{nombre}}, todavía no nos confirmaste el turno del {{fecha}} a las {{hora}}. ¿Vas a poder venir? Si no te queda cómodo, buscamos otro horario.',
	confirmation_ack: '¡Gracias, {{nombre}}! Te esperamos el {{fecha}} a las {{hora}} en {{consultorio}}. Si necesitás cambiar el turno, avisanos por acá.',
	reschedule_patient: 'Hola {{nombre}}, necesitamos reprogramar tu turno del {{fecha}} a las {{hora}}. ¿Qué día y horario te quedan cómodos? Buscamos un lugar lo antes posible.',
	reschedule_office: 'Hola {{nombre}}, tuvimos que cambiar tu turno. Te ofrecemos el {{fecha_nueva}} a las {{hora_nueva}} en {{consultorio}}. ¿Te sirve?',
	follow_up: 'Hola {{nombre}}, te escribimos de {{consultorio}} para coordinar la próxima sesión de tu tratamiento. ¿Querés que busquemos un turno esta semana o la próxima?',
	manual: 'Hola {{nombre}}, te escribimos de {{consultorio}} por tu turno del {{fecha}} a las {{hora}}. Contanos si necesitás algo o si querés que lo cambiemos.',
	registration_invite: 'Hola {{nombre}}, te escribimos de {{consultorio}}. Para enviarte recordatorios por WhatsApp, completá tus datos una sola vez en este enlace: {{link_registro}}',
	opt_out_ack: 'Listo, {{nombre}}. No te vamos a enviar más recordatorios por WhatsApp. Si necesitás un turno, escribinos cuando quieras.'
} as const;

export type TemplateKey = keyof typeof TEMPLATES;

export function renderTemplate(key: TemplateKey, vars: Record<string, string>): string {
	let text: string = TEMPLATES[key] ?? '';
	for (const [k, v] of Object.entries(vars)) {
		text = text.replaceAll('{{' + k + '}}', v);
	}
	return text;
}

export function buildWaMeLink(phone: string, message: string): string {
	const digits = phone.replace(/\D/g, '');
	const text = encodeURIComponent(message);
	return 'https://wa.me/' + digits + '?text=' + text;
}

export function buildRegistrationInviteLink(phone: string, baseUrl: string): string {
	const msg = renderTemplate('registration_invite', {
		nombre: '',
		consultorio: 'Consultorio Dra. Laura',
		link_registro: baseUrl + '/'
	});
	return buildWaMeLink(phone, msg);
}
