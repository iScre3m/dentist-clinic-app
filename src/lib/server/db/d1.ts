import { drizzle } from 'drizzle-orm/d1';
import * as schema from './schema';

export function createD1Database(database: D1Database) {
	return drizzle(database, { schema });
}