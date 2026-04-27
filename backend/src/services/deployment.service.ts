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
        const id = uuidv4();
        const name = id.split('-')[0];
        const deployment = await prisma.deployment.create({
            data: {
                id,
                name,
                gitUrl,
                status: 'pending',
            }
        });

        this.startPipeline(id, gitUrl, name).catch(console.error);

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

            const { buildDir } = await this.runRailpackBuild(id, workspace, imageTag);

            await prisma.deployment.update({ where: { id }, data: { status: 'deploying', imageTag } });
            this.log(id, `Build complete. Deploying container...`);

            // We use 80 as the standard internal port for all projects now
            const internalPort = 80;
            const { containerId, port: hostPort } = await dockerService.runContainer(name, imageTag, internalPort);

            this.log(id, `Container started. Configuring Caddy...`);

            const liveUrl = `http://${name}.localhost:8080`;
            await this.configureCaddy(id, name, internalPort);

            // Health check
            this.log(id, `Waiting for ${name} to respond on port ${internalPort}...`);
            let healthy = false;
            for (let i = 0; i < 15; i++) {
                try {
                    await axios.get(`http://${name}:${internalPort}`, { timeout: 2000 });
                    healthy = true;
                    this.log(id, `✅ App is healthy and responding!`);
                    break;
                } catch (e) {
                    await new Promise(resolve => setTimeout(resolve, 2000));
                }
            }

            await prisma.deployment.update({
                where: { id },
                data: {
                    status: 'running',
                    containerId,
                    port: hostPort,
                    liveUrl
                }
            });
            this.log(id, `Deployment successful! Available at ${liveUrl}`);

        } catch (error: any) {
            this.log(id, `Error: ${error.message}`);
            await prisma.deployment.update({ where: { id }, data: { status: 'failed' } });
        }
    }

    private async runRailpackBuild(id: string, workspace: string, imageTag: string): Promise<{ buildDir: string }> {
        let buildDir = workspace;
        const subdirs = await fs.readdir(workspace, { withFileTypes: true });

        for (const dir of subdirs) {
            if (dir.isDirectory() && !dir.name.startsWith('.')) {
                const subPath = path.join(workspace, dir.name);
                const files = await fs.readdir(subPath);
                if (files.some(f => ['package.json', 'go.mod', 'requirements.txt', 'index.js', 'index.html'].includes(f))) {
                    buildDir = subPath;
                    this.log(id, `🚀 Detected project in: ${dir.name}`);
                    break;
                }
            }
        }

        const pkgPath = path.join(buildDir, 'package.json');
        const hasPackageJson = await fs.access(pkgPath).then(() => true).catch(() => false);

        return new Promise((resolve, reject) => {
            const args = ['build', '--name', imageTag, '.'];
            if (hasPackageJson) {
                // Force Port 80 for Node apps too
                args.splice(3, 0, '--start-cmd', `PORT=80 npm start`);
            }

            const child = spawn('/usr/local/bin/railpack', args, {
                cwd: buildDir,
                env: { ...process.env, RAILPACK_VERBOSE: '1', PORT: '80' }
            });

            child.stdout.on('data', (data) => this.log(id, data.toString()));
            child.stderr.on('data', (data) => this.log(id, data.toString()));

            child.on('close', (code) => {
                if (code === 0) resolve({ buildDir });
                else reject(new Error(`Railpack build failed with code ${code}`));
            });
        });
    }

    private async configureCaddy(id: string, name: string, internalPort: number) {
        try {
            const caddyHost = process.env.CADDY_HOST || 'localhost';
            const route = {
                match: [{ host: [`${name}.localhost`, `${name}.localhost:8080`] }],
                handle: [{
                    handler: 'reverse_proxy',
                    upstreams: [{ dial: `${name}:${internalPort}` }]
                }]
            };
            await axios.post(`http://${caddyHost}:2019/config/apps/http/servers/srv0/routes/0`, route);
            this.log(id, `🚀 Caddy routing enabled.`);
        } catch (e: any) {
            this.log(id, `Failed to configure Caddy: ${e.message}`);
        }
    }

    private async log(id: string, message: string) {
        if (!message || message.trim() === '') return;
        process.stdout.write(`[${id}] ${message.trim()}\n`);
        await prisma.log.create({ data: { content: message, deploymentId: id } }).catch(() => { });
        logEvents.emit(`logs-${id}`, message);
    }
}
