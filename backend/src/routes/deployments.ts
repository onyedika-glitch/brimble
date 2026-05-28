import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { prisma } from '../index.js';
import { DeploymentService } from '../services/deployment.service.js';
import { DockerService } from '../services/docker.service.js';
import { auditService } from '../services/audit.service.js';
import { scalingService } from '../services/scaling.service.js';
import { cronRunner } from '../services/cron.service.js';
import { encrypt, decrypt } from '../services/crypto.service.js';
import { getUserFromRequest } from './auth.js';

const deploymentService = new DeploymentService();
const docker = new DockerService();

export async function deploymentRoutes(fastify: FastifyInstance) {

    fastify.get('/deployments', async (request: FastifyRequest, reply: FastifyReply) => {
        const user = await getUserFromRequest(request);
        // Support both auth and open access (for teams)
        const teamId = (request.query as any).teamId;
        return prisma.deployment.findMany({
            orderBy: { createdAt: 'desc' },
            where: teamId ? { teamId } : undefined,
            include: {
                logs: { take: 1, orderBy: { createdAt: 'desc' } },
                disks: true,
            }
        });
    });

    fastify.post('/deployments/validate-blueprint', async (request: FastifyRequest, reply: FastifyReply) => {
        const schema = z.object({
            gitUrl: z.string()
        });
        const { gitUrl } = schema.parse(request.body);
        const result = await deploymentService.validateBlueprint(gitUrl);
        return reply.send(result);
    });

    fastify.post('/deployments', async (request: FastifyRequest, reply: FastifyReply) => {
        const user = await getUserFromRequest(request);
        const schema = z.object({
            gitUrl: z.string().optional(),
            name: z.string().optional(),
            type: z.enum(['app', 'postgres', 'redis', 'worker', 'cron', 'blueprint']).default('app'),
            teamId: z.string().optional(),
            region: z.string().optional(),
            cronSchedule: z.string().optional(),
            startCommand: z.string().optional(),
            minReplicas: z.number().int().min(1).max(10).optional(),
            maxReplicas: z.number().int().min(1).max(10).optional(),
            healthCheckPath: z.string().optional(),
            diskSizeGb: z.number().int().min(1).max(100).optional(),
            diskMountPath: z.string().optional(),
        });

        const body = schema.parse(request.body);

        if ((body.type === 'app' || body.type === 'worker' || body.type === 'cron') && !body.gitUrl) {
            return reply.code(400).send({ error: 'gitUrl is required for apps, workers, and cron jobs' });
        }
        if (body.type === 'cron' && !body.cronSchedule) {
            return reply.code(400).send({ error: 'cronSchedule is required for cron jobs' });
        }

        return deploymentService.createDeployment(body.gitUrl || '', body.type, body.name, {
            teamId: body.teamId || user?.id,
            region: body.region,
            cronSchedule: body.cronSchedule,
            startCommand: body.startCommand,
            minReplicas: body.minReplicas,
            maxReplicas: body.maxReplicas,
            healthCheckPath: body.healthCheckPath,
            diskSizeGb: body.diskSizeGb,
            diskMountPath: body.diskMountPath,
        });
    });

    fastify.get('/deployments/:id', async (request: FastifyRequest, reply: FastifyReply) => {
        const { id } = request.params as { id: string };
        const deployment = await prisma.deployment.findUnique({
            where: { id },
            include: {
                logs: { orderBy: { createdAt: 'asc' } },
                envVars: { select: { id: true, key: true, value: false } }, // Never return encrypted values
                domains: true,
                disks: true,
                scalingEvents: { orderBy: { createdAt: 'desc' }, take: 10 },
            }
        });

        if (!deployment) return reply.code(404).send({ error: 'Deployment not found' });

        // Decrypt liveUrl for database types to show connection string
        let result: any = { ...deployment };
        if ((deployment.type === 'postgres' || deployment.type === 'redis') && deployment.liveUrl) {
            result.liveUrl = decrypt(deployment.liveUrl);
        }

        return result;
    });

    fastify.delete('/deployments/:id', async (request: FastifyRequest, reply: FastifyReply) => {
        const { id } = request.params as { id: string };
        await deploymentService.destroyDeployment(id);
        return { success: true };
    });

    fastify.post('/deployments/:id/relaunch', async (request: FastifyRequest, reply: FastifyReply) => {
        const { id } = request.params as { id: string };
        const deployment = await prisma.deployment.findUnique({ where: { id } });
        if (!deployment) return reply.code(404).send({ error: 'Not found' });
        return deploymentService.relaunchDeployment(id);
    });

    // Environment Variables
    fastify.get('/deployments/:id/env', async (request: FastifyRequest, reply: FastifyReply) => {
        const { id } = request.params as { id: string };
        // Return keys only, never values
        const vars = await prisma.environmentVariable.findMany({
            where: { deploymentId: id },
            select: { id: true, key: true }
        });
        return vars;
    });

    fastify.post('/deployments/:id/env', async (request: FastifyRequest, reply: FastifyReply) => {
        const { id } = request.params as { id: string };
        const schema = z.object({ key: z.string().min(1), value: z.string() });
        const { key, value } = schema.parse(request.body);

        // Encrypt before storing
        const encryptedValue = encrypt(value);

        await prisma.environmentVariable.upsert({
            where: { deploymentId_key: { deploymentId: id, key } },
            update: { value: encryptedValue },
            create: { key, value: encryptedValue, deploymentId: id }
        });

        const deployment = await prisma.deployment.findUnique({ where: { id } });
        await auditService.log({
            action: 'env.updated',
            entityType: 'deployment',
            entityId: id,
            metadata: { key, action: 'upsert' },
            teamId: deployment?.teamId || undefined,
        });

        return { success: true };
    });

    fastify.delete('/deployments/:id/env/:key', async (request: FastifyRequest, reply: FastifyReply) => {
        const { id, key } = request.params as { id: string; key: string };
        await prisma.environmentVariable.deleteMany({
            where: { deploymentId: id, key }
        });
        return { success: true };
    });

    // Custom Domains
    fastify.post('/deployments/:id/domains', async (request: FastifyRequest, reply: FastifyReply) => {
        const { id } = request.params as { id: string };
        const schema = z.object({ domain: z.string() });
        const { domain } = schema.parse(request.body);

        await prisma.customDomain.create({ data: { domain, deploymentId: id } });
        await deploymentService.updateCaddyForDeployment(id);

        return { success: true };
    });

    fastify.delete('/deployments/:id/domains/:domainId', async (request: FastifyRequest, reply: FastifyReply) => {
        const { id, domainId } = request.params as { id: string; domainId: string };
        await prisma.customDomain.delete({ where: { id: domainId } });
        await deploymentService.updateCaddyForDeployment(id);
        return { success: true };
    });

    // Persistent Disks
    fastify.post('/deployments/:id/disks', async (request: FastifyRequest, reply: FastifyReply) => {
        const { id } = request.params as { id: string };
        const schema = z.object({
            name: z.string(),
            sizeGb: z.number().int().min(1).max(100),
            mountPath: z.string().default('/data'),
        });
        const { name, sizeGb, mountPath } = schema.parse(request.body);
        const disk = await deploymentService.createPersistentDisk(id, name, sizeGb, mountPath);
        return disk;
    });

    // Health Check Config
    fastify.put('/deployments/:id/health-check', async (request: FastifyRequest, reply: FastifyReply) => {
        const { id } = request.params as { id: string };
        const schema = z.object({
            path: z.string().default('/'),
            interval: z.number().int().min(10).max(300).default(30),
            timeout: z.number().int().min(1).max(30).default(5),
        });
        const body = schema.parse(request.body);
        const deployment = await prisma.deployment.update({
            where: { id },
            data: {
                healthCheckPath: body.path,
                healthCheckInterval: body.interval,
                healthCheckTimeout: body.timeout,
            }
        });
        await deploymentService.updateCaddyForDeployment(id);
        return deployment;
    });

    // Auto-scaling Config
    fastify.put('/deployments/:id/scaling', async (request: FastifyRequest, reply: FastifyReply) => {
        const { id } = request.params as { id: string };
        const schema = z.object({
            minReplicas: z.number().int().min(1).max(10),
            maxReplicas: z.number().int().min(1).max(10),
            cpuThreshold: z.number().int().min(10).max(100).default(80),
        });
        const body = schema.parse(request.body);

        if (body.minReplicas > body.maxReplicas) {
            return reply.code(400).send({ error: 'minReplicas cannot exceed maxReplicas' });
        }

        const deployment = await prisma.deployment.update({
            where: { id },
            data: {
                minReplicas: body.minReplicas,
                maxReplicas: body.maxReplicas,
                cpuThreshold: body.cpuThreshold,
            }
        });

        if (body.maxReplicas > 1) {
            scalingService.startMonitoring(id);
        } else {
            scalingService.stopMonitoring(id);
        }

        return deployment;
    });

    fastify.get('/deployments/:id/scaling/history', async (request: FastifyRequest, reply: FastifyReply) => {
        const { id } = request.params as { id: string };
        return scalingService.getScalingHistory(id);
    });

    // Live Metrics
    fastify.get('/deployments/:id/metrics', async (request: FastifyRequest, reply: FastifyReply) => {
        const { id } = request.params as { id: string };
        const deployment = await prisma.deployment.findUnique({ where: { id } });
        if (!deployment || !deployment.containerId) {
            return reply.code(404).send({ error: 'Container not found' });
        }
        const stats = await docker.getContainerStats(deployment.containerId);
        return stats || { cpu: '0.00%', memory: '0B / 0B' };
    });

    // GitHub Webhooks
    fastify.post('/webhooks/github', async (request: FastifyRequest, reply: FastifyReply) => {
        const event = request.headers['x-github-event'];
        const body: any = request.body;

        if (event === 'push') {
            const gitUrl = body.repository?.clone_url;
            const apps = await prisma.deployment.findMany({
                where: { gitUrl, type: { in: ['app', 'worker', 'cron'] } }
            });
            for (const app of apps) {
                deploymentService.relaunchDeployment(app.id).catch(console.error);
            }
        } else if (event === 'pull_request') {
            const action = body.action;
            const gitUrl = body.repository?.clone_url;
            const prNumber = body.pull_request?.number;

            if (action === 'opened' || action === 'synchronize') {
                const apps = await prisma.deployment.findMany({
                    where: { gitUrl, type: 'app', isPrPreview: false }
                });
                for (const app of apps) {
                    deploymentService.createPrPreview(app.id, prNumber, body.pull_request?.head?.sha).catch(console.error);
                }
            } else if (action === 'closed') {
                const previews = await prisma.deployment.findMany({
                    where: { gitUrl, type: 'app', isPrPreview: true, prNumber }
                });
                for (const preview of previews) {
                    deploymentService.destroyDeployment(preview.id).catch(console.error);
                }
            }
        }

        return { received: true };
    });
}
