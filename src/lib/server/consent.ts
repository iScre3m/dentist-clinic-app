import consentMarkdown from '../../../templates/consent/consentimiento.es.md?raw';

const PATIENT_START = '## Texto que ve el paciente';
const PATIENT_END = '## Registro';

/**
 * The consent text lives in `templates/consent/consentimiento.es.md` and is
 * versioned there. Editing the patient-facing text requires bumping
 * `Versión:` in that file so earlier consents stay traceable.
 */
function readVersion(markdown: string): number {
	const match = markdown.match(/^Versión:\s*(\d+)\s*$/m);
	if (!match) {
		throw new Error('El consentimiento no declara una línea "Versión: N".');
	}
	return Number(match[1]);
}

function readPatientText(markdown: string): string {
	const start = markdown.indexOf(PATIENT_START);
	const end = markdown.indexOf(PATIENT_END);
	if (start === -1 || end === -1 || end <= start) {
		throw new Error('El consentimiento no tiene las secciones esperadas.');
	}
	return markdown.slice(markdown.indexOf('\n', start) + 1, end).trim();
}

export const CONSENT_VERSION = readVersion(consentMarkdown);
export const CONSENT_TEXT = readPatientText(consentMarkdown);
