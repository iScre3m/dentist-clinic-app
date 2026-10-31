<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { authClient } from '#lib/auth-client.ts';
	import { Alert, AlertDescription } from '#lib/components/ui/alert/index.ts';
	import { Button } from '#lib/components/ui/button/index.ts';
	import * as Card from '#lib/components/ui/card/index.ts';
	import Input from '#lib/components/ui/input/input.svelte';
	import Label from '#lib/components/ui/label/label.svelte';

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

		await goto(resolve('/(app)/dashboard'));
	}
</script>

<svelte:head>
	<title>Ingresar · Consultorio</title>
</svelte:head>

<main class="bg-muted/40 flex min-h-screen items-center justify-center px-6 py-12">
	<Card.Root class="w-full max-w-sm">
		<Card.Header>
			<Card.Title>Consultorio</Card.Title>
			<Card.Description>Acceso para el personal del consultorio.</Card.Description>
		</Card.Header>

		<Card.Content>
			<form class="space-y-4" onsubmit={handleSubmit}>
				<div class="space-y-2">
					<Label for="email">Correo</Label>
					<Input
						id="email"
						name="email"
						type="email"
						autocomplete="username"
						required
						bind:value={email}
					/>
				</div>

				<div class="space-y-2">
					<Label for="password">Contraseña</Label>
					<Input
						id="password"
						name="password"
						type="password"
						autocomplete="current-password"
						required
						bind:value={password}
					/>
				</div>

				{#if error}
					<Alert variant="destructive">
						<AlertDescription>{error}</AlertDescription>
					</Alert>
				{/if}

				<Button type="submit" class="w-full" disabled={pending}>
					{pending ? 'Ingresando…' : 'Ingresar'}
				</Button>
			</form>
		</Card.Content>
	</Card.Root>
</main>
