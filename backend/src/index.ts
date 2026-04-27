import Fastify from 'fastify';
import cors from '@fastify/cors';
import { PrismaClient } from '../generated/client/client.js';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import "dotenv/config";
import { deploymentRoutes } from './routes/deployments.js';
import { logRoutes } from './routes/logs.js';
import { EventEmitter } from 'events';

const connectionString = process.env.DATABASE_URL!;
const adapter = new PrismaBetterSqlite3({ url: connectionString });
export const prisma = new PrismaClient({ adapter });
export const logEvents = new EventEmitter();

const fastify = Fastify({
    logger: true,
});

async function bootstrap() {
    await fastify.register(cors, {
        origin: true,
    });

    await fastify.get('/', async () => {
        return { status: 'healthy', service: 'Brimble API' };
    });

    await fastify.register(deploymentRoutes);
    await fastify.register(logRoutes);

    try {
        await fastify.listen({ port: 3001, host: '0.0.0.0' });
        console.log('Server is running on http://localhost:3001');
    } catch (err) {
        fastify.log.error(err);
        process.exit(1);
    }
}

bootstrap();
