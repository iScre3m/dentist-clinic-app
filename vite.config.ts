import adapter from '@sveltejs/adapter-cloudflare';
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
		watch: {
			// Miniflare writes D1/local-runtime state (sqlite-wal/shm) while the app
			// runs; re-evaluating the SSR program mid-request makes in-flight
			// requests 500. Ignore it in every mode, not just the polling one.
			ignored: [
				'**/.wrangler/**',
				// SQLite writes on registration must not trigger a reload.
				'**/data/**',
				'**/*.db',
				'**/*.db-*',
				// Test artifacts written while the e2e web server is running.
				'**/playwright-report/**',
				'**/test-results/**'
			],
			// Docker Desktop bind mounts (Windows/macOS) do not deliver filesystem
			// events into the container, so the dev server has to poll for changes.
			// Enabled only inside the dev container via VITE_USE_POLLING=1.
			usePolling: process.env.VITE_USE_POLLING === '1' ? true : undefined,
			interval: process.env.VITE_USE_POLLING === '1' ? 300 : undefined
		}
	}
});
