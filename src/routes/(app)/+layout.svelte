<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { authClient } from '#lib/auth-client.ts';
	import { Button } from '#lib/components/ui/button/index.ts';
	import type { Snippet } from 'svelte';
	import type { LayoutData } from './$types';

	let { data, children }: { data: LayoutData; children: Snippet } = $props();

	async function signOut() {
		await authClient.signOut();
		await goto(resolve('/login'));
	}
</script>

<div class="bg-muted text-foreground min-h-screen">
	<header class="bg-background border-b">
		<div class="mx-auto flex max-w-5xl items-center justify-between px-6 py-3">
			<div class="flex items-center gap-6">
				<span class="text-sm font-semibold">Consultorio</span>
				<nav class="text-muted-foreground flex gap-4 text-sm">
					<a href={resolve('/(app)/dashboard')} class="hover:text-foreground">Panel</a>
					<a href={resolve('/(app)/pacientes')} class="hover:text-foreground">Pacientes</a>
				</nav>
			</div>
			<div class="flex items-center gap-3 text-sm">
				<span class="text-muted-foreground">{data.user.name}</span>
				<Button variant="ghost" size="sm" onclick={signOut}>Salir</Button>
			</div>
		</div>
	</header>

	<main class="mx-auto max-w-5xl px-6 py-8">
		{@render children()}
	</main>
</div>
