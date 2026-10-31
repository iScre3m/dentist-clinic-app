<script lang="ts">
	import { Badge } from '#lib/components/ui/badge/index.ts';
	import * as Card from '#lib/components/ui/card/index.ts';
	import { Button } from '#lib/components/ui/button/index.ts';
	import { Input } from '#lib/components/ui/input/index.ts';
	import { Label } from '#lib/components/ui/label/index.ts';
	import { formatDateTime } from '#lib/format.ts';
	import { reminderCopy } from '#lib/copy.ts';
	import { enhance } from '$app/forms';
	import type { PageData } from './$types';

	type DashboardData = {
		syncState?: { lastSyncedAt?: string | number | Date; lastError?: string };
		user?: { id: string; name: string } | null;
		upcoming?: Array<{
			id: string;
			patientName?: string | null;
			patientPhone?: string | null;
			patientConsent?: string | null;
			patientOptedOutAt?: string | number | Date | null;
			startsAt: string | number | Date;
			allDay?: boolean;
			attendanceStatus: string;
			calendarStatus: string;
		}>;
		unmatched?: Array<{
			id: string;
			summary?: string | null;
			startsAt: string | number | Date;
			allDay?: boolean;
		}>;
	};

	let { data }: { data: PageData } = $props();

	const attendanceLabels: Record<string, string> = {
		scheduled: 'Sin confirmar',
		confirmed: 'Confirmado',
		attended: 'Asistió',
		no_show: 'No vino'
	};

	const attendanceClasses: Record<string, string> = {
		scheduled: 'border-amber-200 bg-amber-50 text-amber-800',
		confirmed: 'border-emerald-200 bg-emerald-50 text-emerald-800',
		attended: '',
		no_show: 'border-red-200 bg-red-50 text-red-800'
	};

	type ReminderAction = 'send' | 'none';
	type Appointment = NonNullable<DashboardData['upcoming']>[number];

	function reminderAction(a: Appointment): ReminderAction {
		if (!a.patientConsent || !a.patientPhone || a.patientOptedOutAt) return 'none';
		if (a.patientConsent === 'granted') return 'send';
		return 'none';
	}
</script>

<svelte:head>
	<title>Panel · Consultorio</title>
</svelte:head>

<div class='space-y-6'>
	<header>
		<h1 class='text-xl font-semibold'>Panel</h1>
		<p class='text-muted-foreground mt-1 text-sm'>
			Turnos próximos y eventos que necesitan un paciente.
		</p>
	</header>

	<Card.Root>
		<Card.Header>
			<Card.Title>Sincronización con Google Calendar</Card.Title>
		</Card.Header>
		<Card.Content>
			<div class='flex items-center justify-between'>
				<div class='text-sm text-muted-foreground'>
					{#if (data as DashboardData).syncState?.lastSyncedAt}
						Última sincronización: {formatDateTime(new Date((data as DashboardData).syncState!.lastSyncedAt!))}
					{:else}
						Sin sincronización registrada
					{/if}
					{#if (data as DashboardData).syncState?.lastError}
						Error: {(data as DashboardData).syncState!.lastError}
					{/if}
				</div>
				<div class='flex gap-2'>
					<form method='POST' action='?/incrementalSync' use:enhance>
						<Button type='submit' variant='outline' size='sm'>Sincronizar</Button>
					</form>
					<form method='POST' action='?/sync' use:enhance>
						<Button type='submit' size='sm'>Sincronizar ahora</Button>
					</form>
				</div>
			</div>
		</Card.Content>
	</Card.Root>

	<Card.Root>
		<Card.Header>
			<Card.Title>Próximos turnos</Card.Title>
		</Card.Header>
		<Card.Content>
			{#if ((data as DashboardData).upcoming || []).length === 0}
				<p class='text-muted-foreground text-sm'>No hay turnos próximos.</p>
			{:else}
				<ul class='divide-y'>
					{#each (data as DashboardData).upcoming as appointment (appointment.id)}
						<li class='flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0'>
							<div>
								<p class='text-sm font-medium'>{appointment.patientName ?? 'Sin paciente'}</p>
								<p class='text-muted-foreground text-xs'>
									{formatDateTime(new Date(appointment.startsAt), appointment.allDay)}
									{#if appointment.patientPhone}
										· {appointment.patientPhone}
									{/if}
								</p>
							</div>
							<div class='flex items-center gap-2'>
								{#if appointment.patientName}
									<Badge variant='outline' class={attendanceClasses[appointment.attendanceStatus]}>
										{attendanceLabels[appointment.attendanceStatus]}
									</Badge>
								{/if}
								{#if reminderAction(appointment) === 'send'}
									<Button size='sm' variant='outline' onclick={() => {
										window.location.href = '/turnos/' + appointment.id + '/recordatorio';
									}}>
										{reminderCopy.button.send}
									</Button>
								{:else}
									<span class='text-xs text-muted-foreground'>{reminderCopy.message.notEligible}</span>
								{/if}
							</div>
						</li>
					{/each}
				</ul>
			{/if}
		</Card.Content>
	</Card.Root>

	<Card.Root>
		<Card.Header>
			<Card.Title>Eventos sin paciente</Card.Title>
		</Card.Header>
		<Card.Content>
			{#if ((data as DashboardData).unmatched || []).length === 0}
				<p class='text-muted-foreground text-sm'>No hay eventos sin paciente.</p>
			{:else}
				<ul class='divide-y'>
					{#each (data as DashboardData).unmatched as appointment (appointment.id)}
						<li class='flex flex-col gap-3 py-3 first:pt-0 last:pb-0'>
							<div class='flex items-center justify-between gap-4'>
								<div>
									<p class='text-sm font-medium'>{appointment.summary ?? 'Sin título'}</p>
									<p class='text-muted-foreground text-xs'>
										{formatDateTime(new Date(appointment.startsAt), appointment.allDay)}
									</p>
								</div>
								<Badge variant='outline' class='border-amber-200 bg-amber-50 text-amber-800'>
									Falta vincular
								</Badge>
							</div>
							<div class='flex flex-wrap items-center gap-2'>
								<form method='POST' action='?/linkPatient' use:enhance class='flex items-center gap-2'>
									<input type='hidden' name='appointmentId' value={appointment.id} />
									<Label for={'phone-' + appointment.id} class='sr-only'>Telófono</Label>
									<Input id={'phone-' + appointment.id} name='phone' placeholder='+54 9 11...' class='w-48' />
									<Button type='submit' size='sm' variant='outline'>Vincular paciente</Button>
								</form>
							</div>
						</li>
					{/each}
				</ul>
			{/if}
		</Card.Content>
	</Card.Root>
</div>

