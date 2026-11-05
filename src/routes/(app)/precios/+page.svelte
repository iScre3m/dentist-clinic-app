<script lang="ts">
	import { enhance } from '$app/forms';
	import * as Card from '#lib/components/ui/card/index.ts';
	import { Button } from '#lib/components/ui/button/index.ts';
	import { Badge } from '#lib/components/ui/badge/index.ts';
	import Input from '#lib/components/ui/input/input.svelte';
	import Label from '#lib/components/ui/label/label.svelte';
	import { formatArs, formatDate } from '#lib/format.ts';
	import { preciosCopy as copy } from '#lib/copy.ts';
	import type { PageData } from './$types';

	type ActionForm = {
		success?: boolean;
		action?: string;
		deactivated?: boolean;
		error?: string;
	} | null;

	let { data, form }: { data: PageData; form: ActionForm } = $props();

	let openCreate = $state(false);
	let serviceType = $state('');
	let name = $state('');
	let createPrice = $state('');

	let editingId = $state<string | null>(null);
	let editingPrice = $state('');

	$effect(() => {
		if (form?.success) {
			openCreate = false;
			editingId = null;
			serviceType = '';
			name = '';
			createPrice = '';
		}
	});

	function successMessage(): string {
		if (!form?.success) return '';
		if (form.action === 'create') return copy.messages.created;
		if (form.action === 'update') return copy.messages.updated;
		return form.deactivated ? copy.messages.deactivated : copy.messages.activated;
	}

	function formatUpdatedAt(date: number | Date): string {
		return formatDate(date instanceof Date ? date : new Date(date));
	}
</script>

<svelte:head>
	<title>{copy.page.title} · Consultorio</title>
</svelte:head>

<div class="space-y-6">
	<header class="flex flex-wrap items-center justify-between gap-4">
		<div>
			<h1 class="text-xl font-semibold">{copy.page.title}</h1>
			<p class="text-muted-foreground mt-1 text-sm">{copy.page.subtitle}</p>
		</div>
		<Button size="sm" onclick={() => (openCreate = !openCreate)}>{copy.create.openButton}</Button>
	</header>

	{#if form?.success}
		<div class="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
			{successMessage()}
		</div>
	{/if}
	{#if form?.error}
		<div class="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">
			{form.error}
		</div>
	{/if}

	{#if openCreate}
		<Card.Root>
			<Card.Header>
				<Card.Title>{copy.create.title}</Card.Title>
			</Card.Header>
			<Card.Content>
				<form method="POST" action="?/create" class="space-y-4" use:enhance>
					<div class="grid gap-4 sm:grid-cols-3">
						<div class="space-y-2">
							<Label for="serviceType">{copy.create.typeLabel}</Label>
							<Input id="serviceType" name="serviceType" bind:value={serviceType} required />
						</div>
						<div class="space-y-2">
							<Label for="name">{copy.create.nameLabel}</Label>
							<Input id="name" name="name" bind:value={name} required />
						</div>
						<div class="space-y-2">
							<Label for="price">{copy.create.priceLabel}</Label>
							<Input
								id="price"
								name="price"
								type="number"
								min="0"
								step="1"
								bind:value={createPrice}
								required
							/>
						</div>
					</div>
					<Button type="submit">{copy.create.submit}</Button>
				</form>
			</Card.Content>
		</Card.Root>
	{/if}

	<Card.Root>
		<Card.Content>
			{#if (data.prices ?? []).length === 0}
				<p class="text-sm font-medium">{copy.list.emptyTitle}</p>
				<p class="text-muted-foreground mt-1 text-xs">{copy.list.emptyHint}</p>
			{:else}
				<ul class="divide-y">
					{#each data.prices as price (price.id)}
						<li
							class="flex flex-col gap-3 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between"
						>
							<div class="min-w-0">
								<div class="flex items-center gap-2">
									<p class="truncate text-sm font-medium">{price.name}</p>
									{#if !price.isActive}
										<Badge variant="outline">{copy.list.inactiveLabel}</Badge>
									{/if}
								</div>
								<p class="text-muted-foreground text-xs">
									{price.serviceType} · {copy.list.lastUpdateLabel}
									{price.updatedBy ?? '—'} ·
									{formatUpdatedAt(price.updatedAt)}
								</p>
							</div>
							<div class="flex flex-wrap items-center gap-2">
								<p class="text-muted-foreground text-sm" aria-label={copy.list.priceLabel}>
									{formatArs(price.price)}
								</p>

								{#if editingId === price.id}
									<form method="POST" action="?/update" use:enhance class="flex items-center gap-2">
										<input type="hidden" name="servicePriceId" value={price.id} />
										<Label for={'price-' + price.id} class="sr-only">{copy.edit.priceLabel}</Label>
										<Input
											id={'price-' + price.id}
											name="price"
											type="number"
											min="0"
											step="1"
											class="w-36"
											bind:value={editingPrice}
										/>
										<Button type="submit" size="sm">{copy.edit.save}</Button>
										<Button
											type="button"
											size="sm"
											variant="ghost"
											onclick={() => (editingId = null)}
										>
											{copy.edit.cancel}
										</Button>
									</form>
								{:else}
									<Button
										size="sm"
										variant="outline"
										onclick={() => {
											editingId = price.id;
											editingPrice = String(price.price);
										}}
									>
										Cambiar
									</Button>

									<form method="POST" action="?/setActive" use:enhance class="inline">
										<input type="hidden" name="servicePriceId" value={price.id} />
										<input type="hidden" name="isActive" value={price.isActive ? '0' : '1'} />
										{#if price.isActive}
											<Button type="submit" size="sm" variant="ghost">{copy.list.deactivate}</Button
											>
										{:else}
											<Button type="submit" size="sm" variant="ghost">{copy.list.activate}</Button>
										{/if}
									</form>
								{/if}
							</div>
						</li>
					{/each}
				</ul>
			{/if}
		</Card.Content>
	</Card.Root>
</div>
