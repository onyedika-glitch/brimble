import { FastifyInstance } from 'fastify';
import { logEvents } from '../index.js';

export async function logRoutes(fastify: FastifyInstance) {
    fastify.get('/deployments/:id/logs/stream', async (request, reply) => {
        const { id } = request.params as { id: string };

        reply.raw.setHeader('Content-Type', 'text/event-stream');
        reply.raw.setHeader('Cache-Control', 'no-cache');
        reply.raw.setHeader('Connection', 'keep-alive');

        const listener = (message: string) => {
            reply.raw.write(`data: ${JSON.stringify({ message })}\n\n`);
        };

        logEvents.on(`logs-${id}`, listener);

        request.raw.on('close', () => {
            logEvents.off(`logs-${id}`, listener);
        });
    });
}
