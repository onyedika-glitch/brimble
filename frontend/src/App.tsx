import { useState, useEffect } from 'react';
import { QueryClient, QueryClientProvider, useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, setToken, getToken } from './api';
import type { Deployment, User, Team } from './types';
import { AuthPage } from './components/AuthPage';
import { DeploymentDetail } from './components/DeploymentDetail';
import { TeamPanel } from './components/TeamPanel';
import { StatusBadge, ResourceIcon, PrBadge } from './components/ui';
import { Rocket, Loader2, Plus, LogOut, Database, Clock, Cpu, Globe } from 'lucide-react';

const qc = new QueryClient();

const REGIONS = ['us-east-1', 'eu-west-1', 'ap-southeast-1'];
const RESOURCE_TYPES = ['app', 'postgres', 'redis', 'worker', 'cron'] as const;

const GLOW = `
  @keyframes blob{0%{transform:translate(0,0) scale(1)}33%{transform:translate(30px,-50px) scale(1.1)}66%{transform:translate(-20px,20px) scale(.9)}100%{transform:translate(0,0) scale(1)}}
  .blob{animation:blob 7s infinite}.bd2{animation-delay:2s}.bd4{animation-delay:4s}
`;

export default function AppRoot() {
    return <QueryClientProvider client={qc}><App /></QueryClientProvider>;
}

function App() {
    const [authUser, setAuthUser] = useState<User | null>(null);
    const [teams, setTeams] = useState<Team[]>([]);
    const [selectedTeam, setSelectedTeam] = useState<Team | null>(null);
    const [selectedId, setSelectedId] = useState<string | null>(null);

    // Restore session on load
    useEffect(() => {
        const t = getToken();
        if (t) {
            api.get('/auth/me').then(r => {
                setAuthUser(r.data.user);
                setTeams(r.data.teams || []);
                if (r.data.teams?.[0]) setSelectedTeam(r.data.teams[0]);
            }).catch(() => setToken(null));
        }
    }, []);

    if (!authUser) {
        return <AuthPage onAuth={(_, user, ts) => { setAuthUser(user); setTeams(ts); if (ts[0]) setSelectedTeam(ts[0]); }} />;
    }

    return (
        <Dashboard
            user={authUser}
            teams={teams}
            selectedTeam={selectedTeam}
            onSelectTeam={setSelectedTeam}
            selectedId={selectedId}
            onSelectId={setSelectedId}
            onLogout={() => { setToken(null); setAuthUser(null); }}
        />
    );
}

function Dashboard({ user, teams, selectedTeam, onSelectTeam, selectedId, onSelectId, onLogout }: {
    user: User; teams: Team[]; selectedTeam: Team | null;
    onSelectTeam: (t: Team) => void; selectedId: string | null;
    onSelectId: (id: string | null) => void; onLogout: () => void;
}) {
    const qclient = useQueryClient();
    const [gitUrl, setGitUrl] = useState('');
    const [deployType, setDeployType] = useState<typeof RESOURCE_TYPES[number]>('app');
    const [region, setRegion] = useState('us-east-1');
    const [cronSchedule, setCronSchedule] = useState('0 * * * *');
    const [showNewForm, setShowNewForm] = useState(false);

    const { data: deployments, isLoading } = useQuery<Deployment[]>({
        queryKey: ['deployments', selectedTeam?.id],
        queryFn: () => api.get('/deployments', { params: { teamId: selectedTeam?.id } }).then(r => r.data),
        refetchInterval: 5000,
    });

    const { data: selected } = useQuery<Deployment>({
        queryKey: ['deployment', selectedId],
        queryFn: () => api.get(`/deployments/${selectedId}`).then(r => r.data),
        enabled: !!selectedId,
        refetchInterval: 5000,
    });

    const create = useMutation({
        mutationFn: () => api.post('/deployments', {
            gitUrl: (deployType === 'app' || deployType === 'worker' || deployType === 'cron') ? gitUrl : undefined,
            type: deployType,
            teamId: selectedTeam?.id,
            region,
            cronSchedule: deployType === 'cron' ? cronSchedule : undefined,
        }),
        onSuccess: (d: { data: { id: string } }) => {
            setGitUrl(''); setShowNewForm(false);
            onSelectId(d.data.id);
            qclient.invalidateQueries({ queryKey: ['deployments'] });
        },
    });

    const destroy = useMutation({
        mutationFn: (id: string) => api.delete(`/deployments/${id}`),
        onSuccess: () => { onSelectId(null); qclient.invalidateQueries({ queryKey: ['deployments'] }); },
    });

    const relaunch = useMutation({
        mutationFn: (id: string) => api.post(`/deployments/${id}/relaunch`),
        onSuccess: () => qclient.invalidateQueries({ queryKey: ['deployment', selectedId] }),
    });

    const typeIcon = (type: string) => {
        if (type === 'postgres' || type === 'redis') return Database;
        if (type === 'cron') return Clock;
        if (type === 'worker') return Cpu;
        return Globe;
    };

    return (
        <div className="min-h-screen bg-[#050505] text-zinc-100 font-sans">
            <style>{GLOW}</style>
            {/* Background blobs */}
            <div className="fixed inset-0 pointer-events-none -z-10 overflow-hidden">
                <div className="absolute -top-40 -left-40 w-96 h-96 bg-indigo-600/15 rounded-full blur-[120px] blob" />
                <div className="absolute top-1/3 -right-20 w-80 h-80 bg-blue-600/10 rounded-full blur-[100px] blob bd2" />
                <div className="absolute -bottom-40 left-1/3 w-96 h-96 bg-purple-600/10 rounded-full blur-[120px] blob bd4" />
            </div>

            {/* Header */}
            <header className="border-b border-zinc-800/50 bg-zinc-950/80 backdrop-blur-xl sticky top-0 z-50">
                <div className="max-w-7xl mx-auto px-4 h-14 flex items-center gap-4">
                    <div className="flex items-center gap-2 mr-4">
                        <div className="w-7 h-7 bg-indigo-600 rounded-lg flex items-center justify-center">
                            <Rocket size={14} className="text-white" />
                        </div>
                        <span className="font-black text-white tracking-tight">Rimble</span>
                    </div>

                    {/* Team selector */}
                    <div className="flex gap-1 overflow-x-auto">
                        {teams.map(t => (
                            <button key={t.id} onClick={() => onSelectTeam(t)}
                                className={`text-xs font-bold px-3 py-1 rounded-lg transition-all whitespace-nowrap ${selectedTeam?.id === t.id ? 'bg-zinc-800 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}>
                                {t.name}
                            </button>
                        ))}
                    </div>

                    <div className="ml-auto flex items-center gap-3">
                        <span className="text-xs text-zinc-500 hidden sm:block">{user.email}</span>
                        <button onClick={onLogout} className="text-zinc-500 hover:text-zinc-300 transition-colors">
                            <LogOut size={15} />
                        </button>
                    </div>
                </div>
            </header>

            <div className="max-w-7xl mx-auto px-4 py-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
                {/* Left sidebar */}
                <div className="lg:col-span-3 space-y-4">
                    {/* New resource */}
                    <div className="bg-zinc-900/40 border border-zinc-800/50 rounded-2xl p-4 backdrop-blur-xl">
                        <button onClick={() => setShowNewForm(!showNewForm)}
                            className="w-full flex items-center justify-between text-xs font-bold text-zinc-400 uppercase tracking-widest mb-3">
                            <span className="flex items-center gap-2"><Plus size={13} className="text-indigo-400" /> New Resource</span>
                        </button>

                        {showNewForm && (
                            <form onSubmit={e => { e.preventDefault(); create.mutate(); }} className="space-y-3">
                                {/* Type tabs */}
                                <div className="flex flex-wrap gap-1 bg-zinc-950 p-1 rounded-xl">
                                    {RESOURCE_TYPES.map(t => {
                                        const Icon = typeIcon(t);
                                        return (
                                            <button key={t} type="button" onClick={() => setDeployType(t)}
                                                className={`flex items-center gap-1 flex-1 text-[10px] font-bold uppercase py-1 rounded-lg transition-all ${deployType === t ? 'bg-zinc-800 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}>
                                                <Icon size={9} />{t}
                                            </button>
                                        );
                                    })}
                                </div>

                                {/* Region */}
                                <select value={region} onChange={e => setRegion(e.target.value)}
                                    className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-zinc-300">
                                    {REGIONS.map(r => <option key={r} value={r}>{r}</option>)}
                                </select>

                                {/* Git URL */}
                                {(deployType === 'app' || deployType === 'worker' || deployType === 'cron') && (
                                    <input type="url" placeholder="https://github.com/user/repo"
                                        value={gitUrl} onChange={e => setGitUrl(e.target.value)} required
                                        className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 transition-all" />
                                )}

                                {/* Cron schedule */}
                                {deployType === 'cron' && (
                                    <input placeholder="0 * * * *" value={cronSchedule} onChange={e => setCronSchedule(e.target.value)} required
                                        className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-xs font-mono text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 transition-all" />
                                )}

                                <button type="submit" disabled={create.isPending}
                                    className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-bold py-2 rounded-xl text-xs uppercase tracking-widest transition-all flex items-center justify-center gap-2">
                                    {create.isPending ? <Loader2 size={13} className="animate-spin" /> : `Launch ${deployType}`}
                                </button>
                            </form>
                        )}
                    </div>

                    {/* Resources list */}
                    <div className="bg-zinc-900/40 border border-zinc-800/50 rounded-2xl overflow-hidden backdrop-blur-xl">
                        <div className="p-3 border-b border-zinc-800/50 flex items-center justify-between">
                            <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Resources</span>
                            <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                        </div>
                        <div className="divide-y divide-zinc-800/50 max-h-[55vh] overflow-y-auto">
                            {isLoading && <div className="p-6 flex justify-center"><Loader2 className="animate-spin text-zinc-600" size={20} /></div>}
                            {!isLoading && deployments?.length === 0 && (
                                <div className="p-6 text-center text-zinc-600 text-xs italic">No resources yet.</div>
                            )}
                            {deployments?.map(d => (
                                <button key={d.id} onClick={() => onSelectId(d.id)}
                                    className={`w-full text-left p-3 hover:bg-zinc-800/40 transition-colors ${selectedId === d.id ? 'bg-indigo-500/5 border-l-2 border-indigo-500' : ''}`}>
                                    <div className="flex items-center justify-between mb-1">
                                        <div className="flex items-center gap-1.5">
                                            <ResourceIcon type={d.type} size={11} />
                                            <span className="font-mono text-xs font-bold text-zinc-300 truncate max-w-[100px]">{d.name}</span>
                                            {d.isPrPreview && d.prNumber && <PrBadge prNumber={d.prNumber} />}
                                        </div>
                                        <StatusBadge status={d.status} />
                                    </div>
                                    <div className="text-[10px] text-zinc-600 truncate">{d.gitUrl || `Managed ${d.type}`}</div>
                                    <div className="text-[10px] text-zinc-700 mt-0.5">{d.region}</div>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Team panel */}
                    {selectedTeam && <TeamPanel team={selectedTeam} />}
                </div>

                {/* Main content */}
                <div className="lg:col-span-9">
                    {selected ? (
                        <div className="bg-zinc-900/40 border border-zinc-800/50 rounded-3xl p-6 shadow-2xl backdrop-blur-2xl">
                            {/* Resource header */}
                            <div className="flex items-start justify-between mb-6">
                                <div>
                                    <div className="flex items-center gap-3 mb-1">
                                        <ResourceIcon type={selected.type} size={20} />
                                        <h2 className="text-2xl font-black tracking-tight text-white">{selected.name}</h2>
                                        {selected.isPrPreview && selected.prNumber && <PrBadge prNumber={selected.prNumber} />}
                                    </div>
                                    <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-zinc-600">
                                        {selected.id} · {selected.type} · {selected.region}
                                    </p>
                                </div>
                                <div className="flex items-center gap-2">
                                    {(selected.type === 'app' || selected.type === 'worker') && (
                                        <button onClick={() => relaunch.mutate(selected.id)} disabled={relaunch.isPending}
                                            className="flex items-center gap-2 px-3 py-1.5 bg-indigo-500/10 border border-indigo-500/20 rounded-xl text-indigo-400 text-xs font-bold hover:bg-indigo-500/20 transition-all disabled:opacity-50">
                                            {relaunch.isPending ? <Loader2 size={12} className="animate-spin" /> : <Rocket size={12} />} Redeploy
                                        </button>
                                    )}
                                    <button onClick={() => destroy.mutate(selected.id)} disabled={destroy.isPending}
                                        className="flex items-center gap-2 px-3 py-1.5 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-400 text-xs font-bold hover:bg-rose-500/20 transition-all disabled:opacity-50">
                                        {destroy.isPending ? <Loader2 size={12} className="animate-spin" /> : '✕'} Delete
                                    </button>
                                    <StatusBadge status={selected.status} size="lg" />
                                </div>
                            </div>

                            <DeploymentDetail deployment={selected} />
                        </div>
                    ) : (
                        <div className="h-full min-h-[500px] flex flex-col items-center justify-center border-2 border-dashed border-zinc-800/50 rounded-3xl p-12 text-zinc-600">
                            <Rocket size={40} className="mb-4 opacity-10" />
                            <p className="text-base">Select a resource to manage it</p>
                            <div className="flex flex-wrap gap-2 mt-6 opacity-40">
                                {['Zero Downtime', 'PR Previews', 'Auto-scaling', 'Live Metrics', 'Audit Logs', 'Secret Encryption'].map(f => (
                                    <span key={f} className="text-[10px] font-bold uppercase tracking-widest bg-zinc-900 border border-zinc-800 px-2.5 py-1 rounded-full">{f}</span>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
