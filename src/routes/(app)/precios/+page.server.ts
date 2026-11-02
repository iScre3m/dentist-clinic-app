import { fail } from '@sveltejs/kit';
import * as v from 'valibot';
import { requireUser } from '#lib/server/session.ts';
import {
	createServicePrice,
	listServicePrices,
	setActive,
	updatePrice
} from '#lib/server/services/pricing/index.ts';
import {
	createServicePriceSchema,
	setServicePriceActiveSchema,
	updateServicePriceSchema
} from '#lib/schemas/service-price.schema.ts';
import { preciosCopy as copy } from '#lib/copy.ts';
import type { Actions, PageServerLoad } from './$types';

function parsePrice(raw: string): number | null {
	const clean = raw.replace(/\./g, '');
	if (!/^\d+$/.test(clean)) return null;
	const value = Number(clean);
	return Number.isSafeInteger(value) ? value : null;
}

export const load: PageServerLoad = async ({ locals }) => {
	requireUser(locals);
	return { prices: await listServicePrices() };
};

export const actions: Actions = {
	create: async ({ locals, request }) => {
		const user = requireUser(locals);
		const form = await request.formData();

		const price = parsePrice(form.get('price')?.toString() ?? '');
		const parsed = v.safeParse(createServicePriceSchema, {
			serviceType: form.get('serviceType')?.toString() ?? '',
			name: form.get('name')?.toString() ?? '',
			price: price ?? NaN
		});

		if (!parsed.success) {
			return fail(400, {
				action: 'create',
				success: false,
				error: parsed.issues[0]?.message ?? copy.messages.invalid
			});
		}

		const result = await createServicePrice(parsed.output, user.id);
		if (!result.ok) {
			return fail(400, {
				action: 'create',
				success: false,
				error: result.reason === 'duplicate-type' ? copy.messages.duplicate : copy.messages.invalid
			});
		}
		return { action: 'create', success: true };
	},

	update: async ({ locals, request }) => {
		const user = requireUser(locals);
		const form = await request.formData();

		const price = parsePrice(form.get('price')?.toString() ?? '');
		const parsed = v.safeParse(updateServicePriceSchema, {
			servicePriceId: form.get('servicePriceId')?.toString() ?? '',
			price: price ?? NaN
		});

		if (!parsed.success) {
			return fail(400, {
				action: 'update',
				success: false,
				error: parsed.issues[0]?.message ?? copy.messages.invalid
			});
		}

		const result = await updatePrice(parsed.output, user.id);
		if (!result.ok) {
			return fail(400, {
				action: 'update',
				success: false,
				error: result.reason === 'not-found' ? copy.messages.notFound : copy.messages.invalid
			});
		}
		return { action: 'update', success: true };
	},

	setActive: async ({ locals, request }) => {
		const user = requireUser(locals);
		const form = await request.formData();

		const parsed = v.safeParse(setServicePriceActiveSchema, {
			servicePriceId: form.get('servicePriceId')?.toString() ?? '',
			isActive: form.get('isActive')?.toString() === '1'
		});

		if (!parsed.success) {
			return fail(400, { action: 'setActive', success: false, error: copy.messages.invalid });
		}

		const result = await setActive(parsed.output.servicePriceId, parsed.output.isActive, user.id);
		if (!result.ok) {
			return fail(400, { action: 'setActive', success: false, error: copy.messages.notFound });
		}
		return { action: 'setActive', success: true, deactivated: !parsed.output.isActive };
	}
};
