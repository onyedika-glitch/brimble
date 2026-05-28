export type DeploymentStatus = 'pending' | 'building' | 'deploying' | 'running' | 'failed';

export interface EnvironmentVariable {
    id: string;
    key: string;
    value: string;
}

export interface CustomDomain {
    id: string;
    domain: string;
}

export interface Deployment {
    id: string;
    gitUrl: string | null;
    name: string;
    status: DeploymentStatus;
    imageTag: string | null;
    liveUrl: string | null;
    logs: string;
    createdAt: Date;
    updatedAt: Date;
    containerId: string | null;
    port: number | null;
    type: string;
    isPrPreview: boolean;
    prNumber: number | null;
    envVars?: EnvironmentVariable[];
    domains?: CustomDomain[];
}
