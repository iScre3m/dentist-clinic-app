<script lang="ts">
	let { data } = $props();
</script>

<svelte:head>
	<title>Facturas</title>
</svelte:head>

<section class="space-y-4">
	<h1 class="text-2xl font-semibold">Facturas</h1>
	<p class="text-muted-foreground">Historial de facturas emitidas.</p>
	{#if data.invoices.length === 0}
		<p class="text-sm text-muted-foreground">No hay facturas registradas.</p>
	{/if}
</section>
