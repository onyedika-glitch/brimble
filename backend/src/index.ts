import Fastify from 'fastify';
import cors from '@fastify/cors';
import { PrismaClient } from '../generated/client/client.js';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import "dotenv/config";
import { deploymentRoutes } from './routes/deployments.js';
import { logRoutes } from './routes/logs.js';
import { authRoutes } from './routes/auth.js';
import { teamRoutes } from './routes/teams.js';
import { EventEmitter } from 'events';
import { cronRunner } from './services/cron.service.js';

const connectionString = process.env.DATABASE_URL!;
const adapter = new PrismaBetterSqlite3({ url: connectionString });
export const prisma = new PrismaClient({ adapter });
export const logEvents = new EventEmitter();

const fastify = Fastify({ logger: true });

async function bootstrap() {
    await fastify.register(cors, { origin: true });

    fastify.get('/', async () => ({ status: 'healthy', service: 'Rimble API v2' }));

    // Register all route modules
    await fastify.register(authRoutes, { prefix: '/api' });
    await fastify.register(teamRoutes, { prefix: '/api' });
    await fastify.register(deploymentRoutes, { prefix: '/api' });
    await fastify.register(logRoutes, { prefix: '/api' });

    try {
        await fastify.listen({ port: 3001, host: '0.0.0.0' });
        console.log('✅ Rimble API running on http://localhost:3001');

        // Load and start cron jobs on boot
        await cronRunner.loadAndScheduleAll();
    } catch (err) {
        fastify.log.error(err);
        process.exit(1);
    }
}

bootstrap();
