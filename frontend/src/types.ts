export type DeploymentStatus = 'pending' | 'building' | 'deploying' | 'running' | 'failed';

export interface Log {
    id: string;
    content: string;
    createdAt: string;
}

export interface Deployment {
    id: string;
    gitUrl: string | null;
    name: string;
    status: DeploymentStatus;
    imageTag: string | null;
    liveUrl: string | null;
    createdAt: string;
    updatedAt: string;
    logs?: Log[];
}
