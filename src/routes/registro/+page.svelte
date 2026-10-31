<script lang="ts">
	import { resolve } from '$app/paths';
	import { Alert, AlertDescription, AlertTitle } from '#lib/components/ui/alert/index.ts';
	import { Button } from '#lib/components/ui/button/index.ts';
	import * as Card from '#lib/components/ui/card/index.ts';
	import Input from '#lib/components/ui/input/input.svelte';
	import Label from '#lib/components/ui/label/label.svelte';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	const consentBlocks = $derived(
		data.consentText.split(/\n{2,}/).map((block) => {
			const lines = block.split('\n').map((line) => line.trim());
			return lines[0].startsWith('-')
				? { kind: 'list' as const, items: lines.map((line) => line.replace(/^-\s*/, '')) }
				: { kind: 'paragraph' as const, text: lines.join(' ') };
		})
	);
</script>

<svelte:head>
	<title>Registro de pacientes · Consultorio</title>
	<meta name="robots" content="noindex" />
</svelte:head>

<main class="bg-muted/40 flex min-h-screen justify-center px-6 py-10">
	<div class="w-full max-w-lg space-y-6">
		<header>
			<p class="text-muted-foreground text-sm font-semibold">Consultorio</p>
			<h1 class="mt-1 text-xl font-semibold">Registrate para recibir recordatorios</h1>
			<p class="text-muted-foreground mt-2 text-sm">
				Dejanos tu nombre y tu número de WhatsApp. Lo usamos solo para recordarte tus turnos y
				avisarte de cambios de horario.
			</p>
		</header>

		{#if form?.success}
			<Card.Root>
				<Card.Content class="space-y-4">
					<Alert>
						<AlertTitle>{form.message}</AlertTitle>
						<AlertDescription>
							Si tu número ya estaba registrado, actualizamos tus datos. No hace falta registrarte
							otra vez.
						</AlertDescription>
					</Alert>
					<Button variant="outline" href={resolve('/registro')}>Registrar otro número</Button>
				</Card.Content>
			</Card.Root>
		{:else}
			<Card.Root>
				<Card.Content>
					<form method="POST" action="?/register" class="space-y-4">
						<div class="space-y-2">
							<Label for="name">Nombre y apellido</Label>
							<Input
								id="name"
								name="name"
								type="text"
								required
								maxlength={80}
								autocomplete="name"
								value={form?.values?.name ?? ''}
							/>
						</div>

						<div class="space-y-2">
							<Label for="country">País</Label>
							<select
								id="country"
								name="country"
								class="border-input bg-background focus-visible:border-ring focus-visible:ring-ring/50 h-9 w-full rounded-md border px-3 text-sm shadow-xs outline-none focus-visible:ring-3"
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
								value={form?.values?.phone ?? ''}
							/>
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
								/>
								<Label for="consent" class="text-sm leading-snug font-normal">
									Acepto recibir recordatorios de turnos y avisos administrativos por WhatsApp.
								</Label>
							</div>

							<details class="mt-3 text-sm">
								<summary class="text-muted-foreground cursor-pointer">
									Leer el texto del consentimiento (versión {data.consentVersion})
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

						{#if form?.message}
							<Alert variant="destructive">
								<AlertDescription>{form.message}</AlertDescription>
							</Alert>
						{/if}

						<Button type="submit" class="w-full">Registrarme</Button>
					</form>
				</Card.Content>
			</Card.Root>
		{/if}

		<p class="text-muted-foreground text-xs">
			Este formulario es solo para pacientes. El personal del consultorio ingresa por otro acceso.
		</p>
	</div>
</main>
