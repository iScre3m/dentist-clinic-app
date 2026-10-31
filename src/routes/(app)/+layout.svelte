<script lang="ts">
	import { goto } from '$app/navigation';
	import { authClient } from '#lib/auth-client.ts';
	import type { Snippet } from 'svelte';
	import type { LayoutData } from './$types';

	let { data, children }: { data: LayoutData; children: Snippet } = $props();

	async function signOut() {
		await authClient.signOut();
		await goto('/login');
	}
</script>

<div class="min-h-screen bg-slate-50 text-slate-900">
	<header class="border-b border-slate-200 bg-white">
		<div class="mx-auto flex max-w-5xl items-center justify-between px-6 py-3">
			<div class="flex items-center gap-6">
				<span class="text-sm font-semibold">Consultorio</span>
				<nav class="flex gap-4 text-sm text-slate-600">
					<a href="/dashboard" class="hover:text-slate-900">Panel</a>
				</nav>
			</div>
			<div class="flex items-center gap-3 text-sm">
				<span class="text-slate-600">{data.user.name}</span>
				<button type="button" onclick={signOut} class="text-slate-600 hover:text-slate-900">
					Salir
				</button>
			</div>
		</div>
	</header>

	<main class="mx-auto max-w-5xl px-6 py-8">
		{@render children()}
	</main>
</div>
