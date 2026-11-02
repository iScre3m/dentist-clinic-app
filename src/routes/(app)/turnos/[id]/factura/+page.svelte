<script lang="ts">
	import { Button } from '#lib/components/ui/button/index.ts';
	import { Label } from '#lib/components/ui/label/index.ts';
	import { enhance } from '$app/forms';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	let selectedService = $state('');
	let quantity = $state(1);

	$effect(() => {
		if (selectedService) quantity = 1;
	});
	let copied = $state(false);

	let editedMessage = $derived(data.message ?? '');

	async function copyMessage() {
		try {
			await navigator.clipboard.writeText(editedMessage);
			copied = true;
			setTimeout(() => (copied = false), 1500);
		} catch {
			// Fallback: keep the field selectable.
		}
	}

	function buildWaMeLink() {
		const digits = (data.appointment.patientPhone ?? '').replace(/\D/g, '');
		return `https://wa.me/${digits}?text=${encodeURIComponent(editedMessage)}`;
	}

	function openWhatsApp() {
		window.open(buildWaMeLink(), '_blank');
	}
</script>

<svelte:head>
	<title>Factura</title>
</svelte:head>

<section class="space-y-6">
	<h1 class="text-2xl font-semibold">Factura</h1>

	{#if data.blockedMessage}
		<p class="text-sm text-red-600">{data.blockedMessage}</p>
	{/if}

	{#if data.missingPriceIds?.length}
		<p class="text-sm text-amber-700">
			Faltan precios para: {data.missingPriceIds.join(', ')}
		</p>
	{/if}

	<!-- Add service -->
	<form method="POST" action="?/add_service" use:enhance class="flex flex-wrap items-end gap-2">
		<input type="hidden" name="appointmentId" value={data.appointment.id} />
		<div class="flex flex-col gap-1">
			<Label for="servicePriceId">Práctica</Label>
			<select
				id="servicePriceId"
				name="servicePriceId"
				bind:value={selectedService}
				class="rounded border px-2 py-1"
			>
				<option value="">Elegí una práctica</option>
				{#each data.activePrices as p (p.id)}
					<option value={p.id}>{p.name} — ${p.price}</option>
				{/each}
			</select>
		</div>
		<div class="flex flex-col gap-1">
			<Label for="quantity">Cantidad</Label>
			<input
				id="quantity"
				name="quantity"
				type="number"
				min="1"
				max="99"
				bind:value={quantity}
				class="w-20 rounded border px-2 py-1"
			/>
		</div>
		<Button type="submit" size="sm">Agregar</Button>
	</form>

	<!-- Current services -->
	{#if data.services?.length}
		<ul class="divide-y">
			{#each data.services as s (s.id)}
				<li class="flex items-center justify-between gap-4 py-2">
					<span class="text-sm">{s.quantity} × {s.name}</span>
					<form method="POST" action="?/remove_service" use:enhance>
						<input type="hidden" name="appointmentServiceId" value={s.id} />
						<Button type="submit" size="sm" variant="outline">Quitar</Button>
					</form>
				</li>
			{/each}
		</ul>
	{:else}
		<p class="text-sm text-muted-foreground">Todavía no cargaste prácticas para este turno.</p>
	{/if}

	<!-- Itemized preview -->
	{#if data.invoiceData}
		<div class="space-y-2 rounded border p-3">
			<p class="font-medium">Vista previa de la factura</p>
			<ul class="divide-y">
				{#each data.invoiceData.services as s, i (i)}
					<li class="flex justify-between py-1 text-sm">
						<span>{s.quantity} × {s.name}</span>
						<span>${s.subtotal}</span>
					</li>
				{/each}
			</ul>
			<p class="text-sm font-semibold">Total: ${data.invoiceData.total}</p>
		</div>
	{/if}

	<!-- Generate -->
	{#if !data.blockedReason}
		<form method="POST" action="?/generate" use:enhance>
			<input type="hidden" name="appointmentId" value={data.appointment.id} />
			<Button type="submit" size="sm">Generar factura</Button>
		</form>
	{/if}

	<!-- Message preview + WhatsApp -->
	{#if data.message}
		<div class="space-y-3">
			<div class="space-y-2 rounded border p-3">
				<Label for="message">Vista previa del mensaje</Label>
				<textarea
					id="message"
					rows="6"
					bind:value={editedMessage}
					class="w-full font-mono text-sm leading-relaxed p-3 bg-muted border border-input rounded-md"
					spellcheck="false"></textarea>
				<div class="flex items-center gap-2">
					<Button type="button" size="sm" variant="outline" onclick={copyMessage} disabled={copied}>
						{copied ? 'Copiado' : 'Copiar mensaje'}
					</Button>
				</div>
			</div>
			<div class="space-y-2 rounded border p-3">
				<p class="text-sm text-muted-foreground">
					Hacé clic en el enlace para abrir WhatsApp con el mensaje ya escrito.
				</p>
				<Button type="button" size="sm" class="w-full" onclick={openWhatsApp}>
					Abrir en WhatsApp
				</Button>
			</div>
		</div>
	{/if}

	<!-- Confirm sent / skipped -->
	{#if data.invoices?.length && data.invoices[0]?.status === 'generated'}
		<div class="flex gap-2">
			<form method="POST" action="?/mark_sent" use:enhance>
				<input type="hidden" name="invoiceId" value={data.invoices[0].id} />
				<Button type="submit" size="sm">Marcar como enviado</Button>
			</form>
			<form method="POST" action="?/mark_skipped" use:enhance>
				<input type="hidden" name="invoiceId" value={data.invoices[0].id} />
				<Button type="submit" size="sm" variant="outline">Marcar como omitido</Button>
			</form>
		</div>
	{/if}
</section>
