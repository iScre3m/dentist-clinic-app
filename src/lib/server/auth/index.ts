import bcrypt from 'bcryptjs';
import { createToken, verifyToken, isTokenExpired } from './jwt';
import { validateAuthEnv } from './env-schema';
import { setAuthCookie, clearAuthCookie, getAuthCookie } from './cookies';
import type { JwtPayload } from './jwt';

export { createToken, verifyToken, isTokenExpired };
export { setAuthCookie, clearAuthCookie, getAuthCookie };
export { validateAuthEnv };
export type { JwtPayload };

export interface Session {
	user: {
		id: string;
		username: string;
		role: 'staff';
	};
	expiresAt: Date;
}

export async function authenticate(
	username: string,
	password: string,
	env: Record<string, string | undefined>
): Promise<string> {
	const authEnv = validateAuthEnv(env);

	if (username !== authEnv.AUTH_USERNAME) {
		throw new Error('Correo o contraseña incorrectos.');
	}

	const isValid = await bcrypt.compare(password, authEnv.AUTH_PASSWORD_HASH);
	if (!isValid) {
		throw new Error('Correo o contraseña incorrectos.');
	}

	return createToken(username, authEnv.AUTH_SECRET);
}

export function handleJwtSession(cookieHeader: string | null, secret: string): Session | null {
	const token = getAuthCookie(cookieHeader);

	if (!token) {
		return null;
	}

	const payload = verifyToken(token, secret);
	if (!payload) {
		return null;
	}

	return {
		user: {
			id: payload.sub,
			username: payload.username,
			role: payload.role
		},
		expiresAt: new Date(payload.exp * 1000)
	};
}
