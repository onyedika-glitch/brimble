import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export class DockerService {
    async runContainer(name: string, image: string, internalPort: number): Promise<{ containerId: string; port: number }> {
        // Clean up any old container with the same name
        try {
            await execAsync(`docker rm -f ${name}`);
        } catch (e) {
            // Ignore
        }

        // Run container mapping the standardized internal port (80)
        const { stdout } = await execAsync(`docker run -d --name ${name} --network brimble-net -p ${internalPort} ${image}`);
        const containerId = stdout.trim();

        // Wait a moment for it to stabilize
        await new Promise(resolve => setTimeout(resolve, 1000));

        // Get the host port that Docker assigned
        const { stdout: inspectJson } = await execAsync(`docker inspect ${containerId}`);
        const inspect = JSON.parse(inspectJson)[0];
        const ports = inspect.NetworkSettings.Ports;

        let hostPort = '';
        const portKey = `${internalPort}/tcp`;
        if (ports[portKey] && ports[portKey][0]) {
            hostPort = ports[portKey][0].HostPort;
        }

        if (!hostPort) {
            throw new Error(`Failed to map port ${internalPort}.`);
        }

        return {
            containerId,
            port: parseInt(hostPort, 10),
        };
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
}
