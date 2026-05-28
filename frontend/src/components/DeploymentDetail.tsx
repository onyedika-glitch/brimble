import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../api';
import { Loader2, Key, Globe, HardDrive, Activity, Heart, Scaling, Plus, Trash2, Save, CheckCircle2, Info, Eye, EyeOff, Copy, Layers } from 'lucide-react';
import type { Deployment } from '../types';
import { Stat, ResourceIcon, StatusBadge } from './ui';
import { LogViewer } from './LogViewer';

const REGION_LABELS: Record<string, string> = {
    'us-east-1': '🇺🇸 US East',
    'eu-west-1': '🇪🇺 EU West',
    'ap-southeast-1': '🇸🇬 Asia Pacific',
};

// --- Reusable Copy Button Component ---
function CopyButton({ text }: { text: string }) {
    const [copied, setCopied] = useState(false);
    const handleCopy = () => {
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };
    return (
        <button
            onClick={handleCopy}
            type="button"
            className="p-2 rounded-lg hover:bg-zinc-800/80 text-zinc-400 hover:text-zinc-200 transition-all duration-200 active:scale-95 border border-transparent hover:border-zinc-700/50"
            title="Copy to clipboard"
        >
            {copied ? (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="animate-fadeIn">
                    <polyline points="20 6 9 17 4 12" />
                </svg>
            ) : (
                <Copy size={13} />
            )}
        </button>
    );
}

// --- Interactive Credential Field ---
function CredentialField({ label, value, isSecret = false }: { label: string; value: string; isSecret?: boolean }) {
    const [show, setShow] = useState(false);
    return (
        <div className="bg-[#111113] border border-zinc-800/50 rounded-xl p-4 flex items-center justify-between">
            <div className="min-w-0">
                <div className="text-xs font-semibold text-zinc-500 mb-1">{label}</div>
                <div className="text-sm font-mono text-zinc-200 truncate">
                    {isSecret && !show ? '••••••••••••••••' : value}
                </div>
            </div>
            <div className="flex items-center gap-1.5 shrink-0 ml-4">
                {isSecret && (
                    <button
                        onClick={() => setShow(!show)}
                        type="button"
                        className="p-2 rounded-lg hover:bg-zinc-800/80 text-zinc-400 hover:text-zinc-200 transition-all duration-200"
                        title={show ? "Hide password" : "Show password"}
                    >
                        {show ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                )}
                <CopyButton text={value} />
            </div>
        </div>
    );
}

export function DeploymentDetail({ 
    deployment, 
    allDeployments = [], 
    onSelectDeployment 
}: { 
    deployment: Deployment; 
    allDeployments?: Deployment[];
    onSelectDeployment?: (id: string) => void;
}) {
    const qc = useQueryClient();
    const id = deployment.id;

    const [envKey, setEnvKey] = useState('');
    const [envValue, setEnvValue] = useState('');
    const [domain, setDomain] = useState('');
    const [diskName, setDiskName] = useState('');
    const [diskSize, setDiskSize] = useState(1);
    const [diskMount, setDiskMount] = useState('/data');
    const [hcPath, setHcPath] = useState(deployment.healthCheckPath);
    const [hcInterval, setHcInterval] = useState(deployment.healthCheckInterval);
    const [hcTimeout, setHcTimeout] = useState(deployment.healthCheckTimeout);
    const [minR, setMinR] = useState(deployment.minReplicas);
    const [maxR, setMaxR] = useState(deployment.maxReplicas);
    const [cpuT, setCpuT] = useState(deployment.cpuThreshold);
    const [tab, setTab] = useState<'overview' | 'env' | 'domains' | 'disks' | 'health' | 'scaling' | 'logs'>('overview');

    const inv = () => qc.invalidateQueries({ queryKey: ['deployment', id] });

    const { data: metrics } = useQuery({
        queryKey: ['metrics', id],
        queryFn: () => api.get(`/deployments/${id}/metrics`).then(r => r.data),
        enabled: deployment.status === 'running',
        refetchInterval: 4000,
    });

    const addEnv = useMutation({
        mutationFn: () => api.post(`/deployments/${id}/env`, { key: envKey, value: envValue }),
        onSuccess: () => { setEnvKey(''); setEnvValue(''); inv(); },
    });

    const delEnv = useMutation({
        mutationFn: (key: string) => api.delete(`/deployments/${id}/env/${key}`),
        onSuccess: inv,
    });

    const addDomain = useMutation({
        mutationFn: () => api.post(`/deployments/${id}/domains`, { domain }),
        onSuccess: () => { setDomain(''); inv(); },
    });

    const delDomain = useMutation({
        mutationFn: (domainId: string) => api.delete(`/deployments/${id}/domains/${domainId}`),
        onSuccess: inv,
    });

    const addDisk = useMutation({
        mutationFn: () => api.post(`/deployments/${id}/disks`, { name: diskName, sizeGb: diskSize, mountPath: diskMount }),
        onSuccess: () => { setDiskName(''); inv(); },
    });

    const saveHealthCheck = useMutation({
        mutationFn: () => api.put(`/deployments/${id}/health-check`, { path: hcPath, interval: hcInterval, timeout: hcTimeout }),
        onSuccess: inv,
    });

    const saveScaling = useMutation({
        mutationFn: () => api.put(`/deployments/${id}/scaling`, { minReplicas: minR, maxReplicas: maxR, cpuThreshold: cpuT }),
        onSuccess: inv,
    });

    const isDb = deployment.type === 'postgres' || deployment.type === 'redis';
    const isBlueprint = deployment.type === 'blueprint';

    // Tabs dynamically selected depending on resource type
    const tabs = isDb ? [
        { key: 'overview', label: 'Connection Info', icon: Globe },
        { key: 'metrics', label: 'Metrics', icon: Activity },
        { key: 'logs', label: 'Logs', icon: Activity },
    ] : isBlueprint ? [
        { key: 'overview', label: 'Blueprint Stack', icon: Layers },
        { key: 'logs', label: 'Deployment Logs', icon: Activity },
    ] : [
        { key: 'overview', label: 'Overview', icon: Activity },
        { key: 'env', label: 'Environment', icon: Key },
        { key: 'domains', label: 'Domains', icon: Globe },
        { key: 'disks', label: 'Disks', icon: HardDrive },
        { key: 'health', label: 'Health Checks', icon: Heart },
        { key: 'scaling', label: 'Scaling', icon: Scaling },
        { key: 'logs', label: 'Logs', icon: Activity },
    ];

    const inputCls = 'bg-zinc-900/60 border border-zinc-800 rounded-lg px-3.5 py-2.5 text-sm text-white placeholder:text-zinc-600 transition-all hover:border-zinc-700 w-full';
    const btnPrimary = 'bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium px-4 py-2.5 rounded-lg transition-all flex items-center gap-2 shrink-0 active:scale-[0.97]';

    // Parse Connection details from the liveUrl string
    const parsePostgresConn = (connStr: string | null) => {
        if (!connStr) return null;
        try {
            // postgresql://username:password@hostname:port/database
            const regex = /^postgresql:\/\/([^:]+):([^@]+)@([^:]+):(\d+)\/(.+)$/;
            const match = connStr.match(regex);
            if (!match) return null;
            return {
                username: match[1],
                password: match[2],
                internalHost: match[3],
                internalPort: match[4],
                database: match[5],
                externalHost: 'localhost',
                externalPort: deployment.port || 5432,
                internalConn: connStr,
                externalConn: `postgresql://${match[1]}:${match[2]}@localhost:${deployment.port || 5432}/${match[5]}`
            };
        } catch {
            return null;
        }
    };

    const parseRedisConn = (connStr: string | null) => {
        if (!connStr) return null;
        try {
            // redis://hostname:port
            const regex = /^redis:\/\/([^:]+):(\d+)$/;
            const match = connStr.match(regex);
            if (!match) return null;
            return {
                internalHost: match[1],
                internalPort: match[2],
                externalHost: 'localhost',
                externalPort: deployment.port || 6379,
                internalConn: connStr,
                externalConn: `redis://localhost:${deployment.port || 6379}`
            };
        } catch {
            return null;
        }
    };

    const pgInfo = deployment.type === 'postgres' ? parsePostgresConn(deployment.liveUrl) : null;
    const redisInfo = deployment.type === 'redis' ? parseRedisConn(deployment.liveUrl) : null;

    return (
        <div className="space-y-6">
            {/* Tab navigation */}
            <div className="flex gap-1 border-b border-zinc-800/60 overflow-x-auto" id="detail-tabs">
                {tabs.map(({ key, label, icon: Icon }) => (
                    <button
                        key={key}
                        onClick={() => setTab(key as typeof tab)}
                        id={`tab-${key}`}
                        className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-all whitespace-nowrap border-b-2 -mb-px ${
                            tab === key
                                ? 'text-white border-indigo-500'
                                : 'text-zinc-500 hover:text-zinc-300 border-transparent hover:border-zinc-700'
                        }`}
                    >
                        <Icon size={14} />{label}
                    </button>
                ))}
            </div>

            {/* Tab content */}
            <div className="animate-fadeIn">
                {/* --- Overview for Non-Database types --- */}
                {tab === 'overview' && !isDb && !isBlueprint && (
                    <div className="space-y-6">
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                            <Stat label="Status" value={deployment.status.charAt(0).toUpperCase() + deployment.status.slice(1)} />
                            <Stat label="Region" value={REGION_LABELS[deployment.region] || deployment.region} />
                            <Stat label="Type" value={deployment.type.toUpperCase()} />
                            <Stat label="Live URL" value={deployment.liveUrl || '—'} isUrl={deployment.type === 'app'} />
                            <Stat label="Image" value={deployment.imageTag || '—'} />
                            <Stat label="Created" value={new Date(deployment.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} />
                            {metrics && <>
                                <Stat label="CPU Usage" value={metrics.cpu} />
                                <Stat label="Memory" value={metrics.memory} />
                            </>}
                            {deployment.type === 'cron' && <Stat label="Schedule" value={deployment.cronSchedule || '—'} />}
                        </div>

                        {/* Scaling events */}
                        {deployment.scalingEvents && deployment.scalingEvents.length > 0 && (
                            <div>
                                <h3 className="text-sm font-medium text-zinc-400 mb-3">Recent Scaling Events</h3>
                                <div className="space-y-2">
                                    {deployment.scalingEvents.slice(0, 5).map(e => (
                                        <div key={e.id} className="flex items-center gap-3 text-sm text-zinc-400 bg-zinc-900/50 border border-zinc-800/50 px-4 py-2.5 rounded-lg">
                                            <Scaling size={14} className="text-indigo-400 shrink-0" />
                                            <span>{e.fromReplicas} → {e.toReplicas} replicas</span>
                                            <span className="text-zinc-600">·</span>
                                            <span className="text-zinc-500">{e.reason}</span>
                                            <span className="ml-auto text-xs text-zinc-600">{new Date(e.createdAt).toLocaleTimeString()}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* --- Overview for Blueprint type --- */}
                {tab === 'overview' && isBlueprint && (
                    <div className="space-y-6">
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                            <Stat label="Status" value={deployment.status.charAt(0).toUpperCase() + deployment.status.slice(1)} />
                            <Stat label="Region" value={REGION_LABELS[deployment.region] || deployment.region} />
                            <Stat label="Type" value="BLUEPRINT STACK" />
                            <Stat label="Created" value={new Date(deployment.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} />
                        </div>

                        {/* Stack Services checklist/list */}
                        <div className="bg-[#111113] border border-zinc-800/60 rounded-2xl p-6 space-y-4">
                            <h3 className="text-sm font-bold text-zinc-300 uppercase tracking-widest flex items-center gap-2">
                                <Layers size={14} className="text-pink-400" />
                                Stack Services
                            </h3>
                            
                            {(() => {
                                let childDeployments: Deployment[] = [];
                                if (deployment.liveUrl) {
                                    try {
                                        const childIds = JSON.parse(deployment.liveUrl);
                                        if (Array.isArray(childIds)) {
                                            childDeployments = allDeployments.filter(d => d && childIds.includes(d.id));
                                        }
                                    } catch {}
                                }

                                if (childDeployments.length === 0) {
                                    return (
                                        <div className="text-xs text-zinc-500 py-2">
                                            Parsing specification and provisioning stack services...
                                        </div>
                                    );
                                }

                                return (
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                                        {childDeployments.map(child => (
                                            <button
                                                key={child.id}
                                                type="button"
                                                onClick={() => onSelectDeployment?.(child.id)}
                                                className="w-full text-left bg-zinc-900/30 hover:bg-zinc-800/40 border border-zinc-800/80 hover:border-indigo-500/35 rounded-xl p-4 flex items-center justify-between transition-all duration-200 group active:scale-[0.98]"
                                            >
                                                <div className="flex items-center gap-3 min-w-0">
                                                    <ResourceIcon type={child.type} size={15} withBg />
                                                    <div className="min-w-0">
                                                        <div className="text-xs font-bold text-zinc-200 group-hover:text-indigo-400 transition-colors truncate">
                                                            {child.name}
                                                        </div>
                                                        <div className="text-[10px] text-zinc-500 uppercase mt-0.5 tracking-wider">
                                                            {child.type}
                                                        </div>
                                                    </div>
                                                </div>
                                                <StatusBadge status={child.status} />
                                            </button>
                                        ))}
                                    </div>
                                );
                            })()}
                        </div>

                        {/* Read-only spec editor */}
                        <div className="bg-[#111113] border border-zinc-800/60 rounded-2xl p-6">
                            <div className="flex justify-between items-center mb-3">
                                <h3 className="text-xs font-bold text-zinc-300 uppercase tracking-widest">rimble.yaml Specification</h3>
                                <span className="text-[10px] font-bold bg-pink-500/10 text-pink-400 px-2 py-0.5 rounded border border-pink-500/20 uppercase tracking-wide">
                                    Active Blueprint
                                </span>
                            </div>
                            <pre className="bg-[#0c0c0e] border border-zinc-800/80 rounded-xl p-4 overflow-x-auto text-xs font-mono text-pink-300 leading-relaxed max-h-[300px] select-all">
                                {deployment.gitUrl}
                            </pre>
                        </div>
                    </div>
                )}

                {/* --- Overview / Connection Info for Postgres --- */}
                {tab === 'overview' && deployment.type === 'postgres' && pgInfo && (
                    <div className="space-y-6">
                        {/* Connection Strings Card */}
                        <div className="bg-[#111113] border border-zinc-800/60 rounded-2xl p-6 space-y-5">
                            <h3 className="text-sm font-bold text-zinc-300 uppercase tracking-widest">PostgreSQL Connection Strings</h3>

                            {/* Internal String */}
                            <div>
                                <label className="block text-xs font-semibold text-zinc-500 mb-1.5">Internal Connection String (in-network)</label>
                                <div className="flex bg-[#0c0c0e] border border-zinc-800/80 rounded-xl p-3.5 items-center justify-between">
                                    <span className="font-mono text-xs text-zinc-300 select-all truncate mr-4">{pgInfo.internalConn}</span>
                                    <CopyButton text={pgInfo.internalConn} />
                                </div>
                                <p className="text-[11px] text-zinc-600 mt-1">Use this to connect inside Brimble from other services in the same network.</p>
                            </div>

                            {/* External String */}
                            <div>
                                <label className="block text-xs font-semibold text-zinc-500 mb-1.5">External Connection String (host access)</label>
                                <div className="flex bg-[#0c0c0e] border border-zinc-800/80 rounded-xl p-3.5 items-center justify-between">
                                    <span className="font-mono text-xs text-indigo-400 select-all truncate mr-4">{pgInfo.externalConn}</span>
                                    <CopyButton text={pgInfo.externalConn} />
                                </div>
                                <p className="text-[11px] text-zinc-600 mt-1">Use this to connect from your local machine or external DB managers.</p>
                            </div>
                        </div>

                        {/* Database Credentials Matrix */}
                        <div>
                            <h3 className="text-sm font-semibold text-zinc-400 mb-3">Database Credentials</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <CredentialField label="Username" value={pgInfo.username} />
                                <CredentialField label="Password" value={pgInfo.password} isSecret />
                                <CredentialField label="Database Name" value={pgInfo.database} />
                                <CredentialField label="Internal Hostname" value={pgInfo.internalHost} />
                                <CredentialField label="External Hostname" value={pgInfo.externalHost} />
                                <CredentialField label="Internal Port" value={pgInfo.internalPort} />
                                <CredentialField label="External Port" value={String(pgInfo.externalPort)} />
                            </div>
                        </div>
                    </div>
                )}

                {/* --- Overview / Connection Info for Redis --- */}
                {tab === 'overview' && deployment.type === 'redis' && redisInfo && (
                    <div className="space-y-6">
                        {/* Connection Strings Card */}
                        <div className="bg-[#111113] border border-zinc-800/60 rounded-2xl p-6 space-y-5">
                            <h3 className="text-sm font-bold text-zinc-300 uppercase tracking-widest">Redis Connection Strings</h3>

                            {/* Internal String */}
                            <div>
                                <label className="block text-xs font-semibold text-zinc-500 mb-1.5">Internal Connection String (in-network)</label>
                                <div className="flex bg-[#0c0c0e] border border-zinc-800/80 rounded-xl p-3.5 items-center justify-between">
                                    <span className="font-mono text-xs text-zinc-300 select-all truncate mr-4">{redisInfo.internalConn}</span>
                                    <CopyButton text={redisInfo.internalConn} />
                                </div>
                                <p className="text-[11px] text-zinc-600 mt-1">Use this to connect inside Brimble from other services in the same network.</p>
                            </div>

                            {/* External String */}
                            <div>
                                <label className="block text-xs font-semibold text-zinc-500 mb-1.5">External Connection String (host access)</label>
                                <div className="flex bg-[#0c0c0e] border border-zinc-800/80 rounded-xl p-3.5 items-center justify-between">
                                    <span className="font-mono text-xs text-indigo-400 select-all truncate mr-4">{redisInfo.externalConn}</span>
                                    <CopyButton text={redisInfo.externalConn} />
                                </div>
                                <p className="text-[11px] text-zinc-600 mt-1">Use this to connect from your local machine or external DB managers.</p>
                            </div>
                        </div>

                        {/* Database Credentials Matrix */}
                        <div>
                            <h3 className="text-sm font-semibold text-zinc-400 mb-3">Connection Details</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <CredentialField label="Internal Hostname" value={redisInfo.internalHost} />
                                <CredentialField label="Internal Port" value={redisInfo.internalPort} />
                                <CredentialField label="External Hostname" value={redisInfo.externalHost} />
                                <CredentialField label="External Port" value={String(redisInfo.externalPort)} />
                            </div>
                        </div>
                    </div>
                )}

                {/* --- Metrics Tab --- */}
                {tab === 'metrics' && (
                    <div className="space-y-4">
                        {metrics ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <Stat label="CPU Usage" value={metrics.cpu} />
                                <Stat label="Memory Usage" value={metrics.memory} />
                            </div>
                        ) : (
                            <div className="flex items-center gap-2 text-sm text-zinc-500 py-10 justify-center">
                                <Loader2 size={16} className="animate-spin text-zinc-600" />
                                <span>Loading database resource metrics...</span>
                            </div>
                        )}
                    </div>
                )}

                {/* --- Env Vars Tab (Non-DB only) --- */}
                {tab === 'env' && !isDb && (
                    <div className="space-y-4">
                        <div className="flex items-start gap-2 text-sm text-zinc-500 bg-zinc-900/30 border border-zinc-800/40 rounded-lg p-3">
                            <Info size={14} className="mt-0.5 shrink-0 text-indigo-400" />
                            Values are AES-256 encrypted at rest. Adding or removing a variable triggers a zero-downtime relaunch.
                        </div>

                        {deployment.envVars?.map(env => (
                            <div key={env.id} className="flex items-center justify-between bg-zinc-900/50 border border-zinc-800/50 px-4 py-3 rounded-lg group">
                                <div className="flex items-center gap-3">
                                    <Key size={14} className="text-indigo-400" />
                                    <span className="font-mono text-sm text-zinc-200">{env.key}</span>
                                </div>
                                <div className="flex items-center gap-3">
                                    <span className="text-zinc-600 text-sm font-mono">••••••••</span>
                                    <button
                                        onClick={() => delEnv.mutate(env.key)}
                                        className="text-zinc-600 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100 p-1 rounded"
                                    >
                                        <Trash2 size={14} />
                                    </button>
                                </div>
                            </div>
                        ))}

                        <form onSubmit={e => { e.preventDefault(); addEnv.mutate(); }} className="flex gap-2 items-end">
                            <div className="w-40">
                                <label className="block text-xs font-medium text-zinc-500 mb-1">Key</label>
                                <input placeholder="API_KEY" value={envKey} onChange={e => setEnvKey(e.target.value.toUpperCase())} required className={inputCls} />
                            </div>
                            <div className="flex-1 min-w-0">
                                <label className="block text-xs font-medium text-zinc-500 mb-1">Value</label>
                                <input placeholder="Enter value..." value={envValue} onChange={e => setEnvValue(e.target.value)} required className={inputCls} />
                            </div>
                            <button type="submit" disabled={addEnv.isPending} className={btnPrimary}>
                                {addEnv.isPending ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />} Add
                            </button>
                        </form>
                    </div>
                )}

                {/* --- Domains Tab (Non-DB only) --- */}
                {tab === 'domains' && !isDb && (
                    <div className="space-y-4">
                        {/* Default domain */}
                        <div className="flex items-center justify-between bg-emerald-500/5 border border-emerald-500/15 px-4 py-3 rounded-lg">
                            <div className="flex items-center gap-3">
                                <CheckCircle2 size={16} className="text-emerald-400" />
                                <div>
                                    <span className="text-sm font-mono text-emerald-400">{deployment.name}.localhost</span>
                                    <span className="ml-3 text-xs text-emerald-500/60">Default</span>
                                </div>
                            </div>
                            <span className="text-xs text-emerald-500/60 font-medium">Auto-configured</span>
                        </div>

                        {/* Custom domains */}
                        {deployment.domains?.map(d => (
                            <div key={d.id} className="flex items-center justify-between bg-zinc-900/50 border border-zinc-800/50 px-4 py-3 rounded-lg group">
                                <div className="flex items-center gap-3">
                                    <CheckCircle2 size={16} className={d.verified ? 'text-emerald-400' : 'text-amber-400'} />
                                    <div>
                                        <span className="text-sm font-mono text-zinc-200">{d.domain}</span>
                                        <span className={`ml-3 text-xs ${d.verified ? 'text-emerald-500/60' : 'text-amber-500/60'}`}>
                                            {d.verified ? 'Verified' : 'Pending verification'}
                                        </span>
                                    </div>
                                </div>
                                <button onClick={() => delDomain.mutate(d.id)} className="text-zinc-600 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100 p-1">
                                    <Trash2 size={14} />
                                </button>
                            </div>
                        ))}

                        <form onSubmit={e => { e.preventDefault(); addDomain.mutate(); }} className="flex gap-2">
                            <input placeholder="app.yourdomain.com" value={domain} onChange={e => setDomain(e.target.value)} required className={`${inputCls} flex-1`} />
                            <button type="submit" disabled={addDomain.isPending} className={btnPrimary}>
                                {addDomain.isPending ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />} Add Domain
                            </button>
                        </form>
                    </div>
                )}

                {/* --- Disks Tab (Non-DB only) --- */}
                {tab === 'disks' && !isDb && (
                    <div className="space-y-4">
                        {deployment.disks?.map(d => (
                            <div key={d.id} className="bg-zinc-900/50 border border-zinc-800/50 px-5 py-4 rounded-lg">
                                <div className="flex justify-between items-center mb-1">
                                    <div className="flex items-center gap-2">
                                        <HardDrive size={14} className="text-indigo-400" />
                                        <span className="text-sm font-semibold text-zinc-200">{d.name}</span>
                                    </div>
                                    <span className="text-xs text-zinc-500 bg-zinc-800 px-2 py-0.5 rounded-md">{d.sizeGb} GB</span>
                                </div>
                                <div className="text-xs text-zinc-500 font-mono ml-6">Mount: {d.mountPath}</div>
                            </div>
                        ))}

                        <div className="bg-zinc-900/30 border border-zinc-800/40 rounded-lg p-5">
                            <h4 className="text-sm font-medium text-zinc-300 mb-4">Provision New Disk</h4>
                            <form onSubmit={e => { e.preventDefault(); addDisk.mutate(); }} className="space-y-3">
                                <div className="flex gap-3">
                                    <div className="flex-1">
                                        <label className="block text-xs font-medium text-zinc-500 mb-1">Name</label>
                                        <input placeholder="data-disk" value={diskName} onChange={e => setDiskName(e.target.value)} required className={inputCls} />
                                    </div>
                                    <div className="w-28">
                                        <label className="block text-xs font-medium text-zinc-500 mb-1">Size (GB)</label>
                                        <input type="number" min={1} max={100} value={diskSize} onChange={e => setDiskSize(+e.target.value)} className={inputCls} />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-zinc-500 mb-1">Mount Path</label>
                                    <input placeholder="/data" value={diskMount} onChange={e => setDiskMount(e.target.value)} className={inputCls} />
                                </div>
                                <button type="submit" disabled={addDisk.isPending} className={`${btnPrimary} w-full justify-center`}>
                                    {addDisk.isPending ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />} Provision Disk
                                </button>
                            </form>
                        </div>
                    </div>
                )}

                {/* --- Health Checks Tab (Non-DB only) --- */}
                {tab === 'health' && !isDb && (
                    <div className="bg-zinc-900/30 border border-zinc-800/40 rounded-lg p-6 max-w-xl">
                        <h4 className="text-sm font-medium text-zinc-200 mb-5">Health Check Configuration</h4>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-xs font-medium text-zinc-500 mb-1.5">Health Check Path</label>
                                <input value={hcPath} onChange={e => setHcPath(e.target.value)} className={inputCls} placeholder="/" />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-medium text-zinc-500 mb-1.5">Check Interval (s)</label>
                                    <input type="number" min={10} max={300} value={hcInterval} onChange={e => setHcInterval(+e.target.value)} className={inputCls} />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-zinc-500 mb-1.5">Timeout (s)</label>
                                    <input type="number" min={1} max={30} value={hcTimeout} onChange={e => setHcTimeout(+e.target.value)} className={inputCls} />
                                </div>
                            </div>
                            <button onClick={() => saveHealthCheck.mutate()} disabled={saveHealthCheck.isPending} className={`${btnPrimary} w-full justify-center`}>
                                {saveHealthCheck.isPending ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Save Configuration
                            </button>
                        </div>
                    </div>
                )}

                {/* --- Scaling Tab (Non-DB only) --- */}
                {tab === 'scaling' && !isDb && (
                    <div className="space-y-6">
                        <div className="bg-zinc-900/30 border border-zinc-800/40 rounded-lg p-6 max-w-xl">
                            <h4 className="text-sm font-medium text-zinc-200 mb-5">Auto-scaling Rules</h4>
                            <div className="grid grid-cols-3 gap-4 mb-5">
                                <div>
                                    <label className="block text-xs font-medium text-zinc-500 mb-1.5">Min Replicas</label>
                                    <input type="number" min={1} max={10} value={minR} onChange={e => setMinR(+e.target.value)} className={inputCls} />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-zinc-500 mb-1.5">Max Replicas</label>
                                    <input type="number" min={1} max={10} value={maxR} onChange={e => setMaxR(+e.target.value)} className={inputCls} />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-zinc-500 mb-1.5">CPU Threshold %</label>
                                    <input type="number" min={10} max={100} value={cpuT} onChange={e => setCpuT(+e.target.value)} className={inputCls} />
                                </div>
                            </div>
                            <button onClick={() => saveScaling.mutate()} disabled={saveScaling.isPending} className={`${btnPrimary} w-full justify-center`}>
                                {saveScaling.isPending ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Save Scaling Config
                            </button>
                            <p className="text-xs text-zinc-600 mt-3">
                                The engine monitors CPU usage every 30s and scales within your min/max bounds automatically.
                            </p>
                        </div>

                        {/* Scaling events */}
                        {deployment.scalingEvents && deployment.scalingEvents.length > 0 && (
                            <div>
                                <h4 className="text-sm font-medium text-zinc-400 mb-3">Event History</h4>
                                <div className="space-y-2">
                                    {deployment.scalingEvents.map(e => (
                                        <div key={e.id} className="flex items-center gap-3 text-sm text-zinc-400 bg-zinc-900/50 border border-zinc-800/50 px-4 py-2.5 rounded-lg">
                                            <Scaling size={14} className="text-violet-400 shrink-0" />
                                            <span>{e.fromReplicas} → {e.toReplicas}</span>
                                            <span className="text-zinc-600">·</span>
                                            <span className="text-zinc-500">{e.reason}</span>
                                            <span className="ml-auto text-xs text-zinc-600">{new Date(e.createdAt).toLocaleTimeString()}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* --- Logs Tab --- */}
                {tab === 'logs' && (
                    <div className="h-[500px] flex flex-col">
                        <LogViewer deploymentId={id} status={deployment.status} logs={deployment.logs} />
                    </div>
                )}
            </div>
        </div>
    );
}
