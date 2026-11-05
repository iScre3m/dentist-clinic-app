import { redirect } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = ({ locals }) => {
	if (!locals.session) {
		throw redirect(303, '/login');
	}
	return { user: locals.session.user };
};
