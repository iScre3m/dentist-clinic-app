<script lang="ts">
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
		scheduled: 'bg-amber-100 text-amber-800',
		confirmed: 'bg-emerald-100 text-emerald-800',
		attended: 'bg-slate-200 text-slate-700',
		no_show: 'bg-red-100 text-red-800'
	};
</script>

<svelte:head>
	<title>Panel · Consultorio</title>
</svelte:head>

<div class="space-y-8">
	<div>
		<h1 class="text-xl font-semibold">Panel</h1>
		<p class="mt-1 text-sm text-slate-600">Turnos próximos y eventos que necesitan un paciente.</p>
	</div>

	<section class="rounded-lg border border-slate-200 bg-white">
		<header class="border-b border-slate-200 px-5 py-3">
			<h2 class="text-sm font-semibold">Próximos turnos</h2>
		</header>

		{#if data.upcoming.length === 0}
			<p class="px-5 py-6 text-sm text-slate-600">No hay turnos próximos.</p>
		{:else}
			<ul class="divide-y divide-slate-100">
				{#each data.upcoming as appointment (appointment.id)}
					<li class="flex items-center justify-between gap-4 px-5 py-3">
						<div>
							<p class="text-sm font-medium">
								{appointment.patientName ?? 'Sin paciente'}
							</p>
							<p class="text-xs text-slate-500">
								{formatDateTime(appointment.startsAt, appointment.allDay)}
								{#if appointment.patientPhone}
									· {appointment.patientPhone}
								{/if}
							</p>
						</div>
						<span
							class="rounded-full px-2.5 py-1 text-xs font-medium {attendanceClasses[
								appointment.attendanceStatus
							]}"
						>
							{attendanceLabels[appointment.attendanceStatus]}
						</span>
					</li>
				{/each}
			</ul>
		{/if}
	</section>

	<section class="rounded-lg border border-slate-200 bg-white">
		<header class="border-b border-slate-200 px-5 py-3">
			<h2 class="text-sm font-semibold">Eventos sin paciente</h2>
		</header>

		{#if data.unmatched.length === 0}
			<p class="px-5 py-6 text-sm text-slate-600">No hay eventos sin paciente.</p>
		{:else}
			<ul class="divide-y divide-slate-100">
				{#each data.unmatched as appointment (appointment.id)}
					<li class="flex items-center justify-between gap-4 px-5 py-3">
						<div>
							<p class="text-sm font-medium">{appointment.summary ?? 'Sin título'}</p>
							<p class="text-xs text-slate-500">{formatDateTime(appointment.startsAt)}</p>
						</div>
						<span class="text-xs text-amber-700">Falta vincular</span>
					</li>
				{/each}
			</ul>
		{/if}
	</section>
</div>
