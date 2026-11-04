import { json, error } from '@sveltejs/kit';
import { env } from 'node:process';
import Nylas from 'nylas';
import type { RequestHandler } from './$types';

const NYLAS_API_KEY = env.NYLAS_API_KEY!;
const NYLAS_GRANT_ID = env.NYLAS_GRANT_ID!;

const nylas = new Nylas({
    apiKey: NYLAS_API_KEY
});

export const GET: RequestHandler = async () => {
    try {

        const { data: events } = await nylas.events.list({
            identifier: NYLAS_GRANT_ID,
            queryParams: {
                calendarId: 'primary',
                limit: 5,

            }
        });

        return json(events);
    } catch (err) {
        console.error('Nylas calendar error:', err);
        throw error(502, 'Unable to retrieve calendar events');
    }
};