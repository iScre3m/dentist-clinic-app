import jwt from 'jsonwebtoken';

const JWT_EXPIRY = 60 * 60 * 24 * 7; // 7 days in seconds

export interface JwtPayload {
	sub: string; // Subject: "staff"
	username: string; // Staff username
	role: 'staff'; // Fixed role
	iat: number; // Issued at
	exp: number; // Expiration
}

export function createToken(username: string, secret: string): string {
	const now = Math.floor(Date.now() / 1000);
	const payload: JwtPayload = {
		sub: 'staff',
		username,
		role: 'staff',
		iat: now,
		exp: now + JWT_EXPIRY
	};

	return jwt.sign(payload, secret, { algorithm: 'HS256' });
}

export function verifyToken(token: string, secret: string): JwtPayload | null {
	try {
		const decoded = jwt.verify(token, secret, { algorithms: ['HS256'] }) as JwtPayload;
		return decoded;
	} catch {
		return null;
	}
}

export function isTokenExpired(payload: JwtPayload): boolean {
	const now = Math.floor(Date.now() / 1000);
	return payload.exp < now;
}
