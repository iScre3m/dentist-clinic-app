declare global {
	namespace App {
		interface Locals {
			session: {
				session: { id: string };
				user: { id: string; name: string; email: string };
			} | null;
		}
	}
}

export {};
