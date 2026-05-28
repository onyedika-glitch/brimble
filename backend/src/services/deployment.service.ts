/// <reference types="node" />
import { prisma, logEvents } from '../index.js';
import { DockerService } from './docker.service.js';
import { simpleGit } from 'simple-git';
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs/promises';
import { v4 as uuidv4 } from 'uuid';
import axios from 'axios';
import { encrypt, decrypt } from './crypto.service.js';
import { auditService } from './audit.service.js';
import { notificationService } from './notification.service.js';
import { scalingService } from './scaling.service.js';
import { cronRunner } from './cron.service.js';

const dockerService = new DockerService();
const git = simpleGit();

export class DeploymentService {
    async createDeployment(gitUrl: string, type: string = 'app', customName?: string, options?: {
        teamId?: string;
        region?: string;
        cronSchedule?: string;
        startCommand?: string;
        minReplicas?: number;
        maxReplicas?: number;
        healthCheckPath?: string;
        diskSizeGb?: number;
        diskMountPath?: string;
    }) {
        const id = uuidv4();
        const name = customName || id.split('-')[0];

        const deployment = await prisma.deployment.create({
            data: {
                id, name, gitUrl,
                status: 'pending',
                type,
                teamId: options?.teamId,
                region: options?.region || 'us-east-1',
                cronSchedule: options?.cronSchedule,
                startCommand: options?.startCommand,
                minReplicas: options?.minReplicas || 1,
                maxReplicas: options?.maxReplicas || 1,
                healthCheckPath: options?.healthCheckPath || '/',
                diskSizeGb: options?.diskSizeGb,
                diskMountPath: options?.diskMountPath,
            }
        });

        await auditService.log({
            action: 'deployment.created',
            entityType: 'deployment',
            entityId: id,
            metadata: { name, type, gitUrl },
            teamId: options?.teamId,
        });

        if (type === 'app' || type === 'worker') {
            this.relaunchDeployment(id).catch(console.error);
        } else if (type === 'postgres' || type === 'redis') {
            this.provisionDatabase(id).catch(console.error);
        } else if (type === 'cron') {
            this.relaunchDeployment(id).then(() => {
                if (options?.cronSchedule) cronRunner.schedule(id, options.cronSchedule);
            }).catch(console.error);
        } else if (type === 'blueprint') {
            this.provisionBlueprint(id, gitUrl, options?.teamId, options?.region).catch(console.error);
        }

        return deployment;
    }

    async relaunchDeployment(id: string) {
        await prisma.deployment.update({ where: { id }, data: { status: 'pending' } });
        return this.startPipeline(id);
    }

    async provisionDatabase(id: string) {
        const deployment = await prisma.deployment.findUnique({ where: { id } });
        if (!deployment) return;

        this.log(id, `🗄️ Provisioning ${deployment.type} database...`);
        await prisma.deployment.update({ where: { id }, data: { status: 'deploying' } });

        const password = Math.random().toString(36).slice(-16);
        const uniqueName = `brimble-db-${deployment.name}-${Date.now()}`;

        const { containerId, port } = await dockerService.runDatabaseContainer(
            uniqueName,
            deployment.type as 'postgres' | 'redis',
            password
        );

        const connectionString = deployment.type === 'postgres'
            ? `postgresql://postgres:${password}@${uniqueName}:5432/db`
            : `redis://${uniqueName}:6379`;

        // Encrypt connection string before storing
        const encryptedConn = encrypt(connectionString);

        this.log(id, `✅ Database ready!`);
        this.log(id, `Internal URL: ${connectionString}`);

        await prisma.deployment.update({
            where: { id },
            data: { status: 'running', containerId, port, liveUrl: encryptedConn }
        });
    }

    private async startPipeline(id: string) {
        const deployment = await prisma.deployment.findUnique({
            where: { id },
            include: { envVars: true, domains: true, disks: true }
        });
        if (!deployment) return;

        const { gitUrl, name, envVars, containerId: oldContainerId, type } = deployment;
        if (!gitUrl) return;

        const workspace = path.join(process.cwd(), 'workspaces', id);

        try {
            this.log(id, `📥 Cloning repository: ${gitUrl}...`);
            await prisma.deployment.update({ where: { id }, data: { status: 'building' } });

            await fs.rm(workspace, { recursive: true, force: true }).catch(() => {});
            await fs.mkdir(workspace, { recursive: true });
            await git.clone(gitUrl, workspace);

            this.log(id, `🔨 Building with Railpack...`);
            const imageTag = `brimble-${name}:${Date.now()}`;
            const { buildDir } = await this.runRailpackBuild(id, workspace, imageTag, deployment.startCommand);

            await prisma.deployment.update({ where: { id }, data: { status: 'deploying', imageTag } });
            this.log(id, `🚀 Build complete. Launching container...`);

            const internalPort = 80;
            const newContainerName = `${name}-${Date.now()}`;

            // Decrypt env var values for injection
            const decryptedEnvVars = envVars.map((e: { key: string; value: string }) => ({
                key: e.key,
                value: decrypt(e.value),
            }));

            // Build disk volume mounts
            const volumeMounts = deployment.disks.map((d: { volumeName: string; mountPath: string }) => `${d.volumeName}:${d.mountPath}`);

            const { containerId, port: hostPort } = await dockerService.runContainer(
                newContainerName,
                imageTag,
                internalPort,
                decryptedEnvVars,
                volumeMounts
            );

            // Health check with configurable path and timeout
            this.log(id, `🔍 Health checking ${deployment.healthCheckPath}...`);
            const healthy = await this.waitForHealthy(
                newContainerName,
                internalPort,
                deployment.healthCheckPath,
                deployment.healthCheckTimeout,
                15
            );

            if (!healthy) throw new Error(`Container failed health check at ${deployment.healthCheckPath}`);
            this.log(id, `✅ App is healthy! Switching traffic...`);

            const liveUrl = `http://${name}.localhost:8080`;
            await this.updateCaddyForDeployment(id, newContainerName);

            if (oldContainerId) {
                this.log(id, `♻️ Retiring old container...`);
                await dockerService.stopContainer(oldContainerId);
            }

            await prisma.deployment.update({
                where: { id },
                data: { status: 'running', containerId: newContainerName, port: hostPort, liveUrl }
            });

            this.log(id, `🎉 Deployment successful! Available at ${liveUrl}`);

            // Start auto-scaling monitor if configured
            if (deployment.maxReplicas > 1) {
                scalingService.startMonitoring(id);
            }

            // Send success notification
            await notificationService.notifyDeployment(id, 'success');

            await auditService.log({
                action: 'deployment.succeeded',
                entityType: 'deployment',
                entityId: id,
                metadata: { liveUrl, imageTag },
                teamId: deployment.teamId || undefined,
            });

        } catch (error: any) {
            this.log(id, `❌ Error: ${error.message}`);
            await prisma.deployment.update({ where: { id }, data: { status: 'failed' } });
            await notificationService.notifyDeployment(id, 'failure');
            await auditService.log({
                action: 'deployment.failed',
                entityType: 'deployment',
                entityId: id,
                metadata: { error: error.message },
                teamId: deployment.teamId || undefined,
            });
        }
    }

    private async waitForHealthy(
        containerName: string,
        port: number,
        path: string,
        timeoutSeconds: number,
        maxAttempts: number
    ): Promise<boolean> {
        for (let i = 0; i < maxAttempts; i++) {
            try {
                await axios.get(`http://${containerName}:${port}${path}`, {
                    timeout: timeoutSeconds * 1000
                });
                return true;
            } catch {
                await new Promise(resolve => setTimeout(resolve, 2000));
            }
        }
        return false;
    }

    private async runRailpackBuild(
        id: string,
        workspace: string,
        imageTag: string,
        startCommand?: string | null
    ): Promise<{ buildDir: string }> {
        let buildDir = workspace;
        const subdirs = await fs.readdir(workspace, { withFileTypes: true });

        for (const dir of subdirs) {
            if (dir.isDirectory() && !dir.name.startsWith('.')) {
                const subPath = path.join(workspace, dir.name);
                const files = await fs.readdir(subPath);
                if (files.some((f: string) => ['package.json', 'go.mod', 'requirements.txt', 'index.html'].includes(f))) {
                    buildDir = subPath;
                    this.log(id, `📁 Detected project in: ${dir.name}`);
                    break;
                }
            }
        }

        const pkgPath = path.join(buildDir, 'package.json');
        const hasPackageJson = await fs.access(pkgPath).then(() => true).catch(() => false);

        return new Promise((resolve, reject) => {
            const args = ['build', '--name', imageTag, '.'];
            if (startCommand) {
                args.splice(3, 0, '--start-cmd', startCommand);
            } else if (hasPackageJson) {
                args.splice(3, 0, '--start-cmd', 'PORT=80 npm start');
            }

            const child = spawn('/usr/local/bin/railpack', args, {
                cwd: buildDir,
                env: { ...process.env, RAILPACK_VERBOSE: '1', PORT: '80' }
            });

            child.stdout.on('data', (data: any) => this.log(id, data.toString()));
            child.stderr.on('data', (data: any) => this.log(id, data.toString()));

            child.on('close', (code: number | null) => {
                if (code === 0) resolve({ buildDir });
                else reject(new Error(`Railpack build failed with code ${code}`));
            });
        });
    }

    public async updateCaddyForDeployment(id: string, targetContainerName?: string) {
        const deployment = await prisma.deployment.findUnique({
            where: { id }, include: { domains: true }
        });
        if (!deployment) return;

        const containerName = targetContainerName || deployment.containerId;
        if (!containerName) return;

        const hosts = [
            `${deployment.name}.localhost`,
            `${deployment.name}.localhost:8080`,
            ...(deployment.domains?.map((d: any) => d.domain) || [])
        ];

        try {
            const caddyHost = process.env.CADDY_HOST || 'localhost';
            const route = {
                match: [{ host: hosts }],
                handle: [{
                    handler: 'reverse_proxy',
                    upstreams: [{ dial: `${containerName}:80` }],
                    health_checks: {
                        active: {
                            path: deployment.healthCheckPath,
                            interval: `${deployment.healthCheckInterval}s`,
                            timeout: `${deployment.healthCheckTimeout}s`,
                        }
                    }
                }]
            };
            await axios.put(
                `http://${caddyHost}:2019/config/apps/http/servers/srv0/routes/${deployment.name}`,
                route
            );
            this.log(id, `🌐 Caddy routing active for ${hosts.join(', ')}`);
        } catch (e: any) {
            this.log(id, `⚠️ Caddy config: ${e.message}`);
        }
    }

    public async createPersistentDisk(deploymentId: string, name: string, sizeGb: number, mountPath: string) {
        const volumeName = `brimble-disk-${deploymentId}-${Date.now()}`;
        await dockerService.createVolume(volumeName, sizeGb);

        return prisma.persistentDisk.create({
            data: { name, sizeGb, mountPath, volumeName, deploymentId }
        });
    }

    public async createPrPreview(parentId: string, prNumber: number, _sha: string) {
        const parent = await prisma.deployment.findUnique({ where: { id: parentId } });
        if (!parent || !parent.gitUrl) return;

        const previewId = uuidv4();
        const previewName = `${parent.name}-pr-${prNumber}`;

        await prisma.deployment.create({
            data: {
                id: previewId,
                name: previewName,
                gitUrl: parent.gitUrl,
                status: 'pending',
                type: 'app',
                isPrPreview: true,
                prNumber,
                teamId: parent.teamId,
            }
        });

        this.relaunchDeployment(previewId)
            .then(() => notificationService.notifyDeployment(previewId, 'pr_preview'))
            .catch(console.error);
    }

    public async destroyDeployment(id: string) {
        const deployment = await prisma.deployment.findUnique({
            where: { id },
            include: { disks: true }
        });
        if (!deployment) return;

        scalingService.stopMonitoring(id);
        cronRunner.unschedule(id);

        if (deployment.containerId) {
            await dockerService.stopContainer(deployment.containerId);
        }

        // Remove persistent disk volumes
        for (const disk of deployment.disks) {
            await dockerService.removeVolume(disk.volumeName).catch(() => {});
        }

        try {
            const caddyHost = process.env.CADDY_HOST || 'localhost';
            await axios.delete(
                `http://${caddyHost}:2019/config/apps/http/servers/srv0/routes/${deployment.name}`
            );
        } catch {}

        await auditService.log({
            action: 'deployment.destroyed',
            entityType: 'deployment',
            entityId: id,
            metadata: { name: deployment.name },
            teamId: deployment.teamId || undefined,
        });

        await prisma.deployment.delete({ where: { id } });
    }

    async getUsage(teamId: string) {
        const records = await prisma.usageRecord.findMany({
            where: { teamId },
            orderBy: { recordedAt: 'desc' },
            take: 100,
        });
        return records;
    }

    async recordUsage(teamId: string, metric: string, value: number) {
        await prisma.usageRecord.create({
            data: { teamId, metric, value }
        });
    }

    private parseYaml(yamlStr: string): any {
        const lines = yamlStr.split('\n');
        const result: any = { services: [] };
        let currentService: any = null;
        let currentEnvVars: any[] = [];
        let insideEnvVars = false;

        for (let line of lines) {
            const trimmed = line.trim();
            if (!trimmed || trimmed.startsWith('#')) continue;

            if (trimmed.startsWith('-')) {
                if (currentService) {
                    if (currentEnvVars.length > 0) currentService.envVars = currentEnvVars;
                    result.services.push(currentService);
                }
                currentService = {};
                currentEnvVars = [];
                insideEnvVars = false;

                const rest = trimmed.slice(1).trim();
                if (rest) {
                    const parts = rest.split(':');
                    if (parts.length >= 2) {
                        const key = parts[0].trim();
                        const val = parts.slice(1).join(':').trim();
                        currentService[key] = val.replace(/['"]/g, '');
                    }
                }
            } else {
                const parts = trimmed.split(':');
                if (parts.length >= 2) {
                    const key = parts[0].trim();
                    const val = parts.slice(1).join(':').trim();

                    if (key === 'envVars') {
                        insideEnvVars = true;
                        continue;
                    }

                    if (insideEnvVars) {
                        if (key.startsWith('-')) {
                            const cleanKey = key.slice(1).trim();
                            if (cleanKey === 'key') {
                                currentEnvVars.push({ key: val.replace(/['"]/g, '') });
                            }
                        } else if (key === 'value') {
                            if (currentEnvVars.length > 0) {
                                currentEnvVars[currentEnvVars.length - 1].value = val.replace(/['"]/g, '');
                            }
                        }
                    } else if (currentService) {
                        currentService[key] = val.replace(/['"]/g, '');
                    }
                }
            }
        }

        if (currentService) {
            if (currentEnvVars.length > 0) currentService.envVars = currentEnvVars;
            result.services.push(currentService);
        }

        return result;
    }

    async validateBlueprint(gitUrl: string) {
        const id = `validate-bp-${Date.now()}`;
        const workspace = path.join(process.cwd(), 'workspaces', id);
        
        try {
            await fs.mkdir(workspace, { recursive: true });
            await git.clone(gitUrl, workspace, ['--depth', '1']);
            
            let yamlPath = path.join(workspace, 'rimble.yaml');
            let hasYaml = false;
            try {
                await fs.access(yamlPath);
                hasYaml = true;
            } catch {
                try {
                    yamlPath = path.join(workspace, 'render.yaml');
                    await fs.access(yamlPath);
                    hasYaml = true;
                } catch {}
            }
            
            if (!hasYaml) {
                throw new Error("Could not find 'rimble.yaml' or 'render.yaml' file at the root of the repository.");
            }
            
            const yamlStr = await fs.readFile(yamlPath, 'utf8');
            const spec = this.parseYaml(yamlStr);
            
            if (!spec || !Array.isArray(spec.services) || spec.services.length === 0) {
                throw new Error("Blueprint spec is invalid: 'services' must be a non-empty array.");
            }
            
            for (let i = 0; i < spec.services.length; i++) {
                const s = spec.services[i];
                if (!s.type) {
                    throw new Error(`Service at index ${i} is missing a 'type' property.`);
                }
                if (!s.name) {
                    throw new Error(`Service at index ${i} is missing a 'name' property.`);
                }
                const allowedTypes = ['app', 'postgres', 'redis', 'worker', 'cron'];
                if (!allowedTypes.includes(s.type)) {
                    throw new Error(`Service '${s.name || i}' has an invalid type '${s.type}'. Allowed types are: ${allowedTypes.join(', ')}.`);
                }
            }
            
            fs.rm(workspace, { recursive: true, force: true }).catch(() => {});
            
            return {
                valid: true,
                services: spec.services,
                yaml: yamlStr
            };
        } catch (err: any) {
            fs.rm(workspace, { recursive: true, force: true }).catch(() => {});
            return {
                valid: false,
                error: err.message || "An error occurred while validating the blueprint."
            };
        }
    }

    async provisionBlueprint(blueprintId: string, gitUrl: string, teamId?: string, region?: string) {
        this.log(blueprintId, `📂 Cloning blueprint repository: ${gitUrl}...`);
        const workspace = path.join(process.cwd(), 'workspaces', blueprintId);
        
        try {
            await fs.mkdir(workspace, { recursive: true });
            await git.clone(gitUrl, workspace, ['--depth', '1']);
            
            let yamlPath = path.join(workspace, 'rimble.yaml');
            let hasYaml = false;
            try {
                await fs.access(yamlPath);
                hasYaml = true;
            } catch {
                try {
                    yamlPath = path.join(workspace, 'render.yaml');
                    await fs.access(yamlPath);
                    hasYaml = true;
                } catch {}
            }
            
            if (!hasYaml) {
                throw new Error("Could not find 'rimble.yaml' or 'render.yaml' file at the root of the repository.");
            }
            
            const yamlStr = await fs.readFile(yamlPath, 'utf8');
            this.log(blueprintId, `📄 Read blueprint specification successfully.`);
            
            const spec = this.parseYaml(yamlStr);
            this.log(blueprintId, `ℹ️ Found ${spec.services.length} services in blueprint.`);
            await prisma.deployment.update({ 
                where: { id: blueprintId }, 
                data: { status: 'deploying', imageTag: yamlStr }
            });

            const childIds: string[] = [];

            // First pass: Provision all databases
            for (const service of spec.services) {
                if (service.type === 'postgres' || service.type === 'redis') {
                    this.log(blueprintId, `🗄️ Provisioning database: ${service.name} (${service.type})...`);
                    const db = await this.createDeployment('', service.type, service.name, {
                        teamId, region
                    });
                    childIds.push(db.id);
                }
            }

            // Wait 4 seconds for DB to start up and set status/connection urls
            if (childIds.length > 0) {
                this.log(blueprintId, `⏳ Waiting for databases to initialize...`);
                await new Promise(r => setTimeout(r, 4000));
            }

            const dbEnvVars: { key: string; value: string }[] = [];
            for (const childId of childIds) {
                const db = await prisma.deployment.findUnique({ where: { id: childId } });
                if (db && db.liveUrl) {
                    const connectionString = decrypt(db.liveUrl);
                    const envKey = db.type === 'postgres' ? 'DATABASE_URL' : 'REDIS_URL';
                    dbEnvVars.push({ key: envKey, value: connectionString });
                    this.log(blueprintId, `💡 Injected ${envKey} from ${db.name}`);
                }
            }

            // Second pass: Provision other services (apps, workers, crons)
            for (const service of spec.services) {
                if (service.type !== 'postgres' && service.type !== 'redis') {
                    this.log(blueprintId, `🚀 Building service: ${service.name} (${service.type})...`);
                    const serviceGitUrl = service.gitUrl || gitUrl;
                    const dep = await this.createDeployment(serviceGitUrl, service.type, service.name, {
                        teamId, region,
                        startCommand: service.startCommand,
                        cronSchedule: service.cronSchedule,
                    });
                    
                    const serviceEnvVars = service.envVars || [];
                    const finalEnvVars = [...serviceEnvVars, ...dbEnvVars];

                    for (const ev of finalEnvVars) {
                        await prisma.environmentVariable.create({
                            data: {
                                id: uuidv4(),
                                deploymentId: dep.id,
                                key: ev.key,
                                value: ev.value,
                            }
                        });
                    }

                    childIds.push(dep.id);
                }
            }

            // Clean up workspace folder
            fs.rm(workspace, { recursive: true, force: true }).catch(() => {});

            // Update blueprint status to running and store child IDs in liveUrl
            await prisma.deployment.update({
                where: { id: blueprintId },
                data: {
                    status: 'running',
                    liveUrl: JSON.stringify(childIds)
                }
            });
            
            this.log(blueprintId, `✅ Blueprint stack successfully provisioned!`);
        } catch (err: any) {
            this.log(blueprintId, `❌ Blueprint orchestration failed: ${err.message}`);
            fs.rm(workspace, { recursive: true, force: true }).catch(() => {});
            await prisma.deployment.update({
                where: { id: blueprintId },
                data: { status: 'failed' }
            });
        }
    }

    private async log(id: string, message: string) {
        if (!message || message.trim() === '') return;
        process.stdout.write(`[${id}] ${message.trim()}\n`);
        await prisma.log.create({ data: { content: message, deploymentId: id } }).catch(() => {});
        logEvents.emit(`logs-${id}`, message);
    }
}
