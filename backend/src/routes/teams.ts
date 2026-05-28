import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { prisma } from '../index.js';
import { auditService } from '../services/audit.service.js';
import { getUserFromRequest } from './auth.js';
import { v4 as uuidv4 } from 'uuid';

export async function teamRoutes(fastify: FastifyInstance) {

    fastify.get('/teams', async (request: FastifyRequest, reply: FastifyReply) => {
        const user = await getUserFromRequest(request);
        if (!user) return reply.code(401).send({ error: 'Unauthorized' });

        const memberships = await prisma.teamMember.findMany({
            where: { userId: user.id },
            include: { team: true }
        });
        return memberships.map(m => ({ ...m.team, role: m.role }));
    });

    fastify.post('/teams', async (request: FastifyRequest, reply: FastifyReply) => {
        const user = await getUserFromRequest(request);
        if (!user) return reply.code(401).send({ error: 'Unauthorized' });

        const schema = z.object({ name: z.string().min(1) });
        const { name } = schema.parse(request.body);
        const slug = name.toLowerCase().replace(/\s+/g, '-') + '-' + Date.now();
        const teamId = uuidv4();

        const team = await prisma.team.create({
            data: {
                id: teamId,
                name,
                slug,
                ownerId: user.id,
                members: {
                    create: { userId: user.id, role: 'owner' }
                }
            }
        });

        await auditService.log({
            action: 'team.created',
            entityType: 'team',
            entityId: teamId,
            metadata: { name },
            userId: user.id,
            teamId,
        });

        return team;
    });

    fastify.post('/teams/:teamId/invite', async (request: FastifyRequest, reply: FastifyReply) => {
        const user = await getUserFromRequest(request);
        if (!user) return reply.code(401).send({ error: 'Unauthorized' });

        const { teamId } = request.params as { teamId: string };
        const schema = z.object({ email: z.string().email(), role: z.enum(['admin', 'member']).default('member') });
        const { email, role } = schema.parse(request.body);

        // Check caller is owner or admin
        const membership = await prisma.teamMember.findFirst({
            where: { teamId, userId: user.id }
        });
        if (!membership || (membership.role !== 'owner' && membership.role !== 'admin')) {
            return reply.code(403).send({ error: 'Forbidden' });
        }

        const invitee = await prisma.user.findUnique({ where: { email } });
        if (!invitee) return reply.code(404).send({ error: 'User not found' });

        const existing = await prisma.teamMember.findFirst({ where: { teamId, userId: invitee.id } });
        if (existing) return reply.code(409).send({ error: 'User already in team' });

        const member = await prisma.teamMember.create({
            data: { teamId, userId: invitee.id, role }
        });

        await auditService.log({
            action: 'team.member_added',
            entityType: 'team',
            entityId: teamId,
            metadata: { email, role },
            userId: user.id,
            teamId,
        });

        return member;
    });

    fastify.delete('/teams/:teamId/members/:userId', async (request: FastifyRequest, reply: FastifyReply) => {
        const caller = await getUserFromRequest(request);
        if (!caller) return reply.code(401).send({ error: 'Unauthorized' });

        const { teamId, userId } = request.params as { teamId: string; userId: string };

        const membership = await prisma.teamMember.findFirst({ where: { teamId, userId: caller.id } });
        if (!membership || membership.role !== 'owner') {
            return reply.code(403).send({ error: 'Only owners can remove members' });
        }

        await prisma.teamMember.deleteMany({ where: { teamId, userId } });

        await auditService.log({
            action: 'team.member_removed',
            entityType: 'team',
            entityId: teamId,
            metadata: { removedUserId: userId },
            userId: caller.id,
            teamId,
        });

        return { success: true };
    });

    fastify.get('/teams/:teamId/audit', async (request: FastifyRequest, reply: FastifyReply) => {
        const user = await getUserFromRequest(request);
        if (!user) return reply.code(401).send({ error: 'Unauthorized' });

        const { teamId } = request.params as { teamId: string };

        const membership = await prisma.teamMember.findFirst({ where: { teamId, userId: user.id } });
        if (!membership) return reply.code(403).send({ error: 'Forbidden' });

        return auditService.getForTeam(teamId);
    });

    fastify.get('/teams/:teamId/usage', async (request: FastifyRequest, reply: FastifyReply) => {
        const user = await getUserFromRequest(request);
        if (!user) return reply.code(401).send({ error: 'Unauthorized' });

        const { teamId } = request.params as { teamId: string };
        const membership = await prisma.teamMember.findFirst({ where: { teamId, userId: user.id } });
        if (!membership) return reply.code(403).send({ error: 'Forbidden' });

        const records = await prisma.usageRecord.findMany({
            where: { teamId },
            orderBy: { recordedAt: 'desc' },
            take: 100,
        });

        // Aggregate by metric
        const summary: Record<string, number> = {};
        for (const r of records) {
            summary[r.metric] = (summary[r.metric] || 0) + r.value;
        }

        const plan = await prisma.team.findUnique({ where: { id: teamId }, select: { plan: true } });

        const limits: Record<string, Record<string, number>> = {
            hobby: { cpu_seconds: 10_000, memory_gb_hours: 512, bandwidth_gb: 100 },
            pro: { cpu_seconds: 100_000, memory_gb_hours: 5_120, bandwidth_gb: 1_000 },
            enterprise: { cpu_seconds: Infinity, memory_gb_hours: Infinity, bandwidth_gb: Infinity },
        };

        return { usage: summary, limits: limits[plan?.plan || 'hobby'], plan: plan?.plan };
    });
}
