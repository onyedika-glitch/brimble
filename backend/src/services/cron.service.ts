/// <reference types="node" />
import cron from 'node-cron';
import { prisma } from '../index.js';
import { DeploymentService } from './deployment.service.js';

const deploymentService = new DeploymentService();

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
            await deploymentService.relaunchDeployment(deploymentId);
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
