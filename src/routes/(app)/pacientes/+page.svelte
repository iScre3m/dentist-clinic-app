<script lang="ts">
	import { resolve } from '$app/paths';
	import { enhance } from '$app/forms';
	import { Badge } from '#lib/components/ui/badge/index.ts';
	import { Button } from '#lib/components/ui/button/index.ts';
	import * as Card from '#lib/components/ui/card/index.ts';
	import Input from '#lib/components/ui/input/input.svelte';
	import Label from '#lib/components/ui/label/label.svelte';
	import {
		consentBadgeClasses,
		consentLabels,
		patientsCopy as copy,
		unverifiedBadgeClass
	} from '#lib/copy.ts';
	import { formatDate } from '#lib/format.ts';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const archivedHref = $derived(
		resolve('/(app)/pacientes') +
			(data.query ? `?q=${encodeURIComponent(data.query)}&` : '?') +
			(data.showArchived ? '' : 'archivados=1')
	);
</script>

<svelte:head>
	<title>{copy.page.title} · Consultorio</title>
</svelte:head>

<div class="space-y-6">
	<header class="flex flex-wrap items-end justify-between gap-4">
		<div>
			<h1 class="text-xl font-semibold">{copy.page.title}</h1>
			<p class="text-muted-foreground mt-1 text-sm">{copy.page.subtitle}</p>
		</div>
		<Button variant="outline" size="sm" href={archivedHref}>
			{data.showArchived ? copy.search.hideArchived : copy.search.showArchived}
		</Button>
	</header>

	<form method="GET" class="flex flex-wrap items-end gap-2">
		<div class="min-w-64 flex-1 space-y-2">
			<Label for="q">{copy.search.label}</Label>
			<Input
				id="q"
				name="q"
				type="search"
				maxlength={80}
				placeholder={copy.search.placeholder}
				value={data.query}
			/>
		</div>
		<Button type="submit">{copy.search.button}</Button>
		{#if data.query}
			<Button variant="ghost" href={resolve('/(app)/pacientes')}>{copy.search.clear}</Button>
		{/if}
	</form>

	<Card.Root>
		<Card.Content class="p-0">
			{#if data.list.length === 0}
				<div class="space-y-3 px-6 py-8 text-sm">
					{#if data.query}
						<p class="text-muted-foreground">{copy.list.emptySearch(data.query)}</p>
					{:else}
						<p class="font-medium">{copy.list.emptyTitle}</p>
						<p class="text-muted-foreground">{copy.list.emptyHint}</p>
						<Button variant="outline" size="sm" href={resolve('/')}>
							{copy.list.registrationLink}
						</Button>
					{/if}
				</div>
			{:else}
				<ul class="divide-y">
					{#each data.list as patient (patient.id)}
						<li class="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-6 py-3">
							<div class="min-w-0">
								<div class="flex flex-wrap items-center gap-2">
									<span class="text-sm font-medium">{patient.name}</span>
									{#if !patient.phoneVerifiedAt}
										<Badge variant="outline" class={unverifiedBadgeClass}>
											{copy.badges.unverified}
										</Badge>
										<form method="POST" action="?/confirmPhone" use:enhance class="inline">
											<input type="hidden" name="patientId" value={patient.id} />
											<Button type="submit" size="sm" variant="outline">
												{copy.detail.confirmPhone}
											</Button>
										</form>
									{/if}
									<Badge variant="outline" class={consentBadgeClasses[patient.whatsappConsent]}>
										{consentLabels[patient.whatsappConsent]}
									</Badge>
									{#if patient.archivedAt}
										<Badge variant="secondary">{copy.badges.archived}</Badge>
									{/if}
								</div>
								<p class="text-muted-foreground mt-1 text-xs">
									<span class="font-mono">{patient.phone}</span>
									· {copy.list.registeredLabel}
									{formatDate(patient.registeredAt)}
								</p>
							</div>
						</li>
					{/each}
				</ul>

				{#if data.total > data.list.length}
					<p class="text-muted-foreground border-t px-6 py-3 text-xs">
						{copy.list.shownOfTotal(data.list.length, data.total)}
						{copy.list.narrowHint}
					</p>
				{/if}
			{/if}
		</Card.Content>
	</Card.Root>
</div>
