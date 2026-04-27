import { FastifyInstance } from 'fastify';
import { prisma } from '../index.js';
import { DeploymentService } from '../services/deployment.service.js';
import { z } from 'zod';

const deploymentService = new DeploymentService();

export async function deploymentRoutes(fastify: FastifyInstance) {
    fastify.get('/deployments', async () => {
        return prisma.deployment.findMany({
            orderBy: { createdAt: 'desc' },
            include: { logs: { take: 1, orderBy: { createdAt: 'desc' } } }
        });
    });

    fastify.post('/deployments', async (request, reply) => {
        const schema = z.object({
            gitUrl: z.string().url()
        });

        const body = schema.parse(request.body);
        const deployment = await deploymentService.createDeployment(body.gitUrl);

        return deployment;
    });

    fastify.get('/deployments/:id', async (request, reply) => {
        const { id } = request.params as { id: string };
        const deployment = await prisma.deployment.findUnique({
            where: { id },
            include: { logs: { orderBy: { createdAt: 'asc' } } }
        });

        if (!deployment) {
            return reply.code(404).send({ error: 'Deployment not found' });
        }

        return deployment;
    });

    fastify.post('/deployments/:id/relaunch', async (request, reply) => {
        const { id } = request.params as { id: string };
        const deployment = await prisma.deployment.findUnique({ where: { id } });

        if (!deployment) {
            return reply.code(404).send({ error: 'Deployment not found' });
        }

        return deploymentService.createDeployment(deployment.gitUrl);
    });
}
