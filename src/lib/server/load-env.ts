import { existsSync } from 'node:fs';

const ENV_FILE = '.env';

/**
 * SvelteKit exposes configuration through `$env/*`, but does not copy `.env`
 * into `process.env`. Server modules and the CLI scripts (seed, prune,
 * staff:update) both read `process.env`, so the file is loaded here once, as
 * early as possible. Variables already present in the environment win.
 */
if (existsSync(ENV_FILE)) {
	process.loadEnvFile(ENV_FILE);
}
