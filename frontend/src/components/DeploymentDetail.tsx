import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../api';
import { Loader2, Key, Globe, HardDrive, Activity, Heart, Scaling, CheckCircle2, Plus, Trash2 } from 'lucide-react';
import type { Deployment } from '../types';
import { Stat } from './ui';
import { LogViewer } from './LogViewer';

export function DeploymentDetail({ deployment }: { deployment: Deployment }) {
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

    const tabs = [
        { key: 'overview', label: 'Overview', icon: Activity },
        { key: 'env', label: 'Env Vars', icon: Key },
        { key: 'domains', label: 'Domains', icon: Globe },
        { key: 'disks', label: 'Disks', icon: HardDrive },
        { key: 'health', label: 'Health', icon: Heart },
        { key: 'scaling', label: 'Scaling', icon: Scaling },
        { key: 'logs', label: 'Logs', icon: Activity },
    ] as const;

    const inputCls = 'bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 transition-all w-full';
    const btnCls = 'bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-bold px-4 py-2 rounded-lg transition-all flex items-center gap-1.5 shrink-0';

    return (
        <div className="space-y-4">
            {/* Tab bar */}
            <div className="flex gap-1 bg-zinc-950 p-1 rounded-xl border border-zinc-800/60 overflow-x-auto">
                {tabs.map(({ key, label, icon: Icon }) => (
                    <button key={key} onClick={() => setTab(key as 'overview' | 'env' | 'domains' | 'disks' | 'health' | 'scaling' | 'logs')}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all whitespace-nowrap ${tab === key ? 'bg-zinc-800 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}>
                        <Icon size={11} />{label}
                    </button>
                ))}
            </div>

            {tab === 'overview' && (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    <Stat label="Status" value={deployment.status.toUpperCase()} />
                    <Stat label="Region" value={deployment.region} />
                    <Stat label="Type" value={deployment.type.toUpperCase()} />
                    <Stat label="Live URL" value={deployment.liveUrl || '—'} isUrl={deployment.type === 'app'} />
                    <Stat label="Image Tag" value={deployment.imageTag || '—'} />
                    <Stat label="Created" value={new Date(deployment.createdAt).toLocaleDateString()} />
                    {metrics && <>
                        <Stat label="CPU" value={metrics.cpu} />
                        <Stat label="Memory" value={metrics.memory} />
                    </>}
                    {deployment.type === 'cron' && <Stat label="Schedule" value={deployment.cronSchedule || '—'} />}
                    {deployment.scalingEvents && deployment.scalingEvents.length > 0 && (
                        <div className="col-span-full">
                            <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-2">Recent Scaling Events</div>
                            {deployment.scalingEvents.slice(0, 3).map(e => (
                                <div key={e.id} className="text-xs text-zinc-400 bg-zinc-900 px-3 py-1.5 rounded mb-1">
                                    {e.fromReplicas}→{e.toReplicas} replicas · {e.reason}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {tab === 'env' && (
                <div className="space-y-3">
                    {deployment.envVars?.map(env => (
                        <div key={env.id} className="flex items-center justify-between bg-zinc-950 border border-zinc-800 px-3 py-2 rounded-lg">
                            <span className="font-mono text-xs text-indigo-400">{env.key}</span>
                            <div className="flex items-center gap-3">
                                <span className="text-zinc-600 text-xs font-mono">••••••••</span>
                                <button onClick={() => delEnv.mutate(env.key)} className="text-zinc-600 hover:text-rose-400 transition-colors">
                                    <Trash2 size={12} />
                                </button>
                            </div>
                        </div>
                    ))}
                    <form onSubmit={e => { e.preventDefault(); addEnv.mutate(); }} className="flex gap-2 flex-wrap">
                        <input placeholder="KEY" value={envKey} onChange={e => setEnvKey(e.target.value.toUpperCase())} required className={`${inputCls} w-28`} />
                        <input placeholder="value" value={envValue} onChange={e => setEnvValue(e.target.value)} required className={`${inputCls} flex-1 min-w-0`} />
                        <button type="submit" disabled={addEnv.isPending} className={btnCls}>
                            {addEnv.isPending ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />} Add
                        </button>
                    </form>
                    <p className="text-[10px] text-zinc-600 italic">Values are AES-256 encrypted at rest. Adding a variable triggers a zero-downtime relaunch.</p>
                </div>
            )}

            {tab === 'domains' && (
                <div className="space-y-3">
                    <div className="flex items-center gap-2 bg-zinc-950 border border-emerald-900/40 px-3 py-2 rounded-lg">
                        <CheckCircle2 size={12} className="text-emerald-400" />
                        <span className="text-xs font-mono text-emerald-400">{deployment.name}.localhost</span>
                        <span className="ml-auto text-[10px] text-emerald-600">Auto-SSL</span>
                    </div>
                    {deployment.domains?.map(d => (
                        <div key={d.id} className="flex items-center gap-2 bg-zinc-950 border border-zinc-800 px-3 py-2 rounded-lg">
                            <CheckCircle2 size={12} className={d.verified ? 'text-emerald-400' : 'text-amber-400'} />
                            <span className="text-xs font-mono text-zinc-300">{d.domain}</span>
                            <button onClick={() => delDomain.mutate(d.id)} className="ml-auto text-zinc-600 hover:text-rose-400 transition-colors">
                                <Trash2 size={12} />
                            </button>
                        </div>
                    ))}
                    <form onSubmit={e => { e.preventDefault(); addDomain.mutate(); }} className="flex gap-2">
                        <input placeholder="app.yourdomain.com" value={domain} onChange={e => setDomain(e.target.value)} required className={`${inputCls} flex-1`} />
                        <button type="submit" disabled={addDomain.isPending} className={btnCls}>
                            {addDomain.isPending ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />} Add
                        </button>
                    </form>
                </div>
            )}

            {tab === 'disks' && (
                <div className="space-y-3">
                    {deployment.disks?.map(d => (
                        <div key={d.id} className="bg-zinc-950 border border-zinc-800 px-4 py-3 rounded-lg">
                            <div className="flex justify-between items-center">
                                <span className="text-sm font-bold text-zinc-300">{d.name}</span>
                                <span className="text-xs text-zinc-500">{d.sizeGb} GB</span>
                            </div>
                            <div className="text-xs text-zinc-500 mt-1 font-mono">mounted at {d.mountPath}</div>
                        </div>
                    ))}
                    <form onSubmit={e => { e.preventDefault(); addDisk.mutate(); }} className="space-y-2">
                        <div className="flex gap-2">
                            <input placeholder="disk-name" value={diskName} onChange={e => setDiskName(e.target.value)} required className={`${inputCls} flex-1`} />
                            <input type="number" min={1} max={100} value={diskSize} onChange={e => setDiskSize(+e.target.value)} className={`${inputCls} w-24`} />
                            <span className="text-zinc-500 text-sm self-center">GB</span>
                        </div>
                        <input placeholder="/data" value={diskMount} onChange={e => setDiskMount(e.target.value)} className={inputCls} />
                        <button type="submit" disabled={addDisk.isPending} className={`${btnCls} w-full justify-center`}>
                            {addDisk.isPending ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />} Provision Disk
                        </button>
                    </form>
                </div>
            )}

            {tab === 'health' && (
                <div className="space-y-4">
                    <div className="space-y-3">
                        <label className="block text-xs font-bold text-zinc-500 uppercase tracking-widest">Health Check Path</label>
                        <input value={hcPath} onChange={e => setHcPath(e.target.value)} className={inputCls} placeholder="/" />
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="block text-xs font-bold text-zinc-500 uppercase tracking-widest mb-1">Interval (s)</label>
                                <input type="number" min={10} max={300} value={hcInterval} onChange={e => setHcInterval(+e.target.value)} className={inputCls} />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-zinc-500 uppercase tracking-widest mb-1">Timeout (s)</label>
                                <input type="number" min={1} max={30} value={hcTimeout} onChange={e => setHcTimeout(+e.target.value)} className={inputCls} />
                            </div>
                        </div>
                        <button onClick={() => saveHealthCheck.mutate()} disabled={saveHealthCheck.isPending} className={`${btnCls} w-full justify-center`}>
                            {saveHealthCheck.isPending ? <Loader2 size={12} className="animate-spin" /> : 'Save Health Check Config'}
                        </button>
                    </div>
                </div>
            )}

            {tab === 'scaling' && (
                <div className="space-y-4">
                    <div className="grid grid-cols-3 gap-3">
                        <div>
                            <label className="block text-xs font-bold text-zinc-500 uppercase tracking-widest mb-1">Min Replicas</label>
                            <input type="number" min={1} max={10} value={minR} onChange={e => setMinR(+e.target.value)} className={inputCls} />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-zinc-500 uppercase tracking-widest mb-1">Max Replicas</label>
                            <input type="number" min={1} max={10} value={maxR} onChange={e => setMaxR(+e.target.value)} className={inputCls} />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-zinc-500 uppercase tracking-widest mb-1">CPU Threshold %</label>
                            <input type="number" min={10} max={100} value={cpuT} onChange={e => setCpuT(+e.target.value)} className={inputCls} />
                        </div>
                    </div>
                    <button onClick={() => saveScaling.mutate()} disabled={saveScaling.isPending} className={`${btnCls} w-full justify-center`}>
                        {saveScaling.isPending ? <Loader2 size={12} className="animate-spin" /> : 'Save Auto-scaling Config'}
                    </button>
                    <p className="text-[10px] text-zinc-600 italic">The engine monitors CPU usage every 30s and scales within your min/max bounds automatically.</p>
                    {deployment.scalingEvents?.map(e => (
                        <div key={e.id} className="text-xs text-zinc-400 bg-zinc-900 px-3 py-2 rounded">
                            {new Date(e.createdAt).toLocaleTimeString()} · {e.fromReplicas}→{e.toReplicas} replicas · {e.reason}
                        </div>
                    ))}
                </div>
            )}

            {tab === 'logs' && (
                <div className="h-[400px] flex flex-col">
                    <LogViewer deploymentId={id} status={deployment.status} logs={deployment.logs} />
                </div>
            )}
        </div>
    );
}
