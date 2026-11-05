export function setAuthCookie(response: Response, token: string) {
	const isProduction = process.env.NODE_ENV === 'production';
	const maxAge = 60 * 60 * 24 * 7; // 7 days in seconds

	let cookieValue = `auth_token=${token}; Path=/; HttpOnly; Max-Age=${maxAge}; SameSite=Lax`;
	if (isProduction) {
		cookieValue += '; Secure';
	}

	response.headers.append('Set-Cookie', cookieValue);
}

export function clearAuthCookie(response: Response) {
	response.headers.append(
		'Set-Cookie',
		'auth_token=; Path=/; HttpOnly; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax'
	);
}

export function getAuthCookie(cookies: string | null): string | null {
	if (!cookies) {
		return null;
	}
	const match = cookies.match(/auth_token=([^;]+)/);
	return match ? match[1] : null;
}
