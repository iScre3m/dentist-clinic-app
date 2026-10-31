<script lang="ts">
	import { Badge } from '#lib/components/ui/badge/index.ts';
	import * as Card from '#lib/components/ui/card/index.ts';
	import { formatDateTime } from '#lib/format.ts';
	import type { PageData } from './$types';

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
</script>

<svelte:head>
	<title>Panel · Consultorio</title>
</svelte:head>

<div class="space-y-6">
	<header>
		<h1 class="text-xl font-semibold">Panel</h1>
		<p class="text-muted-foreground mt-1 text-sm">
			Turnos próximos y eventos que necesitan un paciente.
		</p>
	</header>

	<Card.Root>
		<Card.Header>
			<Card.Title>Próximos turnos</Card.Title>
		</Card.Header>
		<Card.Content>
			{#if data.upcoming.length === 0}
				<p class="text-muted-foreground text-sm">No hay turnos próximos.</p>
			{:else}
				<ul class="divide-y">
					{#each data.upcoming as appointment (appointment.id)}
						<li class="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0">
							<div>
								<p class="text-sm font-medium">{appointment.patientName ?? 'Sin paciente'}</p>
								<p class="text-muted-foreground text-xs">
									{formatDateTime(appointment.startsAt, appointment.allDay)}
									{#if appointment.patientPhone}
										· {appointment.patientPhone}
									{/if}
								</p>
							</div>
							<Badge variant="outline" class={attendanceClasses[appointment.attendanceStatus]}>
								{attendanceLabels[appointment.attendanceStatus]}
							</Badge>
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
			{#if data.unmatched.length === 0}
				<p class="text-muted-foreground text-sm">No hay eventos sin paciente.</p>
			{:else}
				<ul class="divide-y">
					{#each data.unmatched as appointment (appointment.id)}
						<li class="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0">
							<div>
								<p class="text-sm font-medium">{appointment.summary ?? 'Sin título'}</p>
								<p class="text-muted-foreground text-xs">
									{formatDateTime(appointment.startsAt)}
								</p>
							</div>
							<Badge variant="outline" class="border-amber-200 bg-amber-50 text-amber-800">
								Falta vincular
							</Badge>
						</li>
					{/each}
				</ul>
			{/if}
		</Card.Content>
	</Card.Root>
</div>
