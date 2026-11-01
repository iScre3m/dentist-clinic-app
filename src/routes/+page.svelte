<script lang="ts">
	import { resolve } from '$app/paths';
	import { enhance } from '$app/forms';
	import { Button } from '#lib/components/ui/button/index.ts';
	import * as Card from '#lib/components/ui/card/index.ts';
	import Input from '#lib/components/ui/input/input.svelte';
	import Label from '#lib/components/ui/label/label.svelte';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	let firstName = $state('');
	let lastName = $state('');
	let phone = $state('');
	let submitted = $state(false);

	$effect(() => {
		const values = form?.values;
		if (values) {
			firstName = values.firstName ?? '';
			lastName = values.lastName ?? '';
			phone = values.phone ?? '';
		}
	});

	const consentBlocks = $derived(
		data.consentText.split(/\n{2,}/).map((block) => {
			const lines = block.split('\n').map((line) => line.trim());
			if (lines[0].startsWith('-')) {
				const items: string[] = [];
				for (const line of lines) {
					if (line.startsWith('-')) {
						items.push(line.replace(/^-\s*/, ''));
					} else if (line && items.length > 0) {
						items[items.length - 1] += ' ' + line;
					}
				}
				return { kind: 'list' as const, items };
			}
			return { kind: 'paragraph' as const, text: lines.join(' ') };
		})
	);
</script>

<svelte:head>
	<title>Registro de pacientes · Consultorio</title>
	<meta name="robots" content="noindex" />
</svelte:head>

<main
	class="bg-muted/40 flex min-h-screen flex-col items-center justify-center px-6 py-10"
	style="background-image: url('/imagen-1.jpg'); background-size: cover; background-position: center;"
>
	<div class="w-full max-w-lg space-y-6">
		<header class="bg-card/90 text-card-foreground rounded-lg border p-4">
			<p class="text-muted-foreground text-sm font-semibold">Consultorio Dr. Laura</p>
			<h1 class="mt-1 text-xl font-semibold">Registrate para recibir recordatorios</h1>
			<p class="text-muted-foreground mt-2 text-sm">
				Dejanos tu nombre y tu número de WhatsApp. Lo usamos solo para recordarte tus turnos y
				avisarte de cambios de horario.
			</p>
		</header>

		<Card.Root>
			<Card.Content>
				<form
					method="POST"
					action="?/register"
					class="space-y-4"
					onsubmit={() => (submitted = true)}
					use:enhance
				>
					<div class="space-y-2">
						<Label for="firstName">Nombre</Label>
						<Input
							id="firstName"
							name="firstName"
							type="text"
							required
							maxlength={80}
							autocomplete="given-name"
							bind:value={firstName}
							disabled={form?.success}
						/>
						{#if submitted && !form?.success && !firstName.trim()}
							<p id="firstName-error" class="text-red-600 text-xs mt-1">Campo obligatorio.</p>
						{:else if firstName && !/^[\p{L}'-]+(?:\s[\p{L}'-]+)*$/u.test(firstName)}
							<p id="firstName-error" class="text-red-600 text-xs mt-1">
								Solo letras, espacios y apóstrofos.
							</p>
						{/if}
					</div>

					<div class="space-y-2">
						<Label for="lastName">Apellido</Label>
						<Input
							id="lastName"
							name="lastName"
							type="text"
							required
							maxlength={80}
							autocomplete="family-name"
							bind:value={lastName}
							disabled={form?.success}
						/>
						{#if submitted && !form?.success && !lastName.trim()}
							<p id="lastName-error" class="text-red-600 text-xs mt-1">Campo obligatorio.</p>
						{:else if lastName && !/^[\p{L}'-]+(?:\s[\p{L}'-]+)*$/u.test(lastName)}
							<p id="lastName-error" class="text-red-600 text-xs mt-1">
								Solo letras, espacios y apóstrofos.
							</p>
						{/if}
					</div>

					<div class="space-y-2">
						<Label for="country">País</Label>
						<select
							id="country"
							name="country"
							class="border-input bg-background focus-visible:border-ring focus-visible:ring-ring/50 h-9 w-full rounded-md border px-3 text-sm shadow-xs outline-none focus-visible:ring-3"
							disabled={form?.success}
						>
							{#each data.countries as country (country.code)}
								<option
									value={country.code}
									selected={country.code === (form?.values?.country ?? data.defaultCountry)}
								>
									{country.name}
								</option>
							{/each}
						</select>
					</div>

					<div class="space-y-2">
						<Label for="phone">Número de WhatsApp</Label>
						<Input
							id="phone"
							name="phone"
							type="tel"
							inputmode="tel"
							required
							maxlength={30}
							autocomplete="tel"
							placeholder="11 5555 0001"
							aria-describedby="phone-hint"
							bind:value={phone}
							oninput={(e) => (phone = e.currentTarget.value.replace(/[^\d]/g, ''))}
							disabled={form?.success}
						/>
						{#if /[^\d]/.test(phone)}
							<p id="phone-error" class="text-red-600 text-xs mt-1">Solo números.</p>
						{:else if submitted && !form?.success && !phone.trim()}
							<p id="phone-error" class="text-red-600 text-xs mt-1">Campo obligatorio.</p>
						{/if}
						<p id="phone-hint" class="text-muted-foreground text-xs">
							Escribilo sin el 0 inicial y sin el código de país. Tiene que ser un celular.
						</p>
					</div>

					<div class="rounded-md border px-3 py-3">
						<div class="flex items-start gap-2">
							<input
								id="consent"
								name="consent"
								type="checkbox"
								required
								class="border-input accent-primary mt-0.5 size-4 rounded border"
								disabled={form?.success}
							/>
							<Label for="consent" class="text-sm leading-snug font-normal">
								Acepto recibir recordatorios de turnos y avisos administrativos por WhatsApp.
							</Label>
						</div>

						<details class="mt-3 text-sm">
							<summary class="text-muted-foreground cursor-pointer">
								Leer texto de consentimiento
							</summary>
							<div class="text-muted-foreground mt-3 space-y-3">
								{#each consentBlocks as block, index (index)}
									{#if block.kind === 'list'}
										<ul class="list-disc space-y-1 pl-5">
											{#each block.items as item, itemIndex (itemIndex)}
												<li>{item}</li>
											{/each}
										</ul>
									{:else}
										<p>{block.text}</p>
									{/if}
								{/each}
							</div>
						</details>
					</div>

					<Button type="submit" class="w-full" disabled={form?.success}>
						{form?.success ? 'Listo. Recibimos tu registro.' : 'Registrarme'}
					</Button>
				</form>
			</Card.Content>
		</Card.Root>

		<p class="bg-card/90 text-card-foreground rounded-lg border p-3 text-xs">
			Este formulario es solo para pacientes. El personal del consultorio ingresa por otro
			<a href={resolve('/login')} class="underline">acceso</a>.
		</p>
	</div>

	<footer class="w-full max-w-lg mt-8">
		<div class="bg-card text-card-foreground rounded-lg border p-4 space-y-2 text-sm">
			<div class="flex items-center gap-2">
				<svg
					xmlns="http://www.w3.org/2000/svg"
					class="size-4"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
					stroke-linecap="round"
					stroke-linejoin="round"
					><rect width="20" height="16" x="2" y="4" rx="2" /><path
						d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"
					/></svg
				>
				<span>Dr.Laura@example.com</span>
			</div>
			<div class="flex items-center gap-2">
				<svg
					xmlns="http://www.w3.org/2000/svg"
					class="size-4"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
					stroke-linecap="round"
					stroke-linejoin="round"
					><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" /><circle
						cx="12"
						cy="10"
						r="3"
					/></svg
				>
				<span>Mendoza 3030 1° A</span>
			</div>
			<div class="flex items-center gap-2">
				<svg
					xmlns="http://www.w3.org/2000/svg"
					class="size-4"
					viewBox="0 0 24 24"
					fill="currentColor"
					><path
						d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z"
					/></svg
				>
				<span>WhatsApp +54 9 11 1111 1111</span>
			</div>
		</div>
	</footer>
</main>
