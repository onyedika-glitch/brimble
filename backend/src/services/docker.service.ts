import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export class DockerService {
    async runContainer(name: string, image: string): Promise<{ containerId: string; port: number }> {
        // Run container with a random port mapped to whatever Port the app uses (usually 80 or 3000)
        // Run container in the same network as the backend/caddy
        const { stdout } = await execAsync(`docker run -d --name ${name} --network brimble-net -p 80 ${image}`);
        const containerId = stdout.trim();

        // Get the assigned host port automatically
        const { stdout: inspectOutput } = await execAsync(`docker inspect --format='{{(index (index .NetworkSettings.Ports "80/tcp") 0).HostPort}}' ${containerId}`);
        const hostPort = inspectOutput.trim();

        if (!hostPort) {
            throw new Error('Could not determine host port for the container');
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
