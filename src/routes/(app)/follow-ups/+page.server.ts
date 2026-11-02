import { fail } from '@sveltejs/kit';
import * as v from 'valibot';
import { requireUser } from '#lib/server/session.ts';
import { db } from '#lib/server/db/index.ts';
import { patients } from '#lib/server/db/schema.ts';
import { asc, isNull } from 'drizzle-orm';
import {
	createFollowUp,
	completeFollowUp,
	cancelFollowUp,
	recordContactAttempt,
	listAllOpen,
	summary,
	type CreateFollowUpInput
} from '#lib/server/services/follow-ups/index.ts';
import type { Actions, PageServerLoad } from './$types';

const createSchema = v.object({
	description: v.pipe(
		v.string(),
		v.trim(),
		v.minLength(1, 'Escribí una descripción.'),
		v.maxLength(200)
	),
	dueDate: v.pipe(v.string(), v.minLength(1, 'Elegí una fecha.')),
	patientId: v.pipe(v.string(), v.uuid('Elegí un paciente.'))
});

const contactSchema = v.object({
	followUpId: v.pipe(v.string(), v.uuid()),
	contactDate: v.string()
});

const completeSchema = v.object({
	followUpId: v.pipe(v.string(), v.uuid())
});

const cancelSchema = v.object({
	followUpId: v.pipe(v.string(), v.uuid())
});

function parseDate(value: string): Date | null {
	const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
	if (!match) return null;
	const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
	return Number.isNaN(date.getTime()) ? null : date;
}

export const load: PageServerLoad = async ({ locals }) => {
	requireUser(locals);

	const [tasks, totals, patientRows] = await Promise.all([
		listAllOpen(20),
		summary(),
		db
			.select({ id: patients.id, name: patients.name })
			.from(patients)
			.where(isNull(patients.archivedAt))
			.orderBy(asc(patients.name))
	]);

	return {
		tasks,
		summary: totals,
		patients: patientRows,
		today: new Date().toISOString().slice(0, 10)
	};
};

export const actions: Actions = {
	create: async ({ locals, request }) => {
		const user = requireUser(locals);
		const form = await request.formData();
		const parsed = v.safeParse(createSchema, {
			description: form.get('description')?.toString() ?? '',
			dueDate: form.get('dueDate')?.toString() ?? '',
			patientId: form.get('patientId')?.toString() ?? ''
		});

		if (!parsed.success) {
			return fail(400, {
				action: 'create',
				success: false,
				error: parsed.issues[0]?.message,
				values: parsed.output
			});
		}

		const dueAt = parseDate(parsed.output.dueDate);
		if (!dueAt) {
			return fail(400, {
				action: 'create',
				success: false,
				error: 'Ingresá una fecha válida (aaaa-mm-dd).',
				values: parsed.output
			});
		}

		const input: CreateFollowUpInput = {
			patientId: parsed.output.patientId,
			description: parsed.output.description,
			dueAt,
			assignedTo: user.id
		};
		const result = await createFollowUp(input);
		if (!result.ok) {
			return fail(400, {
				action: 'create',
				success: false,
				error: 'No se encontró ese paciente.',
				values: parsed.output
			});
		}

		return { action: 'create', success: true, followUpId: result.id };
	},

	recordContact: async ({ locals, request }) => {
		requireUser(locals);
		const form = await request.formData();
		const parsed = v.safeParse(contactSchema, {
			followUpId: form.get('followUpId')?.toString() ?? '',
			contactDate: form.get('contactDate')?.toString() ?? ''
		});

		if (!parsed.success) {
			return fail(400, {
				action: 'recordContact',
				success: false,
				error: parsed.issues[0]?.message
			});
		}

		const contactAt = parseDate(parsed.output.contactDate) ?? new Date();
		const result = await recordContactAttempt(parsed.output.followUpId, contactAt);
		if (!result.ok) {
			return fail(400, {
				action: 'recordContact',
				success: false,
				error: 'No se puede registrar contacto en ese seguimiento.'
			});
		}
		return { action: 'recordContact', success: true };
	},

	complete: async ({ locals, request }) => {
		const user = requireUser(locals);
		const form = await request.formData();
		const parsed = v.safeParse(completeSchema, {
			followUpId: form.get('followUpId')?.toString() ?? ''
		});

		if (!parsed.success) {
			return fail(400, { action: 'complete', success: false, error: parsed.issues[0]?.message });
		}

		const result = await completeFollowUp(parsed.output.followUpId, user.id);
		if (!result.ok) {
			return fail(400, {
				action: 'complete',
				success: false,
				error: 'No se puede completar ese seguimiento.'
			});
		}
		return { action: 'complete', success: true };
	},

	cancel: async ({ request }) => {
		const form = await request.formData();
		const parsed = v.safeParse(cancelSchema, {
			followUpId: form.get('followUpId')?.toString() ?? ''
		});

		if (!parsed.success) {
			return fail(400, { action: 'cancel', success: false, error: parsed.issues[0]?.message });
		}

		const result = await cancelFollowUp(parsed.output.followUpId);
		if (!result.ok) {
			return fail(400, {
				action: 'cancel',
				success: false,
				error: 'No se puede cancelar ese seguimiento.'
			});
		}
		return { action: 'cancel', success: true };
	}
};
