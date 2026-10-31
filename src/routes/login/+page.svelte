<script lang="ts">
	import { goto } from '$app/navigation';
	import { authClient } from '#lib/auth-client.ts';

	let email = $state('');
	let password = $state('');
	let error = $state<string | null>(null);
	let pending = $state(false);

	async function handleSubmit(event: SubmitEvent) {
		event.preventDefault();
		pending = true;
		error = null;

		const { error: signInError } = await authClient.signIn.email({ email, password });
		pending = false;

		if (signInError) {
			error = 'Correo o contraseña incorrectos.';
			return;
		}

		await goto('/dashboard');
	}
</script>

<svelte:head>
	<title>Ingresar · Consultorio</title>
</svelte:head>

<main class="flex min-h-screen items-center justify-center bg-slate-50 px-6 py-12">
	<div class="w-full max-w-sm">
		<h1 class="mb-1 text-xl font-semibold text-slate-900">Consultorio</h1>
		<p class="mb-8 text-sm text-slate-600">Acceso para el personal del consultorio.</p>

		<form class="space-y-4" onsubmit={handleSubmit}>
			<div>
				<label for="email" class="mb-1 block text-sm font-medium text-slate-700">Correo</label>
				<input
					id="email"
					name="email"
					type="email"
					autocomplete="username"
					required
					bind:value={email}
					class="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-slate-500"
				/>
			</div>

			<div>
				<label for="password" class="mb-1 block text-sm font-medium text-slate-700">
					Contraseña
				</label>
				<input
					id="password"
					name="password"
					type="password"
					autocomplete="current-password"
					required
					bind:value={password}
					class="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-slate-500"
				/>
			</div>

			{#if error}
				<p class="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">{error}</p>
			{/if}

			<button
				type="submit"
				disabled={pending}
				class="w-full rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
			>
				{pending ? 'Ingresando…' : 'Ingresar'}
			</button>
		</form>
	</div>
</main>
