/**
 * Simple in-memory rate limiter for the login endpoint.
 *
 * Tracks failed login attempts per client key (IP) within a sliding one-minute
 * window. Returns 429 when more than 5 failures occur in that window.
 *
 * In-memory state is per-isolate, which is sufficient for the single-staff MVP
 * running on one Cloudflare Worker isolate. No external dependency is added.
 */

const MAX_ATTEMPTS = 5;
const WINDOW_MS = 60 * 1000;

type Attempt = { time: number };

const attempts = new Map<string, Attempt[]>();

function clientKey(request: Request): string {
	const forwarded = request.headers.get('x-forwarded-for');
	if (forwarded) {
		return forwarded.split(',')[0].trim();
	}
	const cfIp = request.headers.get('cf-connecting-ip');
	if (cfIp) {
		return cfIp;
	}
	return 'unknown';
}

function prune(key: string, now: number): void {
	const list = attempts.get(key);
	if (!list) {
		return;
	}
	const filtered = list.filter((a) => now - a.time < WINDOW_MS);
	if (filtered.length === 0) {
		attempts.delete(key);
	} else {
		attempts.set(key, filtered);
	}
}

/** Record a failed attempt for the client and return whether the limit is now exceeded. */
export function recordFailedAttempt(request: Request): boolean {
	const now = Date.now();
	const key = clientKey(request);
	prune(key, now);

	const list = attempts.get(key) ?? [];
	list.push({ time: now });
	attempts.set(key, list);

	return list.length > MAX_ATTEMPTS;
}

/** Clear the failure window for a client (called on successful login). */
export function clearAttempts(request: Request): void {
	const key = clientKey(request);
	attempts.delete(key);
}

export { MAX_ATTEMPTS, WINDOW_MS };
