import { prisma, logEvents } from '../index.js';
import { DockerService } from './docker.service.js';
import { simpleGit } from 'simple-git';
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs/promises';
import { v4 as uuidv4 } from 'uuid';
import axios from 'axios';

const dockerService = new DockerService();
const git = simpleGit();

export class DeploymentService {
    async createDeployment(gitUrl: string) {
        const name = uuidv4().split('-')[0];
        const deployment = await prisma.deployment.create({
            data: {
                name,
                gitUrl,
                status: 'pending',
            }
        });

        this.startPipeline(deployment.id, gitUrl, name).catch(console.error);

        return deployment;
    }

    private async startPipeline(id: string, gitUrl: string, name: string) {
        const workspace = path.join(process.cwd(), 'workspaces', id);
        await fs.mkdir(workspace, { recursive: true });

        try {
            this.log(id, `Cloning repository: ${gitUrl}...`);
            await prisma.deployment.update({ where: { id }, data: { status: 'building' } });
            await git.clone(gitUrl, workspace);

            this.log(id, `Cloning complete. Building with Railpack...`);
            const imageTag = `brimble-${name}:latest`;

            await this.runRailpackBuild(id, workspace, imageTag);

            await prisma.deployment.update({ where: { id }, data: { status: 'deploying', imageTag } });
            this.log(id, `Build complete. Deploying container...`);

            const { containerId, port } = await dockerService.runContainer(name, imageTag);

            this.log(id, `Container started on port ${port}. Configuring Caddy...`);

            const liveUrl = `http://${name}.localhost`;
            await this.configureCaddy(name, port);

            await prisma.deployment.update({
                where: { id },
                data: {
                    status: 'running',
                    containerId,
                    port,
                    liveUrl
                }
            });
            this.log(id, `Deployment successful! Available at ${liveUrl}`);

        } catch (error: any) {
            this.log(id, `Error: ${error.message}`);
            await prisma.deployment.update({ where: { id }, data: { status: 'failed' } });
        }
    }

    private async runRailpackBuild(id: string, workspace: string, imageTag: string) {
        // Smart Detection: Look for common project files in subdirectories
        let buildDir = workspace;
        const subdirs = await fs.readdir(workspace, { withFileTypes: true });

        for (const dir of subdirs) {
            if (dir.isDirectory() && !dir.name.startsWith('.')) {
                const subPath = path.join(workspace, dir.name);
                const files = await fs.readdir(subPath);
                if (files.some(f => ['package.json', 'go.mod', 'requirements.txt', 'Gemfile', 'composer.json'].includes(f))) {
                    buildDir = subPath;
                    this.log(id, `Detected project in subdirectory: ${dir.name}`);
                    break;
                }
            }
        }

        this.log(id, `BuildKit Host: ${process.env.BUILDKIT_HOST || 'NOT SET'}`);

        return new Promise<void>((resolve, reject) => {
            const child = spawn('/usr/local/bin/railpack', ['build', '--name', imageTag, '.'], {
                cwd: buildDir,
                env: { ...process.env, RAILPACK_VERBOSE: '1' }
            });

            child.stdout.on('data', (data) => {
                this.log(id, data.toString());
            });

            child.stderr.on('data', (data) => {
                this.log(id, data.toString());
            });

            child.on('close', (code) => {
                if (code === 0) resolve();
                else reject(new Error(`Railpack build failed with code ${code}`));
            });
        });
    }

    private async configureCaddy(name: string, port: number) {
        try {
            // Caddy Admin API to add a reverse proxy route
            // We assume caddy is accessible at 'caddy:2019' from the backend container
            // For local dev outside docker, it's 'localhost:2019'
            const caddyHost = process.env.CADDY_HOST || 'localhost';

            const route = {
                match: [{ host: [`${name}.localhost`] }],
                handle: [{
                    handler: 'reverse_proxy',
                    upstreams: [{ dial: `${name}:80` }]
                }]
            };

            await axios.post(`http://${caddyHost}:2019/config/apps/http/servers/srv0/routes`, route);
        } catch (e: any) {
            console.error('Failed to configure Caddy:', e.message);
            // Don't throw here, let's assume it might be optional for now or handled later
        }
    }

    private async log(id: string, message: string) {
        if (!message || message.trim() === '') return;

        console.log(`[${id}] ${message.trim()}`);

        // Persist to DB
        await prisma.log.create({
            data: {
                content: message,
                deploymentId: id
            }
        });

        // Emit for live streaming
        logEvents.emit(`logs-${id}`, message);
    }
}
