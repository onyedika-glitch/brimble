/// <reference types="node" />
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export class DockerService {
    async runContainer(
        name: string,
        image: string,
        internalPort: number,
        envVars: { key: string; value: string }[] = [],
        volumeMounts: string[] = []
    ): Promise<{ containerId: string; port: number }> {
        try { await execAsync(`docker rm -f ${name}`); } catch {}

        const envString = envVars
            .map(e => `-e ${e.key}="${e.value.replace(/"/g, '\\"')}"`)
            .join(' ');

        const volumeString = volumeMounts
            .map(v => `-v ${v}`)
            .join(' ');

        const { stdout } = await execAsync(
            `docker run -d --name ${name} --network brimble-net -p ${internalPort} ${envString} ${volumeString} ${image}`
        );
        const containerId = stdout.trim();

        await new Promise(resolve => setTimeout(resolve, 1000));

        const { stdout: inspectJson } = await execAsync(`docker inspect ${containerId}`);
        const inspect = JSON.parse(inspectJson)[0];
        const ports = inspect.NetworkSettings.Ports;

        let hostPort = '0';
        const portKey = `${internalPort}/tcp`;
        if (ports && ports[portKey] && ports[portKey][0]) {
            hostPort = ports[portKey][0].HostPort;
        }

        return { containerId, port: parseInt(hostPort, 10) };
    }

    async runDatabaseContainer(
        name: string,
        type: 'postgres' | 'redis',
        password?: string
    ): Promise<{ containerId: string; port: number }> {
        try { await execAsync(`docker rm -f ${name}`); } catch {}

        let image = '';
        let internalPort = 0;
        let envString = '';

        if (type === 'postgres') {
            image = 'postgres:15-alpine';
            internalPort = 5432;
            envString = `-e POSTGRES_PASSWORD="${password}" -e POSTGRES_DB="db" -e POSTGRES_USER="postgres"`;
        } else {
            image = 'redis:7-alpine';
            internalPort = 6379;
        }

        const { stdout } = await execAsync(
            `docker run -d --name ${name} --network brimble-net -p ${internalPort} ${envString} ${image}`
        );
        const containerId = stdout.trim();

        await new Promise(resolve => setTimeout(resolve, 2000));

        const { stdout: inspectJson } = await execAsync(`docker inspect ${containerId}`);
        const inspect = JSON.parse(inspectJson)[0];
        const ports = inspect.NetworkSettings.Ports;

        let hostPort = '0';
        const portKey = `${internalPort}/tcp`;
        if (ports && ports[portKey] && ports[portKey][0]) {
            hostPort = ports[portKey][0].HostPort;
        }

        return { containerId, port: parseInt(hostPort, 10) };
    }

    async stopContainer(name: string) {
        try {
            await execAsync(`docker stop ${name} && docker rm ${name}`);
        } catch (e) {
            console.error(`Failed to stop container ${name}:`, e);
        }
    }

    async getImageTag(name: string): Promise<string> {
        return `${name}:${Math.random().toString(36).substring(7)}`;
    }

    async getContainerStats(containerId: string): Promise<{ cpu: string; memory: string } | null> {
        try {
            const { stdout } = await execAsync(
                `docker stats ${containerId} --no-stream --format "{{.CPUPerc}}|{{.MemUsage}}"`
            );
            const parts = stdout.trim().split('|');
            if (parts.length === 2) {
                return { cpu: parts[0], memory: parts[1] };
            }
        } catch {}
        return null;
    }

    async createVolume(volumeName: string, _sizeGb: number): Promise<void> {
        await execAsync(`docker volume create ${volumeName}`);
    }

    async removeVolume(volumeName: string): Promise<void> {
        await execAsync(`docker volume rm ${volumeName}`);
    }

    async listVolumes(): Promise<string[]> {
        const { stdout } = await execAsync(`docker volume ls --format "{{.Name}}"`);
        return stdout.trim().split('\n').filter(Boolean);
    }
}
