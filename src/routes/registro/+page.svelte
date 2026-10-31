<script lang="ts">
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

<main class="flex min-h-screen justify-center bg-slate-50 px-6 py-10 text-slate-900">
	<div class="w-full max-w-lg">
		<p class="text-sm font-semibold text-slate-500">Consultorio</p>
		<h1 class="mt-1 text-xl font-semibold">Registrate para recibir recordatorios</h1>
		<p class="mt-2 text-sm text-slate-600">
			Dejanos tu nombre y tu número de WhatsApp. Lo usamos solo para recordarte tus turnos y
			avisarte de cambios de horario.
		</p>

		{#if form?.success}
			<div class="mt-8 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-5" role="status">
				<p class="text-sm font-medium text-emerald-900">{form.message}</p>
				<p class="mt-1 text-sm text-emerald-800">
					Si tu número ya estaba registrado, actualizamos tus datos. No hace falta registrarte otra
					vez.
				</p>
			</div>
			<a href="/registro" class="mt-6 inline-block text-sm text-slate-600 hover:text-slate-900">
				Registrar otro número
			</a>
		{:else}
			<form method="POST" action="?/register" class="mt-8 space-y-4">
				<div>
					<label for="name" class="mb-1 block text-sm font-medium text-slate-700">
						Nombre y apellido
					</label>
					<input
						id="name"
						name="name"
						type="text"
						required
						maxlength="80"
						autocomplete="name"
						value={form?.values?.name ?? ''}
						class="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-slate-500"
					/>
				</div>

				<div>
					<label for="country" class="mb-1 block text-sm font-medium text-slate-700">País</label>
					<select
						id="country"
						name="country"
						class="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-slate-500"
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

				<div>
					<label for="phone" class="mb-1 block text-sm font-medium text-slate-700">
						Número de WhatsApp
					</label>
					<input
						id="phone"
						name="phone"
						type="tel"
						inputmode="tel"
						required
						maxlength="30"
						autocomplete="tel"
						placeholder="11 5555 0001"
						aria-describedby="phone-hint"
						value={form?.values?.phone ?? ''}
						class="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-slate-500"
					/>
					<p id="phone-hint" class="mt-1 text-xs text-slate-500">
						Escribilo sin el 0 inicial y sin el código de país. Tiene que ser un celular.
					</p>
				</div>

				<div class="rounded-md border border-slate-200 bg-white px-3 py-3">
					<div class="flex items-start gap-2">
						<input
							id="consent"
							name="consent"
							type="checkbox"
							required
							class="mt-0.5 h-4 w-4 rounded border-slate-300"
						/>
						<label for="consent" class="text-sm text-slate-700">
							Acepto recibir recordatorios de turnos y avisos administrativos por WhatsApp.
						</label>
					</div>

					<details class="mt-3 text-sm">
						<summary class="cursor-pointer text-slate-600">
							Leer el texto del consentimiento (versión {data.consentVersion})
						</summary>
						<div class="mt-3 space-y-3 text-slate-600">
							{#each consentBlocks as block}
								{#if block.kind === 'list'}
									<ul class="list-disc space-y-1 pl-5">
										{#each block.items as item}
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
					<p class="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
						{form.message}
					</p>
				{/if}

				<button
					type="submit"
					class="w-full rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800"
				>
					Registrarme
				</button>
			</form>
		{/if}

		<p class="mt-8 text-xs text-slate-500">
			Este formulario es solo para pacientes. El personal del consultorio ingresa por otro acceso.
		</p>
	</div>
</main>
