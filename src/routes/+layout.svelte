<script lang="ts">
	import '../app.css';
	import { onMount } from 'svelte';

	let { children } = $props();

	// Runs after the whole tree has hydrated. Playwright waits for this marker
	// before interacting, so a click never hits a not-yet-interactive form.
	onMount(() => {
		document.documentElement.dataset.hydrated = 'true';
	});
</script>

{@render children()}
