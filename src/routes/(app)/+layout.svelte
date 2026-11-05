<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { Button } from '#lib/components/ui/button/index.ts';
	import type { Snippet } from 'svelte';
	import type { LayoutData } from './$types';

	let { data, children }: { data: LayoutData; children: Snippet } = $props();
	let menuOpen = $state(false);

	async function signOut() {
		await fetch('/api/logout', { method: 'POST' });
		await goto(resolve('/login'));
	}
</script>

<div class="bg-muted text-foreground min-h-screen">
	<header class="bg-background border-b">
		<div class="mx-auto flex max-w-5xl items-center justify-between px-4 py-3 sm:px-6">
			<div class="flex items-center gap-6">
				<span class="text-sm font-semibold">Consultorio</span>
				<nav class="text-muted-foreground hidden gap-4 text-sm md:flex">
					<a href={resolve('/(app)/dashboard')} class="hover:text-foreground">Panel</a>
					<a href={resolve('/(app)/pacientes')} class="hover:text-foreground">Pacientes</a>
					<a href={resolve('/(app)/follow-ups')} class="hover:text-foreground">Seguimientos</a>
					<a href={resolve('/(app)/precios')} class="hover:text-foreground">Prácticas</a>
					<a href={resolve('/(app)/facturas')} class="hover:text-foreground">Facturas</a>
				</nav>
			</div>
			<div class="flex items-center gap-3 text-sm">
				<span class="text-muted-foreground hidden sm:inline">{data.user.username}</span>

				<Button variant="ghost" size="sm" onclick={signOut}>Salir</Button>
				<Button variant="ghost" size="sm" class="md:hidden" onclick={() => (menuOpen = !menuOpen)} aria-label="Menú">
					☰
				</Button>
			</div>
		</div>
		{#if menuOpen}
			<nav class="text-muted-foreground flex flex-col gap-2 border-t px-4 py-3 text-sm md:hidden">
				<a href={resolve('/(app)/dashboard')} class="hover:text-foreground" onclick={() => (menuOpen = false)}>Panel</a>
				<a href={resolve('/(app)/pacientes')} class="hover:text-foreground" onclick={() => (menuOpen = false)}>Pacientes</a>
				<a href={resolve('/(app)/follow-ups')} class="hover:text-foreground" onclick={() => (menuOpen = false)}>Seguimientos</a>
				<a href={resolve('/(app)/precios')} class="hover:text-foreground" onclick={() => (menuOpen = false)}>Prácticas</a>
				<a href={resolve('/(app)/facturas')} class="hover:text-foreground" onclick={() => (menuOpen = false)}>Facturas</a>
			</nav>
		{/if}
	</header>

	<main class="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-8">
		{@render children()}
	</main>
</div>
