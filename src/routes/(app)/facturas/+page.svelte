<script lang="ts">
	import { formatDateTime } from '#lib/format.ts';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
</script>

<svelte:head>
	<title>Facturas</title>
</svelte:head>

<section class="space-y-4">
	<h1 class="text-2xl font-semibold">Facturas</h1>
	<p class="text-muted-foreground">Historial de facturas emitidas.</p>
	{#if data.invoices.length === 0}
		<p class="text-sm text-muted-foreground">No hay facturas registradas.</p>
	{:else}
		<ul class="divide-y">
			{#each data.invoices as inv (inv.id)}
				<li class="flex items-center justify-between gap-4 py-3">
					<div>
						<p class="text-sm font-medium">{inv.patientName}</p>
						<p class="text-muted-foreground text-xs">
							{formatDateTime(new Date(inv.createdAt))}
						</p>
					</div>
					<div class="text-sm font-medium">
						${inv.total}
					</div>
				</li>
			{/each}
		</ul>
	{/if}
</section>
