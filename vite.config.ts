import adapter from '@sveltejs/adapter-node';
import { sveltekit } from '@sveltejs/kit/vite';
import tailwindcss from '@tailwindcss/vite';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [
		tailwindcss(),
		sveltekit({
			adapter: adapter(),
			preprocess: vitePreprocess()
		})
	],
	server: {
		// Docker Desktop bind mounts (Windows/macOS) do not deliver filesystem
		// events into the container, so the dev server has to poll for changes.
		// Enabled only inside the dev container via VITE_USE_POLLING=1.
		watch:
			process.env.VITE_USE_POLLING === '1'
				? {
						usePolling: true,
						interval: 300,
						ignored: [
							'**/node_modules/**',
							'**/.svelte-kit/**',
							'**/build/**',
							// SQLite writes on registration must not trigger a reload.
							'**/data/**',
							'**/*.db',
							'**/*.db-*'
						]
					}
				: undefined
	}
});
