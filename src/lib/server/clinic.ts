import './load-env.ts';

export type ClinicInfo = {
	name: string;
	phone: string;
	address: string;
};

/**
 * Clinic identity used on invoices. Server-side only: it is never sent to the
 * client as configuration, only inside rendered invoice/WhatsApp message text.
 *
 * Fails with a single clear error listing every missing variable, because an
 * invoice with incomplete clinic information must never be rendered.
 */
export function getClinicInfo(): ClinicInfo {
	const name = process.env.CLINIC_NAME?.trim() ?? '';
	const phone = process.env.CLINIC_PHONE?.trim() ?? '';
	const address = process.env.CLINIC_ADDRESS?.trim() ?? '';

	const missing = Object.entries({
		CLINIC_NAME: name,
		CLINIC_PHONE: phone,
		CLINIC_ADDRESS: address
	})
		.filter(([, value]) => value === '')
		.map(([key]) => key);

	if (missing.length > 0) {
		throw new Error(
			'Falta configurar el consultorio para las facturas. Definí estas variables en .env: ' +
				missing.join(', ')
		);
	}

	return { name, phone, address };
}
