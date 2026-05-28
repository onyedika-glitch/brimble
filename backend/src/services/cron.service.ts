/// <reference types="node" />
import cron from 'node-cron';
import { prisma } from '../index.js';

// Lazily resolved to break the circular dependency with deployment.service.ts
let _deploymentService: any = null;
async function getDeploymentService() {
    if (!_deploymentService) {
        const { DeploymentService } = await import('./deployment.service.js');
        _deploymentService = new DeploymentService();
    }
    return _deploymentService;
}

class CronRunner {
    private tasks = new Map<string, cron.ScheduledTask>();

    async loadAndScheduleAll() {
        const cronJobs = await prisma.deployment.findMany({
            where: { type: 'cron', status: 'running' }
        });
        for (const job of cronJobs) {
            if (job.cronSchedule) {
                this.schedule(job.id, job.cronSchedule);
            }
        }
        console.log(`[CronRunner] Scheduled ${cronJobs.length} cron job(s).`);
    }

    schedule(deploymentId: string, expression: string) {
        if (this.tasks.has(deploymentId)) {
            this.tasks.get(deploymentId)!.stop();
        }
        if (!cron.validate(expression)) {
            console.error(`[CronRunner] Invalid cron expression: ${expression}`);
            return;
        }
        const task = cron.schedule(expression, async () => {
            console.log(`[CronRunner] Triggering job ${deploymentId}`);
            const svc = await getDeploymentService();
            await svc.relaunchDeployment(deploymentId);
        });
        this.tasks.set(deploymentId, task);
    }

    unschedule(deploymentId: string) {
        const task = this.tasks.get(deploymentId);
        if (task) {
            task.stop();
            this.tasks.delete(deploymentId);
        }
    }
}

export const cronRunner = new CronRunner();
