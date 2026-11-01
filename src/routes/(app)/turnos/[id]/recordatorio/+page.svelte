<script lang="ts">
	import { Button } from '#lib/components/ui/button/index.ts';
	import * as Card from '#lib/components/ui/card/index.ts';
	import { Label } from '#lib/components/ui/label/index.ts';
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import { reminderCopy } from '#lib/copy.ts';
	import type { PageProps } from './$types';

	type RecordatorioData = {
		appointment: {
			id: string;
			summary?: string | null;
			startsAt: string | number | Date;
			allDay?: boolean;
			patientName?: string | null;
			patientPhone?: string | null;
		};
		message: string;
		waMeLink: string;
		templateKey: string;
		reminderRecord: {
			id: string;
			status: string;
			templateKey: string;
			recordedAt: string | number | Date | null;
			resentReason?: string | null;
		};
		canResend: boolean;
	};

	let { data, form }: { data: RecordatorioData; form: PageProps['form'] } = $props();

	const { appointment, message, templateKey, reminderRecord, canResend } = data;

	let editedMessage = $state(message);
	let copied = $state(false);

	async function copyMessage() {
		try {
			await navigator.clipboard.writeText(editedMessage);
			copied = true;
			setTimeout(() => (copied = false), 1500);
		} catch {
			// Fallback: keep the field selectable below.
		}
	}

	function buildWaMeLink() {
		const digits = (appointment.patientPhone ?? '').replace(/\D/g, '');
		return `https://wa.me/${digits}?text=${encodeURIComponent(editedMessage)}`;
	}

	function openWhatsApp() {
		window.open(buildWaMeLink(), '_blank');
	}

	function goBack() {
		window.location.href = resolve('/(app)/dashboard');
	}
</script>

<svelte:head>
	<title>Recordatorio · Consultorio</title>
</svelte:head>

<div class='space-y-6'>
	<header class='flex items-center justify-between gap-4'>
		<div>
			<button class='text-sm text-muted-foreground hover:text-foreground' onclick={goBack}>
				← Volver al panel
			</button>
			<h1 class='text-xl font-semibold mt-1'>Recordatorio de turno</h1>
			<p class='text-muted-foreground text-sm'>
				{appointment.patientName ?? 'Paciente'} · {appointment.patientPhone ?? 'Sin número'}
			</p>
		</div>
		<span class='text-xs text-muted-foreground'>Plantilla: {templateKey}</span>
	</header>

	{#if form?.error}
		<div class='rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800'>
			{form.error}
		</div>
	{/if}

	<Card.Root>
		<Card.Header>
			<Card.Title>Vista previa del mensaje</Card.Title>
			<Card.Description>
				Revisá el mensaje antes de abrir WhatsApp. Podés editar el texto si hace falta.
			</Card.Description>
		</Card.Header>
		<Card.Content>
			<textarea
				id='message'
				rows='6'
				bind:value={editedMessage}
				class='w-full font-mono text-sm leading-relaxed p-3 bg-muted border border-input rounded-md'
				spellCheck='false'
			>
{message}
			</textarea>
			<div class='mt-3 flex items-center gap-2'>
				<Button type='button' size='sm' variant='outline' onclick={copyMessage} disabled={copied}>
					{copied ? 'Copiado' : reminderCopy.button.copy}
				</Button>
				<span class='text-xs text-muted-foreground'>
					Si no se pudo copiar, seleccioná el texto de arriba.
				</span>
			</div>
		</Card.Content>
	</Card.Root>

	<Card.Root>
		<Card.Header>
			<Card.Title>Abrir en WhatsApp</Card.Title>
		</Card.Header>
		<Card.Content>
			<p class='text-sm text-muted-foreground mb-3'>
				Hacé clic en el enlace para abrir WhatsApp con el mensaje ya escrito. El envío lo hace el
				asistente desde su propia app de WhatsApp.
			</p>
			<Button type='button' size='sm' variant='default' class='w-full' onclick={openWhatsApp}>
				Abrir en WhatsApp
			</Button>
			<p class='text-xs text-muted-foreground mt-2'>
				Se abre en una nueva ventana. El enlace usa solo dígitos y el mensaje codificado.
			</p>
		</Card.Content>
	</Card.Root>

	<Card.Root>
		<Card.Header>
			<Card.Title>Registrar el resultado</Card.Title>
		</Card.Header>
		<Card.Content>
			{#if reminderRecord.status === 'prepared'}
				<form method='POST' action='?/marcarEnviado' use:enhance class='flex items-center gap-2'>
					<input type='hidden' name='appointmentId' value={appointment.id} />
					<Button type='submit' size='sm'>{reminderCopy.button.sent}</Button>
				</form>
				<form method='POST' action='?/omitir' use:enhance class='flex items-center gap-2'>
					<input type='hidden' name='appointmentId' value={appointment.id} />
					<Button type='submit' size='sm' variant='outline'>{reminderCopy.button.skipped}</Button>
				</form>
				{#if canResend}
					<form method='POST' action='?/reenviar' use:enhance class='mt-3 flex flex-wrap items-center gap-2'>
						<input type='hidden' name='appointmentId' value={appointment.id} />
						<Label for={'resent-reason-' + appointment.id} class='sr-only'>
							{reminderCopy.label.resendReason}
						</Label>
						<input
							id={'resent-reason-' + appointment.id}
							name='resent_reason'
							placeholder={reminderCopy.label.resendReason}
							class='border-input bg-background focus-visible:border-ring focus-visible:ring-ring/50 h-9 rounded-md border px-3 text-sm outline-none focus-visible:ring-3 w-48'
							required
						/>
						<Button type='submit' size='sm'>{reminderCopy.button.resend}</Button>
					</form>
					<p class='text-xs text-muted-foreground mt-1'>{reminderCopy.message.resendRequired}</p>
				{/if}
			{:else if reminderRecord.status === 'sent'}
				<div class='text-sm text-emerald-800 flex items-center gap-2'>
					<span class='text-emerald-400' role='img'>✓</span>
					{reminderCopy.message.sent}
				</div>
				{#if reminderRecord.resentReason}
					<p class='text-xs text-muted-foreground mt-1'>
						Reenviado: {reminderRecord.resentReason}
					</p>
				{/if}
			{:else if reminderRecord.status === 'skipped'}
				<div class='text-sm text-amber-800 flex items-center gap-2'>
					<span class='text-amber-400' role='img'>⚠</span>
					{reminderCopy.message.skipped}
				</div>
			{/if}
			{#if reminderRecord.recordedAt}
				<p class='text-xs text-muted-foreground mt-2'>
					Registrado el {new Date(reminderRecord.recordedAt).toLocaleString('es-AR')}
				</p>
			{/if}
		</Card.Content>
	</Card.Root>
</div>
