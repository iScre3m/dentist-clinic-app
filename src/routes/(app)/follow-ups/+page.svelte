<script lang="ts">
	import { enhance } from '$app/forms';
	import { Badge } from '#lib/components/ui/badge/index.ts';
	import * as Card from '#lib/components/ui/card/index.ts';
	import { Button } from '#lib/components/ui/button/index.ts';
	import Input from '#lib/components/ui/input/input.svelte';
	import Label from '#lib/components/ui/label/label.svelte';
	import { formatDate } from '#lib/format.ts';
	import { followUpsCopy as copy } from '#lib/copy.ts';
	import type { PageData } from './$types';

	type ActionForm = { success?: boolean; action?: string; error?: string; values?: Record<string, string> } | null;

	let { data, form }: { data: PageData; form: ActionForm } = $props();

	let openForm = $state(false);
	let description = $state('');
	let dueDate = $state(data.today);
	let contactDates: Record<string, string> = $state({});

	const patientOptions = $derived(
		(data.patients ?? []).map((p) => ({ value: p.id, label: p.name }))
	);
	let patientValue = $state<string>(patientOptions[0]?.value ?? '');

	$effect(() => {
		if (openForm && patientOptions.length && !patientValue) {
			patientValue = patientOptions[0].value;
		}
	});

	function closeForm() {
		openForm = false;
		description = '';
		dueDate = data.today;
		patientValue = '';
	}

	function isOverdue(dueAt: number | Date | null): boolean {
		if (!dueAt) return false;
		const due = dueAt instanceof Date ? dueAt : new Date(dueAt);
		return due.getTime() < new Date().getTime();
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
		<Button size="sm" onclick={() => (openForm = true)}>Nuevo seguimiento</Button>
	</header>

	{#if form?.success && form.action === "create"}
		<div class="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
			{copy.messages.created}
		</div>
	{:else if form?.success && form.action === "recordContact"}
		<div class="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
			{copy.messages.contactRecorded}
		</div>
	{:else if form?.success && form.action === "complete"}
		<div class="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
			{copy.messages.completed}
		</div>
	{:else if form?.success && form.action === "cancel"}
		<div class="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
			{copy.messages.cancelled}
		</div>
	{/if}
	{#if form?.error}
		<div class="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">
			{form.error}
		</div>
	{/if}

	{#if openForm}
		<Card.Root>
			<Card.Header>
				<Card.Title>{copy.create.title}</Card.Title>
			</Card.Header>
			<Card.Content>
				<form method="POST" action="?/create" class="space-y-4" use:enhance>
					<div class="space-y-2">
						<Label for="description">{copy.create.descriptionLabel}</Label>
						<Input
							id="description"
							name="description"
							type="text"
							maxlength={200}
							placeholder={copy.create.descriptionPlaceholder}
							bind:value={description}
						/>
					</div>
					<div class="space-y-2">
						<Label for="dueDate">{copy.create.dueDateLabel}</Label>
						<Input
							id="dueDate"
							name="dueDate"
							type="date"
							bind:value={dueDate}
						/>
					</div>
					<div class="space-y-2">
						<Label for="patientId">{copy.create.patientLabel}</Label>
						{#if patientOptions.length === 0}
							<p class="text-muted-foreground text-sm">No hay pacientes registrados.</p>
						{:else}
							<select
								id="patientId"
								name="patientId"
								class="border-input bg-background focus-visible:border-ring focus-visible:ring-ring/50 h-9 w-full rounded-md border px-3 text-sm shadow-xs outline-none focus-visible:ring-3"
								bind:value={patientValue}
							>
								{#each patientOptions as option (option.value)}
									<option value={option.value}>{option.label}</option>
								{/each}
							</select>
						{/if}
					</div>
					<div class="flex items-center gap-2">
						<Button type="submit">{copy.create.submit}</Button>
						<Button type="button" variant="outline" onclick={closeForm}>Cancel</Button>
					</div>
				</form>
			</Card.Content>
		</Card.Root>
	{/if}

	<Card.Root>
		<Card.Header>
			<Card.Title>Seguimientos pendientes</Card.Title>
			{#if data.summary.overdue > 0}
				<Badge variant="destructive">{copy.summary.overdue(data.summary.overdue)}</Badge>
			{/if}
		</Card.Header>
		<Card.Content>
			{#if (data.tasks ?? []).length === 0}
				<p class="text-muted-foreground text-sm">{copy.list.emptyTitle}</p>
				<p class="text-muted-foreground mt-1 text-xs">{copy.list.emptyHint}</p>
			{:else}
				<ul class="divide-y">
					{#each data.tasks as task (task.id)}
						<li class="flex flex-col gap-3 py-3 first:pt-0 last:pb-0">
							<div class="flex items-center justify-between gap-4">
								<div class="min-w-0">
									<p class="text-sm font-medium truncate">{task.description}</p>
									<p class="text-muted-foreground text-xs">
										{formatDate(new Date(task.dueAt))}
										{#if isOverdue(task.dueAt)}
											· <span class="text-red-700">{copy.list.dueLabel} vencido</span>
										{/if}
									</p>
								</div>
								<div class="flex items-center gap-2">
									{#if isOverdue(task.dueAt)}
										<Badge variant="destructive">Vencido</Badge>
									{:else}
										<Badge variant="outline">{copy.list.dueLabel}</Badge>
									{/if}
								</div>
							</div>
							<div class="flex flex-wrap items-center gap-2">
								<form method="POST" action="?/recordContact" use:enhance class="flex items-center gap-2">
									<input type="hidden" name="followUpId" value={task.id} />
									<Label for={"contact-" + task.id} class="sr-only">{copy.list.contactDateLabel}</Label>
									<Input
										id={"contact-" + task.id}
										name="contactDate"
										type="date"
										class="w-40"
										value={contactDates[task.id] ?? data.today}
										oninput={(e) => (contactDates[task.id] = e.currentTarget.value)}
									/>
									<Button type="submit" size="sm" variant="outline">{copy.list.recordContact}</Button>
								</form>
								<form method="POST" action="?/complete" use:enhance class="inline">
									<input type="hidden" name="followUpId" value={task.id} />
									<Button type="submit" size="sm">{copy.list.complete}</Button>
								</form>
								<form method="POST" action="?/cancel" use:enhance class="inline">
									<input type="hidden" name="followUpId" value={task.id} />
									<Button type="submit" size="sm" variant="ghost">{copy.list.cancel}</Button>
								</form>
							</div>
						</li>
					{/each}
				</ul>
			{/if}
		</Card.Content>
	</Card.Root>
</div>
