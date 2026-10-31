import { error } from '@sveltejs/kit';

/**
 * Every staff route and action re-checks the session on the server. Hiding a
 * button in the UI is not authorization.
 */
export function requireUser(locals: App.Locals) {
	if (!locals.session) {
		error(401, 'Iniciá sesión para continuar.');
	}
	return locals.session.user;
}
