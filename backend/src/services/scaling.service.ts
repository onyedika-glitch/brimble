/// <reference types="node" />
import { prisma } from '../index.js';
import { DockerService } from './docker.service.js';
import axios from 'axios';

const docker = new DockerService();

export class ScalingService {
    private monitoringIntervals = new Map<string, ReturnType<typeof setInterval>>();

    startMonitoring(deploymentId: string) {
        if (this.monitoringIntervals.has(deploymentId)) return;

        const interval = setInterval(async () => {
            await this.evaluateScaling(deploymentId);
        }, 30_000);

        this.monitoringIntervals.set(deploymentId, interval);
    }

    stopMonitoring(deploymentId: string) {
        const interval = this.monitoringIntervals.get(deploymentId);
        if (interval) {
            clearInterval(interval);
            this.monitoringIntervals.delete(deploymentId);
        }
    }

    private async evaluateScaling(deploymentId: string) {
        const deployment = await prisma.deployment.findUnique({ where: { id: deploymentId } });
        if (!deployment || !deployment.containerId || deployment.status !== 'running') return;
        if (deployment.maxReplicas <= 1) return;

        const stats = await docker.getContainerStats(deployment.containerId);
        if (!stats) return;

        const cpuPercent = parseFloat(stats.cpu.replace('%', ''));
        const currentReplicas = deployment.minReplicas; // simplified: track via DB

        if (cpuPercent > deployment.cpuThreshold && currentReplicas < deployment.maxReplicas) {
            const newReplicas = Math.min(currentReplicas + 1, deployment.maxReplicas);
            await this.scaleTo(deploymentId, newReplicas, `CPU ${cpuPercent}% exceeded threshold ${deployment.cpuThreshold}%`);
        } else if (cpuPercent < deployment.cpuThreshold * 0.5 && currentReplicas > deployment.minReplicas) {
            const newReplicas = Math.max(currentReplicas - 1, deployment.minReplicas);
            await this.scaleTo(deploymentId, newReplicas, `CPU ${cpuPercent}% below scale-down threshold`);
        }
    }

    async scaleTo(deploymentId: string, replicas: number, reason: string) {
        const deployment = await prisma.deployment.findUnique({ where: { id: deploymentId } });
        if (!deployment) return;

        const from = deployment.minReplicas;
        await prisma.deployment.update({
            where: { id: deploymentId },
            data: { minReplicas: replicas }
        });

        await prisma.scalingEvent.create({
            data: { deploymentId, fromReplicas: from, toReplicas: replicas, reason }
        });

        console.log(`[Scaling] ${deployment.name}: ${from} → ${replicas} replicas. Reason: ${reason}`);

        // Update Caddy upstream balancing
        await this.updateCaddyLoadBalancer(deployment.name, replicas);
    }

    private async updateCaddyLoadBalancer(name: string, replicas: number) {
        const caddyHost = process.env.CADDY_HOST || 'caddy';
        const upstreams = Array.from({ length: replicas }, (_, i) => ({
            dial: `${name}-${i + 1}:80`
        }));
        try {
            await axios.patch(`http://${caddyHost}:2019/config/apps/http/servers/srv0/routes/0/handle/0/upstreams`, upstreams);
        } catch { /* Caddy may not be running in dev */ }
    }

    async getScalingHistory(deploymentId: string) {
        return prisma.scalingEvent.findMany({
            where: { deploymentId },
            orderBy: { createdAt: 'desc' },
            take: 20,
        });
    }
}

export const scalingService = new ScalingService();
