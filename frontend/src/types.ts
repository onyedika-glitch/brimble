export type DeploymentStatus = 'pending' | 'building' | 'deploying' | 'running' | 'failed' | 'stopped';
export type ResourceType = 'app' | 'postgres' | 'redis' | 'worker' | 'cron';

export interface User {
    id: string;
    email: string;
    name: string;
    avatarUrl?: string;
    createdAt: string;
}

export interface Team {
    id: string;
    name: string;
    slug: string;
    plan: 'hobby' | 'pro' | 'enterprise';
    role?: string;
}

export interface EnvironmentVariable {
    id: string;
    key: string;
}

export interface CustomDomain {
    id: string;
    domain: string;
    verified: boolean;
}

export interface Log {
    id: string;
    content: string;
    level: string;
    createdAt: string;
}

export interface PersistentDisk {
    id: string;
    name: string;
    sizeGb: number;
    mountPath: string;
    volumeName: string;
}

export interface ScalingEvent {
    id: string;
    fromReplicas: number;
    toReplicas: number;
    reason: string;
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
    containerId: string | null;
    port: number | null;
    type: ResourceType;
    region: string;
    isPrPreview: boolean;
    prNumber: number | null;
    cronSchedule: string | null;
    startCommand: string | null;
    minReplicas: number;
    maxReplicas: number;
    cpuThreshold: number;
    healthCheckPath: string;
    healthCheckInterval: number;
    healthCheckTimeout: number;
    envVars?: EnvironmentVariable[];
    domains?: CustomDomain[];
    disks?: PersistentDisk[];
    scalingEvents?: ScalingEvent[];
    logs?: Log[];
}

export interface Metrics {
    cpu: string;
    memory: string;
}

export interface AuditLog {
    id: string;
    action: string;
    entityType: string;
    entityId: string;
    metadata: string;
    createdAt: string;
    user?: { name: string; email: string };
}

export interface UsageData {
    usage: Record<string, number>;
    limits: Record<string, number>;
    plan: string;
}

export interface NotificationSetting {
    emailEnabled: boolean;
    slackWebhook: string | null;
    onSuccess: boolean;
    onFailure: boolean;
    onPrPreview: boolean;
}
