import { describe, expect, it } from 'vitest';
import { buildRegistrationInviteLink, buildWaMeLink, TEMPLATES, renderTemplate } from './index.ts';

describe('buildWaMeLink', () => {
	it('uses digits only: no +, spaces or separators', () => {
		const link = buildWaMeLink('+54 9 11 5555-0001', 'mensaje');
		const match = link.match(/^https:\/\/wa\.me\/(\d+)\?text=(.*)$/);
		expect(match).not.toBeNull();
		expect(match![1]).toBe('5491155550001');
	});

	it('keeps the full E.164 number after stripping non-digits', () => {
		const link = buildWaMeLink('5491155550001', 'mensaje');
		expect(link.match(/^https:\/\/wa\.me\/\d+\?text=/)).not.toBeNull();
		expect(link.includes('5491155550001')).toBe(true);
	});

	it('URL-encodes multi-line Spanish messages without altering them', () => {
		const message = 'Hola Ana\n\nTotal: $65.000\n¡Gracias!';
		const link = buildWaMeLink('+5491155550001', message);
		const encoded = link.split('?text=')[1];
		expect(decodeURIComponent(encoded!)).toBe(message);
		// Encoded text carries no raw spaces or newlines.
		expect(encoded).not.toMatch(/[\s]/);
	});
});

describe('renderTemplate', () => {
	it('replaces every occurrence of each variable', () => {
		const text = renderTemplate('invoice', {
			nombre: 'Ana',
			fecha: 'martes, 10 de marzo',
			consultorio: 'Consultorio',
			servicios: '• Consulta — $15.000',
			total: '15.000',
			contacto_consultorio: 'Consultorio, CABA'
		});
		expect(text).not.toContain('{{');
		expect(text).toContain('Hola Ana');
		expect(text).toContain('Total: $15.000');
	});

	it('leaves unknown placeholders intact so the empty-render fallback can detect them', () => {
		// The invoice service rejects messages with leftover {{ placeholders.
		const text = renderTemplate('manual', { nombre: 'Ana' });
		expect(text).toContain('{{fecha}}');
		expect(text.includes('{{')).toBe(true);
	});

	it('every template ships non-empty, or every render would fail', () => {
		for (const [key, text] of Object.entries(TEMPLATES)) {
			if (key === 'invoice') continue; // validated through its variable list
			expect(text.trim(), key).not.toBe('');
		}
	});
});

describe('buildRegistrationInviteLink', () => {
	it('builds the invite from the registration template with digits-only phone', () => {
		const link = buildRegistrationInviteLink('+5491155550001', 'https://app.example.com');
		const match = link.match(/^https:\/\/wa\.me\/(\d+)\?text=(.*)$/);
		expect(match![1]).toBe('5491155550001');
		const message = decodeURIComponent(match![2]!);
		expect(message).toContain('completá tus datos una sola vez');
		expect(message).toContain('https://app.example.com/');
	});
});
