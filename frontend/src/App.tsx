import { useState, useEffect } from 'react';
import { QueryClient, QueryClientProvider, useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, setToken, getToken } from './api';
import type { Deployment, User, Team } from './types';
import { AuthPage } from './components/AuthPage';
import { DeploymentDetail } from './components/DeploymentDetail';
import { TeamPanel } from './components/TeamPanel';
import { StatusBadge, ResourceIcon, PrBadge, EmptyState } from './components/ui';
import {
    Rocket, Loader2, Plus, LogOut, Globe, ChevronDown,
    Search, LayoutGrid, X, Users, Layers
} from 'lucide-react';

const qc = new QueryClient();

const REGIONS = ['us-east-1', 'eu-west-1', 'ap-southeast-1'];
const RESOURCE_TYPES = ['app', 'postgres', 'redis', 'worker', 'cron', 'blueprint'] as const;

const REGION_LABELS: Record<string, string> = {
    'us-east-1': '🇺🇸 US East',
    'eu-west-1': '🇪🇺 EU West',
    'ap-southeast-1': '🇸🇬 Asia Pacific',
};

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
            onSelectTeam={(t) => {
                setSelectedTeam(t);
                setSelectedId(null);
            }}
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
    const [customName, setCustomName] = useState('');
    const [deployType, setDeployType] = useState<typeof RESOURCE_TYPES[number]>('app');
    const [region, setRegion] = useState('us-east-1');
    const [cronSchedule, setCronSchedule] = useState('0 * * * *');
    const [showNewModal, setShowNewModal] = useState(false);
    const [searchFilter, setSearchFilter] = useState('');
    const [showTeamDropdown, setShowTeamDropdown] = useState(false);

    const [bpValidation, setBpValidation] = useState<{
        status: 'idle' | 'loading' | 'valid' | 'invalid';
        error?: string;
        services?: { name: string; type: string }[];
    }>({ status: 'idle' });

    const handleVerifyBlueprint = async () => {
        if (!gitUrl) return;
        setBpValidation({ status: 'loading' });
        try {
            const res = await api.post('/deployments/validate-blueprint', { gitUrl });
            if (res.data.valid) {
                setBpValidation({
                    status: 'valid',
                    services: res.data.services
                });
            } else {
                setBpValidation({
                    status: 'invalid',
                    error: res.data.error || 'The blueprint file is invalid.'
                });
            }
        } catch (err) {
            const axiosErr = err as { response?: { data?: { error?: string } }; message?: string };
            setBpValidation({
                status: 'invalid',
                error: axiosErr.response?.data?.error || axiosErr.message || 'Verification request failed.'
            });
        }
    };

    const { data: deployments, isLoading } = useQuery<Deployment[]>({
        queryKey: ['deployments', selectedTeam?.id],
        queryFn: () => api.get('/deployments', { params: { teamId: selectedTeam?.id } }).then(r => r.data),
        refetchInterval: 5000,
    });

    const { data: selected } = useQuery<Deployment>({
        queryKey: ['deployment', selectedId],
        queryFn: () => api.get(`/deployments/${selectedId}`).then(r => r.data),
        enabled: !!selectedId && selectedId !== 'team-settings',
        refetchInterval: 5000,
    });

    const create = useMutation({
        mutationFn: () => api.post('/deployments', {
            name: customName || undefined,
            gitUrl: (deployType === 'app' || deployType === 'worker' || deployType === 'cron' || deployType === 'blueprint') ? gitUrl : undefined,
            type: deployType,
            teamId: selectedTeam?.id,
            region,
            cronSchedule: deployType === 'cron' ? cronSchedule : undefined,
        }),
        onSuccess: (d: { data: { id: string } }) => {
            setGitUrl('');
            setCustomName('');
            setShowNewModal(false);
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

    const filtered = deployments?.filter(d =>
        !searchFilter ||
        d.name.toLowerCase().includes(searchFilter.toLowerCase()) ||
        d.type.toLowerCase().includes(searchFilter.toLowerCase())
    );

    const liveCount = deployments?.filter(d => d.status === 'running').length ?? 0;

    const userInitial = user.name?.charAt(0)?.toUpperCase() || user.email?.charAt(0)?.toUpperCase() || '?';

    return (
        <div className="min-h-screen bg-[#09090b] text-zinc-100">
            {/* ─── Top Navigation Bar ─── */}
            <header className="border-b border-zinc-800/60 bg-[#0c0c0e]/90 backdrop-blur-xl sticky top-0 z-50" id="navbar">
                <div className="max-w-[1400px] mx-auto px-6 h-14 flex items-center gap-4">
                    {/* Logo */}
                    <button onClick={() => onSelectId(null)} className="flex items-center gap-2.5 mr-2 hover:opacity-80 transition-opacity" id="nav-logo">
                        <div className="w-7 h-7 bg-gradient-to-br from-indigo-500 to-violet-600 rounded-lg flex items-center justify-center shadow-sm">
                            <Rocket size={13} className="text-white" />
                        </div>
                        <span className="font-bold text-white text-[15px] tracking-tight">Rimble</span>
                    </button>

                    {/* Separator */}
                    <div className="h-5 w-px bg-zinc-800" />

                    {/* Team Selector */}
                    <div className="relative">
                        <button
                            id="team-selector"
                            onClick={() => setShowTeamDropdown(!showTeamDropdown)}
                            className="flex items-center gap-2 text-sm text-zinc-400 hover:text-white px-2.5 py-1.5 rounded-lg hover:bg-zinc-800/50 transition-all"
                        >
                            <span className="font-medium">{selectedTeam?.name || 'Select team'}</span>
                            <ChevronDown size={14} className={`transition-transform ${showTeamDropdown ? 'rotate-180' : ''}`} />
                        </button>
                        {showTeamDropdown && (
                            <div className="absolute top-full left-0 mt-1.5 w-52 bg-[#151517] border border-zinc-800 rounded-xl shadow-2xl py-1.5 z-50 animate-fadeIn">
                                {teams.filter(t => t && t.id && t.name).map(t => (
                                    <button
                                        key={t.id}
                                        onClick={() => { onSelectTeam(t); setShowTeamDropdown(false); }}
                                        className={`w-full text-left px-3.5 py-2 text-sm transition-colors ${
                                            selectedTeam?.id === t.id
                                                ? 'text-white bg-indigo-500/10'
                                                : 'text-zinc-400 hover:text-white hover:bg-zinc-800/50'
                                        }`}
                                    >
                                        {t.name}
                                    </button>
                                ))}
                                <div className="border-t border-zinc-800/60 my-1 pt-1" />
                                <button
                                    onClick={() => { onSelectId('team-settings'); setShowTeamDropdown(false); }}
                                    className="w-full text-left px-3.5 py-2 text-xs font-semibold text-zinc-400 hover:text-white hover:bg-zinc-800 flex items-center gap-2"
                                >
                                    <Users size={12} className="text-zinc-500" />
                                    Team Settings
                                </button>
                            </div>
                        )}
                    </div>

                    <div className="ml-auto flex items-center gap-3">
                        {/* New button */}
                        <button
                            id="new-resource-btn"
                            onClick={() => setShowNewModal(true)}
                            className="flex items-center gap-1.5 px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium rounded-lg transition-all duration-200 shadow-sm hover:shadow-md hover:shadow-indigo-500/10 active:scale-[0.97]"
                        >
                            <Plus size={14} /> New
                        </button>

                        {/* User avatar */}
                        <div className="flex items-center gap-2.5">
                            <span className="text-xs text-zinc-500 hidden md:block">{user.email}</span>
                            <div className="w-8 h-8 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center text-sm font-semibold text-zinc-300">
                                {userInitial}
                            </div>
                            <button onClick={onLogout} className="text-zinc-500 hover:text-zinc-300 transition-colors p-1" id="logout-btn" title="Sign out">
                                <LogOut size={15} />
                            </button>
                        </div>
                    </div>
                </div>
            </header>

            {/* ─── Main Layout ─── */}
            <div className="max-w-[1400px] mx-auto flex min-h-[calc(100vh-57px)]">
                {/* ─── Left Sidebar ─── */}
                <aside className="w-[300px] border-r border-zinc-800/60 flex flex-col shrink-0" id="sidebar">
                    {/* Search */}
                    <div className="p-4 border-b border-zinc-800/40">
                        <div className="relative">
                            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
                            <input
                                id="search-resources"
                                type="text"
                                placeholder="Search resources..."
                                value={searchFilter}
                                onChange={e => setSearchFilter(e.target.value)}
                                className="w-full bg-zinc-900/50 border border-zinc-800/60 rounded-lg pl-9 pr-3 py-2 text-sm text-white placeholder:text-zinc-600 transition-all hover:border-zinc-700"
                            />
                        </div>
                    </div>

                    {/* Stats bar */}
                    <div className="px-4 py-3 border-b border-zinc-800/40 flex items-center justify-between">
                        <span className="text-xs font-medium text-zinc-500">
                            {deployments?.length ?? 0} resources
                        </span>
                        <span className="flex items-center gap-1.5 text-xs text-emerald-400">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse-dot" />
                            {liveCount} live
                        </span>
                    </div>

                    {/* Resource list */}
                    <div className="flex-1 overflow-y-auto" id="resource-list">
                        {isLoading && (
                            <div className="p-8 flex justify-center">
                                <Loader2 className="animate-spin text-zinc-600" size={20} />
                            </div>
                        )}
                        {!isLoading && (!filtered || filtered.length === 0) && (
                            <EmptyState
                                icon={LayoutGrid}
                                title="No resources"
                                description="Deploy your first app, database, or worker to get started."
                            />
                        )}
                        {filtered?.map((d, i) => (
                            <button
                                key={d.id}
                                onClick={() => onSelectId(d.id)}
                                id={`resource-${d.id}`}
                                className={`w-full text-left px-4 py-3.5 border-b border-zinc-800/30 transition-all duration-150 animate-fadeIn ${
                                    selectedId === d.id
                                        ? 'bg-indigo-500/5 border-l-2 border-l-indigo-500'
                                        : 'hover:bg-zinc-800/20 border-l-2 border-l-transparent'
                                }`}
                                style={{ animationDelay: `${i * 30}ms` }}
                            >
                                <div className="flex items-center gap-3">
                                    <ResourceIcon type={d.type} size={16} withBg />
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-0.5">
                                            <span className="font-medium text-sm text-zinc-200 truncate">{d.name}</span>
                                            {d.isPrPreview && d.prNumber && <PrBadge prNumber={d.prNumber} />}
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className="text-xs text-zinc-600 truncate">
                                                {d.gitUrl ? d.gitUrl.replace('https://github.com/', '') : `Managed ${d.type}`}
                                            </span>
                                        </div>
                                    </div>
                                    <StatusBadge status={d.status} />
                                </div>
                            </button>
                        ))}
                    </div>

                    {/* Sidebar Footer - Team Settings Link */}
                    {selectedTeam && selectedTeam.name && (
                        <div className="border-t border-zinc-800/60 p-4">
                            <button
                                onClick={() => onSelectId('team-settings')}
                                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 ${
                                    selectedId === 'team-settings'
                                        ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/15'
                                        : 'text-zinc-400 hover:text-white hover:bg-zinc-800/30'
                                }`}
                            >
                                <div className="flex items-center gap-2.5 min-w-0">
                                    <div className="w-5 h-5 rounded bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-[10px] font-bold text-white uppercase shrink-0">
                                        {(selectedTeam.name || '').slice(0, 2).toUpperCase()}
                                    </div>
                                    <span className="truncate">{selectedTeam.name || 'Team'}</span>
                                </div>
                                <span className="text-[10px] font-bold bg-zinc-800 text-zinc-500 px-1.5 py-0.5 rounded uppercase tracking-wider scale-90">
                                    Settings
                                </span>
                            </button>
                        </div>
                    )}
                </aside>

                {/* ─── Main Content ─── */}
                <main className="flex-1 min-w-0 bg-[#070709]" id="main-content">
                    {selected ? (
                        <div className="animate-fadeIn">
                            {/* Resource header bar */}
                            <div className="border-b border-zinc-800/60 px-8 py-5">
                                <div className="flex items-start justify-between">
                                    <div className="flex items-center gap-4">
                                        <ResourceIcon type={selected.type} size={18} withBg />
                                        <div>
                                            <div className="flex items-center gap-3 mb-0.5">
                                                <h1 className="text-xl font-bold text-white tracking-tight">{selected.name}</h1>
                                                {selected.isPrPreview && selected.prNumber && <PrBadge prNumber={selected.prNumber} />}
                                                <StatusBadge status={selected.status} size="lg" />
                                            </div>
                                            <p className="text-xs text-zinc-500 font-mono">
                                                {selected.type.toUpperCase()} · {REGION_LABELS[selected.region] || selected.region} · {selected.id.slice(0, 8)}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        {(selected.type === 'app' || selected.type === 'worker') && (
                                            <button
                                                onClick={() => relaunch.mutate(selected.id)}
                                                disabled={relaunch.isPending}
                                                id="redeploy-btn"
                                                className="flex items-center gap-2 px-4 py-2 bg-zinc-800/80 border border-zinc-700/60 rounded-lg text-zinc-300 text-sm font-medium hover:bg-zinc-700/80 hover:text-white transition-all disabled:opacity-50"
                                            >
                                                {relaunch.isPending ? <Loader2 size={14} className="animate-spin" /> : <Rocket size={14} />} Redeploy
                                            </button>
                                        )}
                                        {selected.liveUrl && selected.type === 'app' && (
                                            <a
                                                href={selected.liveUrl}
                                                target="_blank"
                                                rel="noreferrer"
                                                className="flex items-center gap-2 px-4 py-2 bg-zinc-800/80 border border-zinc-700/60 rounded-lg text-zinc-300 text-sm font-medium hover:bg-zinc-700/80 hover:text-white transition-all"
                                            >
                                                <Globe size={14} /> Visit
                                            </a>
                                        )}
                                        <button
                                            onClick={() => { if (confirm('Delete this resource permanently?')) destroy.mutate(selected.id); }}
                                            disabled={destroy.isPending}
                                            id="delete-btn"
                                            className="flex items-center gap-2 px-4 py-2 text-red-400 hover:bg-red-500/10 border border-transparent hover:border-red-500/20 rounded-lg text-sm font-medium transition-all disabled:opacity-50"
                                        >
                                            {destroy.isPending ? <Loader2 size={14} className="animate-spin" /> : <X size={14} />} Delete
                                        </button>
                                    </div>
                                </div>
                            </div>

                            {/* Detail content */}
                            <div className="p-8">
                                <DeploymentDetail 
                                    deployment={selected} 
                                    allDeployments={deployments || []} 
                                    onSelectDeployment={onSelectId} 
                                />
                            </div>
                        </div>
                    ) : (selectedId === 'team-settings' && selectedTeam) ? (
                        <div className="animate-fadeIn p-8 max-w-[1100px] mx-auto space-y-6">
                            <div className="flex items-center justify-between pb-6 border-b border-zinc-800/60">
                                <div>
                                    <h1 className="text-2xl font-bold text-white tracking-tight">Team Settings</h1>
                                    <p className="text-sm text-zinc-500 mt-1">Manage team roles, audit ledger events, notifications, and resource usage.</p>
                                </div>
                            </div>
                            <TeamPanel team={selectedTeam} />
                        </div>
                    ) : (
                        <div className="h-full flex flex-col items-center justify-center px-8">
                            <EmptyState
                                icon={Rocket}
                                title="Select a resource"
                                description="Choose a resource from the sidebar to view its details, or create a new one."
                            >
                                <button
                                    onClick={() => setShowNewModal(true)}
                                    className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium rounded-lg transition-all shadow-sm hover:shadow-indigo-500/10 active:scale-[0.97]"
                                >
                                    <Plus size={15} /> New Resource
                                </button>
                            </EmptyState>
                        </div>
                    )}
                </main>
            </div>

            {/* ─── New Resource Modal ─── */}
            {showNewModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fadeIn" onClick={() => setShowNewModal(false)}>
                    <div
                        className="w-full max-w-lg bg-[#111113] border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden animate-fadeIn"
                        onClick={e => e.stopPropagation()}
                        id="new-resource-modal"
                    >
                        {/* Modal header */}
                        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800/60">
                            <h2 className="text-lg font-semibold text-white">New Resource</h2>
                            <button onClick={() => setShowNewModal(false)} className="text-zinc-500 hover:text-white transition-colors p-1 rounded-lg hover:bg-zinc-800">
                                <X size={18} />
                            </button>
                        </div>

                        <form onSubmit={e => { e.preventDefault(); create.mutate(); }} className="p-6 space-y-5">
                            {/* Resource type selector */}
                            <div>
                                <label className="block text-sm font-medium text-zinc-400 mb-2">Resource Type</label>
                                <div className="grid grid-cols-5 gap-1.5 bg-zinc-900/80 p-1.5 rounded-xl border border-zinc-800/50">
                                    {RESOURCE_TYPES.map(t => (
                                        <button
                                            key={t}
                                            type="button"
                                            onClick={() => { setDeployType(t); setBpValidation({ status: 'idle' }); }}
                                            className={`flex flex-col items-center gap-1.5 py-3 rounded-lg text-xs font-medium transition-all duration-200 ${
                                                deployType === t
                                                    ? 'bg-zinc-800 text-white shadow-sm'
                                                    : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/40'
                                            }`}
                                        >
                                            <ResourceIcon type={t} size={16} />
                                            <span className="capitalize">{t}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Resource Name */}
                            <div>
                                <label className="block text-sm font-medium text-zinc-400 mb-2">Resource Name</label>
                                <input
                                    type="text"
                                    placeholder={deployType === 'postgres' ? 'my-postgres-db' : deployType === 'redis' ? 'my-redis-cache' : 'my-web-app'}
                                    value={customName}
                                    onChange={e => setCustomName(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                                    required
                                    id="resource-name-input"
                                    className="w-full bg-zinc-900/60 border border-zinc-800 rounded-lg px-3.5 py-2.5 text-sm text-white placeholder:text-zinc-600 transition-all hover:border-zinc-700"
                                />
                            </div>

                            {/* Region selector */}
                            <div>
                                <label className="block text-sm font-medium text-zinc-400 mb-2">Region</label>
                                <select
                                    value={region}
                                    onChange={e => setRegion(e.target.value)}
                                    id="region-select"
                                    className="w-full bg-zinc-900/60 border border-zinc-800 rounded-lg px-3.5 py-2.5 text-sm text-zinc-200 cursor-pointer hover:border-zinc-700 transition-all appearance-none"
                                >
                                    {REGIONS.map(r => <option key={r} value={r}>{REGION_LABELS[r] || r}</option>)}
                                </select>
                            </div>

                            {/* Git URL */}
                            {(deployType === 'app' || deployType === 'worker' || deployType === 'cron' || deployType === 'blueprint') && (
                                <div className="animate-fadeIn">
                                    <label className="block text-sm font-medium text-zinc-400 mb-2">Repository URL</label>
                                    <input
                                        type="url"
                                        placeholder="https://github.com/user/repo"
                                        value={gitUrl}
                                        onChange={e => { setGitUrl(e.target.value); setBpValidation({ status: 'idle' }); }}
                                        required
                                        id="git-url-input"
                                        className="w-full bg-zinc-900/60 border border-zinc-800 rounded-lg px-3.5 py-2.5 text-sm text-white placeholder:text-zinc-600 transition-all hover:border-zinc-700"
                                    />
                                </div>
                            )}

                            {/* Blueprint Verification Panel */}
                            {deployType === 'blueprint' && (
                                <div className="animate-fadeIn space-y-3">
                                    <div className="flex gap-2">
                                        <button
                                            type="button"
                                            onClick={handleVerifyBlueprint}
                                            disabled={!gitUrl || bpValidation.status === 'loading'}
                                            className="px-4 py-2 bg-pink-600 hover:bg-pink-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-semibold rounded-lg transition-all shadow-md active:scale-95 flex items-center gap-1.5"
                                        >
                                            {bpValidation.status === 'loading' ? (
                                                <Loader2 size={12} className="animate-spin" />
                                            ) : (
                                                <Layers size={12} />
                                            )}
                                            Verify Repository Blueprint
                                        </button>
                                    </div>

                                    {bpValidation.status === 'loading' && (
                                        <div className="bg-pink-500/5 border border-pink-500/10 rounded-xl p-4 flex items-center gap-3 animate-pulse">
                                            <Loader2 size={16} className="text-pink-400 animate-spin shrink-0" />
                                            <div className="text-xs text-pink-300 font-medium">
                                                Cloning repository and inspecting root directory for <span className="font-mono text-white">rimble.yaml</span>...
                                            </div>
                                        </div>
                                    )}

                                    {bpValidation.status === 'valid' && (
                                        <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-xl p-4 space-y-3 animate-fadeIn">
                                            <div className="flex items-center gap-2 text-emerald-400">
                                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                                                <span className="text-xs font-bold uppercase tracking-wider">Blueprint Verified!</span>
                                            </div>
                                            <p className="text-[11px] text-zinc-400">
                                                Found a valid configuration. The following resources will be orchestrated and deployed in order:
                                            </p>
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                                                {bpValidation.services?.map((svc, idx) => (
                                                    <div key={idx} className="flex items-center gap-2 bg-[#0c0c0e] border border-zinc-800 px-3 py-2 rounded-lg text-xs">
                                                        <ResourceIcon type={svc.type} size={13} />
                                                        <span className="font-semibold text-zinc-300 truncate">{svc.name}</span>
                                                        <span className="text-[9px] text-zinc-500 uppercase ml-auto tracking-wider font-bold">
                                                            {svc.type}
                                                        </span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {bpValidation.status === 'invalid' && (
                                        <div className="bg-red-500/5 border border-red-500/20 rounded-xl p-4 space-y-2 animate-fadeIn">
                                            <div className="text-xs font-bold text-red-400 uppercase tracking-wider">
                                                Validation Failed
                                            </div>
                                            <p className="text-xs text-red-300 leading-relaxed font-mono">
                                                {bpValidation.error}
                                            </p>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Cron schedule */}
                            {deployType === 'cron' && (
                                <div className="animate-fadeIn">
                                    <label className="block text-sm font-medium text-zinc-400 mb-2">Cron Schedule</label>
                                    <input
                                        placeholder="0 * * * *"
                                        value={cronSchedule}
                                        onChange={e => setCronSchedule(e.target.value)}
                                        required
                                        id="cron-schedule-input"
                                        className="w-full bg-zinc-900/60 border border-zinc-800 rounded-lg px-3.5 py-2.5 text-sm font-mono text-white placeholder:text-zinc-600 transition-all hover:border-zinc-700"
                                    />
                                </div>
                            )}

                            {/* Submit */}
                            <button
                                type="submit"
                                disabled={create.isPending || (deployType === 'blueprint' && bpValidation.status !== 'valid')}
                                id="create-resource-btn"
                                className="w-full bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-lg text-sm transition-all duration-200 flex items-center justify-center gap-2 shadow-lg shadow-indigo-500/15 active:scale-[0.98]"
                            >
                                {create.isPending ? <Loader2 size={16} className="animate-spin" /> : <Rocket size={16} />}
                                Deploy {deployType.charAt(0).toUpperCase() + deployType.slice(1)}
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
