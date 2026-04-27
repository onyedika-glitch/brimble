import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export class DockerService {
    async runContainer(name: string, image: string): Promise<{ containerId: string; port: number }> {
        // Run container with a random port mapped to whatever Port the app uses (usually 80 or 3000)
        // Run container in the same network as the backend/caddy
        const { stdout } = await execAsync(`docker run -d --name ${name} --network brimble_brimble-net -p 0:80 ${image}`);
        const containerId = stdout.trim();

        // Get the assigned port
        const { stdout: portOutput } = await execAsync(`docker port ${containerId} 80/tcp`);
        const portMatched = portOutput.match(/:(\d+)$/);
        if (!portMatched) {
            throw new Error('Could not find assigned port');
        }

        return {
            containerId,
            port: parseInt(portMatched[1], 10),
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
