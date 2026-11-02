import * as v from 'valibot';

const idSchema = v.pipe(v.string(), v.uuid('Identificador inválido.'));

/** Add a service to an appointment from the multi-select. Reselect uses the same schema (upsert). */
export const addAppointmentServiceSchema = v.object({
	appointmentId: idSchema,
	servicePriceId: idSchema,
	quantity: v.pipe(
		v.number('Ingresá una cantidad.'),
		v.integer('La cantidad no puede tener decimales.'),
		v.minValue(1, 'La cantidad mínima es 1.'),
		v.maxValue(99, 'La cantidad máxima es 99.')
	)
});

export type AddAppointmentServiceInput = v.InferOutput<typeof addAppointmentServiceSchema>;

/** Edit the quantity of a service already recorded on the appointment. */
export const setAppointmentServiceQuantitySchema = v.object({
	appointmentServiceId: idSchema,
	quantity: v.pipe(
		v.number('Ingresá una cantidad.'),
		v.integer('La cantidad no puede tener decimales.'),
		v.minValue(1, 'La cantidad mínima es 1.'),
		v.maxValue(99, 'La cantidad máxima es 99.')
	)
});

export type SetAppointmentServiceQuantityInput = v.InferOutput<
	typeof setAppointmentServiceQuantitySchema
>;

/** Remove a service previously recorded on the appointment. */
export const removeAppointmentServiceSchema = v.object({
	appointmentServiceId: idSchema
});

export type RemoveAppointmentServiceInput = v.InferOutput<typeof removeAppointmentServiceSchema>;

/** Generate an invoice snapshot for the appointment. */
export const generateInvoiceSchema = v.object({
	appointmentId: idSchema
});

export type GenerateInvoiceInput = v.InferOutput<typeof generateInvoiceSchema>;

/** Confirm a delivery (mark sent / mark skipped). One of the two actions, never both. */
export const confirmInvoiceDeliverySchema = v.object({
	invoiceId: idSchema,
	action: v.picklist(['sent', 'skipped'], 'Elegí una opción.')
});

export type ConfirmInvoiceDeliveryInput = v.InferOutput<typeof confirmInvoiceDeliverySchema>;

/**
 * Intentional resend: always creates a fresh snapshot (new invoice history row)
 * with a written reason; sending still requires later confirmation by staff.
 */
export const resendInvoiceSchema = v.object({
	invoiceId: idSchema,
	reason: v.pipe(
		v.string(),
		v.trim(),
		v.minLength(1, 'Escribí un motivo para el reenvío.'),
		v.maxLength(200, 'El motivo es demasiado largo.')
	)
});

export type ResendInvoiceInput = v.InferOutput<typeof resendInvoiceSchema>;
