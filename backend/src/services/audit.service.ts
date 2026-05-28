/// <reference types="node" />
import { prisma } from '../index.js';

export class AuditService {
    async log(params: {
        action: string;
        entityType: string;
        entityId: string;
        metadata?: Record<string, unknown>;
        userId?: string;
        teamId?: string;
    }) {
        await prisma.auditLog.create({
            data: {
                action: params.action,
                entityType: params.entityType,
                entityId: params.entityId,
                metadata: JSON.stringify(params.metadata || {}),
                userId: params.userId,
                teamId: params.teamId,
            },
        });
    }

    async getForTeam(teamId: string, limit = 50) {
        return prisma.auditLog.findMany({
            where: { teamId },
            orderBy: { createdAt: 'desc' },
            take: limit,
            include: { user: { select: { name: true, email: true } } },
        });
    }

    async getForUser(userId: string, limit = 50) {
        return prisma.auditLog.findMany({
            where: { userId },
            orderBy: { createdAt: 'desc' },
            take: limit,
        });
    }
}

export const auditService = new AuditService();
