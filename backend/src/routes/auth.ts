import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { prisma } from '../index.js';
import { auditService } from '../services/audit.service.js';
import { v4 as uuidv4 } from 'uuid';
import { notificationService } from '../services/notification.service.js';

const SALT_ROUNDS = 12;
const SESSION_TTL_DAYS = 7;

export async function authRoutes(fastify: FastifyInstance) {

    fastify.post('/auth/register', async (request: FastifyRequest, reply: FastifyReply) => {
        const schema = z.object({
            email: z.string().email(),
            password: z.string().min(8),
            name: z.string().min(1),
            teamName: z.string().optional(),
        });
        const body = schema.parse(request.body);

        const existing = await prisma.user.findUnique({ where: { email: body.email } });
        if (existing) return reply.code(409).send({ error: 'Email already registered' });

        const passwordHash = await bcrypt.hash(body.password, SALT_ROUNDS);
        const userId = uuidv4();
        const teamId = uuidv4();
        const teamSlug = (body.teamName || body.name).toLowerCase().replace(/\s+/g, '-') + '-' + Date.now();

        // Create user + personal team atomically
        const user = await prisma.user.create({
            data: {
                id: userId,
                email: body.email,
                passwordHash,
                name: body.name,
                ownedTeams: {
                    create: {
                        id: teamId,
                        name: body.teamName || `${body.name}'s Team`,
                        slug: teamSlug,
                        members: {
                            create: { userId, role: 'owner' }
                        }
                    }
                },
                notifications: {
                    create: {}
                }
            },
            include: { ownedTeams: true }
        });

        const token = await createSession(userId);

        await auditService.log({
            action: 'user.registered',
            entityType: 'user',
            entityId: userId,
            metadata: { email: body.email },
            userId,
            teamId,
        });

        return { token, user: sanitizeUser(user), team: user.ownedTeams[0] };
    });

    fastify.post('/auth/login', async (request: FastifyRequest, reply: FastifyReply) => {
        const schema = z.object({
            email: z.string().email(),
            password: z.string(),
        });
        const body = schema.parse(request.body);

        const user = await prisma.user.findUnique({
            where: { email: body.email },
            include: { ownedTeams: true, memberships: { include: { team: true } } }
        });

        if (!user || !(await bcrypt.compare(body.password, user.passwordHash))) {
            return reply.code(401).send({ error: 'Invalid email or password' });
        }

        const token = await createSession(user.id);

        await auditService.log({
            action: 'user.login',
            entityType: 'user',
            entityId: user.id,
            metadata: { email: user.email },
            userId: user.id,
        });

        const teams = user.memberships.map((m: { team: unknown }) => m.team);
        return { token, user: sanitizeUser(user), teams };
    });

    fastify.post('/auth/logout', async (request: FastifyRequest, reply: FastifyReply) => {
        const token = extractToken(request);
        if (token) {
            await prisma.session.deleteMany({ where: { token } });
        }
        return { success: true };
    });

    fastify.get('/auth/me', async (request: FastifyRequest, reply: FastifyReply) => {
        const user = await getUserFromRequest(request);
        if (!user) return reply.code(401).send({ error: 'Unauthorized' });

        const fullUser = await prisma.user.findUnique({
            where: { id: user.id },
            include: {
                memberships: { include: { team: true } },
                notifications: true
            }
        });
        return { user: sanitizeUser(fullUser!), teams: fullUser!.memberships.map((m: { team: unknown }) => m.team) };
    });

    fastify.put('/auth/notifications', async (request: FastifyRequest, reply: FastifyReply) => {
        const user = await getUserFromRequest(request);
        if (!user) return reply.code(401).send({ error: 'Unauthorized' });

        const schema = z.object({
            emailEnabled: z.boolean().optional(),
            slackWebhook: z.string().url().nullable().optional(),
            onSuccess: z.boolean().optional(),
            onFailure: z.boolean().optional(),
            onPrPreview: z.boolean().optional(),
        });
        const body = schema.parse(request.body);
        const settings = await notificationService.updateSettings(user.id, body);
        return settings;
    });
}

// ─── Auth Helpers ────────────────────────────────────────────────────────────

export async function createSession(userId: string): Promise<string> {
    const token = uuidv4() + uuidv4();
    const expiresAt = new Date(Date.now() + SESSION_TTL_DAYS * 24 * 60 * 60 * 1000);
    await prisma.session.create({ data: { token, userId, expiresAt } });
    return token;
}

export function extractToken(request: FastifyRequest): string | null {
    const auth = request.headers.authorization;
    if (auth && auth.startsWith('Bearer ')) return auth.slice(7);
    return null;
}

export async function getUserFromRequest(request: FastifyRequest) {
    const token = extractToken(request);
    if (!token) return null;

    const session = await prisma.session.findUnique({
        where: { token },
        include: { user: true }
    });

    if (!session || session.expiresAt < new Date()) return null;
    return session.user;
}

function sanitizeUser(user: Record<string, unknown>) {
    const { passwordHash: _pw, ...safe } = user;
    return safe;
}
