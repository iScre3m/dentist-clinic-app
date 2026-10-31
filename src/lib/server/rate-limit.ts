type Window = { count: number; resetAt: number };

/**
 * Per-process fixed-window limiter. The MVP runs as a single Node process on
 * one host, so in-memory state is enough; it resets on restart.
 */
const windows = new Map<string, Window>();

const MAX_TRACKED_KEYS = 5000;

export function checkRateLimit(key: string, limit: number, windowMs: number): boolean {
	const now = Date.now();

	if (windows.size > MAX_TRACKED_KEYS) {
		for (const [tracked, window] of windows) {
			if (window.resetAt <= now) windows.delete(tracked);
		}
	}

	const current = windows.get(key);
	if (!current || current.resetAt <= now) {
		windows.set(key, { count: 1, resetAt: now + windowMs });
		return true;
	}

	if (current.count >= limit) return false;

	current.count += 1;
	return true;
}
