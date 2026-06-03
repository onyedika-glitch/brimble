import { useEffect, useState } from 'react';
import { QueryClient, QueryClientProvider, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
    ChevronDown, Globe, Layers, LayoutGrid, Loader2, LogOut,
    Plus, Rocket, Search, Users, X
} from 'lucide-react';
import { api, getToken, setToken } from './api';
import type { Deployment, Team, User } from './types';
import { AuthPage } from './components/AuthPage';
import { DeploymentDetail } from './components/DeploymentDetail';
import { TeamPanel } from './components/TeamPanel';
import { EmptyState, PrBadge, ResourceIcon, StatusBadge } from './components/ui';

const qc = new QueryClient();

const REGIONS = ['us-east-1', 'eu-west-1', 'ap-southeast-1'];
const RESOURCE_TYPES = ['app', 'postgres', 'redis', 'worker', 'cron', 'blueprint'] as const;

const REGION_LABELS: Record<string, string> = {
    'us-east-1': 'US East',
    'eu-west-1': 'EU West',
    'ap-southeast-1': 'Asia Pacific',
};

export default function AppRoot() {
    return (
        <QueryClientProvider client={qc}>
            <App />
        </QueryClientProvider>
    );
}

function App() {
    const [authUser, setAuthUser] = useState<User | null>(null);
    const [teams, setTeams] = useState<Team[]>([]);
    const [selectedTeam, setSelectedTeam] = useState<Team | null>(null);
    const [selectedId, setSelectedId] = useState<string | null>(null);

    useEffect(() => {
        const token = getToken();
        if (!token) return;

        api.get('/auth/me')
            .then((r) => {
                setAuthUser(r.data.user);
                setTeams(r.data.teams || []);
                if (r.data.teams?.[0]) setSelectedTeam(r.data.teams[0]);
            })
            .catch(() => setToken(null));
    }, []);

    if (!authUser) {
        return (
            <AuthPage
                onAuth={(_, user, nextTeams) => {
                    setAuthUser(user);
                    setTeams(nextTeams);
                    if (nextTeams[0]) setSelectedTeam(nextTeams[0]);
                }}
            />
        );
    }

    return (
        <Dashboard
            user={authUser}
            teams={teams}
            selectedTeam={selectedTeam}
            selectedId={selectedId}
            onSelectId={setSelectedId}
            onSelectTeam={(team) => {
                setSelectedTeam(team);
                setSelectedId(null);
            }}
            onLogout={() => {
                setToken(null);
                setAuthUser(null);
            }}
        />
    );
}

function Dashboard({
    user,
    teams,
    selectedTeam,
    onSelectTeam,
    selectedId,
    onSelectId,
    onLogout,
}: {
    user: User;
    teams: Team[];
    selectedTeam: Team | null;
    onSelectTeam: (team: Team) => void;
    selectedId: string | null;
    onSelectId: (id: string | null) => void;
    onLogout: () => void;
}) {
    const qclient = useQueryClient();
    const [gitUrl, setGitUrl] = useState('');
    const [customName, setCustomName] = useState('');
    const [deployType, setDeployType] = useState<(typeof RESOURCE_TYPES)[number]>('app');
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

    const { data: deployments, isLoading } = useQuery<Deployment[]>({
        queryKey: ['deployments', selectedTeam?.id],
        queryFn: () => api.get('/deployments', { params: { teamId: selectedTeam?.id } }).then((r) => r.data),
        refetchInterval: 5000,
    });

    const { data: selected } = useQuery<Deployment>({
        queryKey: ['deployment', selectedId],
        queryFn: () => api.get(`/deployments/${selectedId}`).then((r) => r.data),
        enabled: !!selectedId && selectedId !== 'team-settings',
        refetchInterval: 5000,
    });

    const create = useMutation({
        mutationFn: () => api.post('/deployments', {
            name: customName || undefined,
            gitUrl: ['app', 'worker', 'cron', 'blueprint'].includes(deployType) ? gitUrl : undefined,
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
        onSuccess: () => {
            onSelectId(null);
            qclient.invalidateQueries({ queryKey: ['deployments'] });
        },
    });

    const relaunch = useMutation({
        mutationFn: (id: string) => api.post(`/deployments/${id}/relaunch`),
        onSuccess: () => qclient.invalidateQueries({ queryKey: ['deployment', selectedId] }),
    });

    const handleVerifyBlueprint = async () => {
        if (!gitUrl) return;
        setBpValidation({ status: 'loading' });
        try {
            const res = await api.post('/deployments/validate-blueprint', { gitUrl });
            setBpValidation(res.data.valid
                ? { status: 'valid', services: res.data.services }
                : { status: 'invalid', error: res.data.error || 'The blueprint file is invalid.' });
        } catch (err) {
            const axiosErr = err as { response?: { data?: { error?: string } }; message?: string };
            setBpValidation({
                status: 'invalid',
                error: axiosErr.response?.data?.error || axiosErr.message || 'Verification request failed.',
            });
        }
    };

    const filtered = deployments?.filter((d) =>
        !searchFilter ||
        d.name.toLowerCase().includes(searchFilter.toLowerCase()) ||
        d.type.toLowerCase().includes(searchFilter.toLowerCase())
    );
    const liveCount = deployments?.filter((d) => d.status === 'running').length ?? 0;
    const userInitial = user.name?.charAt(0)?.toUpperCase() || user.email?.charAt(0)?.toUpperCase() || '?';

    return (
        <div className="min-h-screen bg-[#09090b] text-zinc-100">
            <header className="sticky top-0 z-50 border-b border-zinc-800/60 bg-[#0c0c0e]/90 backdrop-blur-xl" id="navbar">
                <div className="mx-auto flex h-14 max-w-[1400px] items-center gap-4 px-6">
                    <button onClick={() => onSelectId(null)} className="mr-2 flex items-center gap-2.5 hover:opacity-80" id="nav-logo">
                        <div className="flex h-7 w-7 items-center justify-center rounded-md bg-gradient-to-br from-indigo-500 to-violet-600 shadow-sm">
                            <Rocket size={13} className="text-white" />
                        </div>
                        <span className="text-[15px] font-bold text-white">Brimble</span>
                    </button>

                    <div className="h-5 w-px bg-zinc-800" />

                    <div className="relative">
                        <button
                            id="team-selector"
                            onClick={() => setShowTeamDropdown(!showTeamDropdown)}
                            className="flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-sm text-zinc-400 hover:bg-zinc-800/50 hover:text-white"
                        >
                            <span className="font-medium">{selectedTeam?.name || 'Select team'}</span>
                            <ChevronDown size={14} className={showTeamDropdown ? 'rotate-180' : ''} />
                        </button>
                        {showTeamDropdown && (
                            <div className="absolute left-0 top-full z-50 mt-1.5 w-52 animate-fadeIn rounded-lg border border-zinc-800 bg-[#151517] py-1.5 shadow-2xl">
                                {teams.filter((t) => t?.id && t.name).map((t) => (
                                    <button
                                        key={t.id}
                                        onClick={() => {
                                            onSelectTeam(t);
                                            setShowTeamDropdown(false);
                                        }}
                                        className={`w-full px-3.5 py-2 text-left text-sm ${
                                            selectedTeam?.id === t.id
                                                ? 'bg-indigo-500/10 text-white'
                                                : 'text-zinc-400 hover:bg-zinc-800/50 hover:text-white'
                                        }`}
                                    >
                                        {t.name}
                                    </button>
                                ))}
                                <div className="my-1 border-t border-zinc-800/60 pt-1" />
                                <button
                                    onClick={() => {
                                        onSelectId('team-settings');
                                        setShowTeamDropdown(false);
                                    }}
                                    className="flex w-full items-center gap-2 px-3.5 py-2 text-left text-xs font-semibold text-zinc-400 hover:bg-zinc-800 hover:text-white"
                                >
                                    <Users size={12} className="text-zinc-500" />
                                    Team Settings
                                </button>
                            </div>
                        )}
                    </div>

                    <div className="ml-auto flex items-center gap-3">
                        <button
                            id="new-resource-btn"
                            onClick={() => setShowNewModal(true)}
                            className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3.5 py-1.5 text-sm font-medium text-white shadow-sm hover:bg-indigo-500 active:scale-[0.97]"
                        >
                            <Plus size={14} /> New
                        </button>
                        <div className="flex items-center gap-2.5">
                            <span className="hidden text-xs text-zinc-500 md:block">{user.email}</span>
                            <div className="flex h-8 w-8 items-center justify-center rounded-full border border-zinc-700 bg-zinc-800 text-sm font-semibold text-zinc-300">
                                {userInitial}
                            </div>
                            <button onClick={onLogout} className="p-1 text-zinc-500 hover:text-zinc-300" id="logout-btn" title="Sign out">
                                <LogOut size={15} />
                            </button>
                        </div>
                    </div>
                </div>
            </header>

            <div className="mx-auto flex min-h-[calc(100vh-57px)] max-w-[1400px]">
                <aside className="flex w-[300px] shrink-0 flex-col border-r border-zinc-800/60" id="sidebar">
                    <div className="border-b border-zinc-800/40 p-4">
                        <div className="relative">
                            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
                            <input
                                id="search-resources"
                                type="text"
                                placeholder="Search resources..."
                                value={searchFilter}
                                onChange={(e) => setSearchFilter(e.target.value)}
                                className="w-full rounded-lg border border-zinc-800/60 bg-zinc-900/50 py-2 pl-9 pr-3 text-sm text-white placeholder:text-zinc-600 hover:border-zinc-700"
                            />
                        </div>
                    </div>

                    <div className="flex items-center justify-between border-b border-zinc-800/40 px-4 py-3">
                        <span className="text-xs font-medium text-zinc-500">{deployments?.length ?? 0} resources</span>
                        <span className="flex items-center gap-1.5 text-xs text-emerald-400">
                            <span className="h-1.5 w-1.5 animate-pulse-dot rounded-full bg-emerald-400" />
                            {liveCount} live
                        </span>
                    </div>

                    <div className="flex-1 overflow-y-auto" id="resource-list">
                        {isLoading && (
                            <div className="flex justify-center p-8">
                                <Loader2 className="animate-spin text-zinc-600" size={20} />
                            </div>
                        )}
                        {!isLoading && (!filtered || filtered.length === 0) && (
                            <EmptyState icon={LayoutGrid} title="No resources" description="Deploy your first app, database, or worker to get started." />
                        )}
                        {filtered?.map((d, i) => (
                            <button
                                key={d.id}
                                onClick={() => onSelectId(d.id)}
                                id={`resource-${d.id}`}
                                className={`w-full animate-fadeIn border-b border-l-2 border-zinc-800/30 px-4 py-3.5 text-left ${
                                    selectedId === d.id
                                        ? 'border-l-indigo-500 bg-indigo-500/5'
                                        : 'border-l-transparent hover:bg-zinc-800/20'
                                }`}
                                style={{ animationDelay: `${i * 30}ms` }}
                            >
                                <div className="flex items-center gap-3">
                                    <ResourceIcon type={d.type} size={16} withBg />
                                    <div className="min-w-0 flex-1">
                                        <div className="mb-0.5 flex items-center gap-2">
                                            <span className="truncate text-sm font-medium text-zinc-200">{d.name}</span>
                                            {d.isPrPreview && d.prNumber && <PrBadge prNumber={d.prNumber} />}
                                        </div>
                                        <span className="block truncate text-xs text-zinc-600">
                                            {d.gitUrl ? d.gitUrl.replace('https://github.com/', '') : `Managed ${d.type}`}
                                        </span>
                                    </div>
                                    <StatusBadge status={d.status} />
                                </div>
                            </button>
                        ))}
                    </div>

                    {selectedTeam && (
                        <div className="border-t border-zinc-800/60 p-4">
                            <button
                                onClick={() => onSelectId('team-settings')}
                                className={`flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-sm font-medium ${
                                    selectedId === 'team-settings'
                                        ? 'border border-indigo-500/15 bg-indigo-500/10 text-indigo-400'
                                        : 'text-zinc-400 hover:bg-zinc-800/30 hover:text-white'
                                }`}
                            >
                                <div className="flex min-w-0 items-center gap-2.5">
                                    <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-gradient-to-br from-indigo-500 to-violet-600 text-[10px] font-bold uppercase text-white">
                                        {selectedTeam.name.slice(0, 2).toUpperCase()}
                                    </div>
                                    <span className="truncate">{selectedTeam.name}</span>
                                </div>
                                <span className="rounded bg-zinc-800 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-zinc-500">
                                    Settings
                                </span>
                            </button>
                        </div>
                    )}
                </aside>

                <main className="min-w-0 flex-1 bg-[#070709]" id="main-content">
                    {selected ? (
                        <div className="animate-fadeIn">
                            <div className="border-b border-zinc-800/60 px-8 py-5">
                                <div className="flex items-start justify-between gap-4">
                                    <div className="flex items-center gap-4">
                                        <ResourceIcon type={selected.type} size={18} withBg />
                                        <div>
                                            <div className="mb-0.5 flex items-center gap-3">
                                                <h1 className="text-xl font-bold text-white">{selected.name}</h1>
                                                {selected.isPrPreview && selected.prNumber && <PrBadge prNumber={selected.prNumber} />}
                                                <StatusBadge status={selected.status} size="lg" />
                                            </div>
                                            <p className="font-mono text-xs text-zinc-500">
                                                {selected.type.toUpperCase()} / {REGION_LABELS[selected.region] || selected.region} / {selected.id.slice(0, 8)}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        {(selected.type === 'app' || selected.type === 'worker') && (
                                            <button
                                                onClick={() => relaunch.mutate(selected.id)}
                                                disabled={relaunch.isPending}
                                                id="redeploy-btn"
                                                className="flex items-center gap-2 rounded-lg border border-zinc-700/60 bg-zinc-800/80 px-4 py-2 text-sm font-medium text-zinc-300 hover:bg-zinc-700/80 hover:text-white disabled:opacity-50"
                                            >
                                                {relaunch.isPending ? <Loader2 size={14} className="animate-spin" /> : <Rocket size={14} />}
                                                Redeploy
                                            </button>
                                        )}
                                        {selected.liveUrl && selected.type === 'app' && (
                                            <a
                                                href={selected.liveUrl}
                                                target="_blank"
                                                rel="noreferrer"
                                                className="flex items-center gap-2 rounded-lg border border-zinc-700/60 bg-zinc-800/80 px-4 py-2 text-sm font-medium text-zinc-300 hover:bg-zinc-700/80 hover:text-white"
                                            >
                                                <Globe size={14} /> Visit
                                            </a>
                                        )}
                                        <button
                                            onClick={() => {
                                                if (confirm('Delete this resource permanently?')) destroy.mutate(selected.id);
                                            }}
                                            disabled={destroy.isPending}
                                            id="delete-btn"
                                            className="flex items-center gap-2 rounded-lg border border-transparent px-4 py-2 text-sm font-medium text-red-400 hover:border-red-500/20 hover:bg-red-500/10 disabled:opacity-50"
                                        >
                                            {destroy.isPending ? <Loader2 size={14} className="animate-spin" /> : <X size={14} />}
                                            Delete
                                        </button>
                                    </div>
                                </div>
                            </div>

                            <div className="p-8">
                                <DeploymentDetail deployment={selected} allDeployments={deployments || []} onSelectDeployment={onSelectId} />
                            </div>
                        </div>
                    ) : selectedId === 'team-settings' && selectedTeam ? (
                        <div className="mx-auto max-w-[1100px] animate-fadeIn space-y-6 p-8">
                            <div className="flex items-center justify-between border-b border-zinc-800/60 pb-6">
                                <div>
                                    <h1 className="text-2xl font-bold text-white">Team Settings</h1>
                                    <p className="mt-1 text-sm text-zinc-500">Manage team roles, audit ledger events, notifications, and resource usage.</p>
                                </div>
                            </div>
                            <TeamPanel team={selectedTeam} />
                        </div>
                    ) : (
                        <div className="flex h-full flex-col items-center justify-center px-8">
                            <EmptyState
                                icon={Rocket}
                                title="Select a resource"
                                description="Choose a resource from the sidebar to view its details, or create a new one."
                            >
                                <button
                                    onClick={() => setShowNewModal(true)}
                                    className="flex items-center gap-2 rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-indigo-500 active:scale-[0.97]"
                                >
                                    <Plus size={15} /> New Resource
                                </button>
                            </EmptyState>
                        </div>
                    )}
                </main>
            </div>

            {showNewModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-fadeIn" onClick={() => setShowNewModal(false)}>
                    <div
                        className="w-full max-w-lg animate-fadeIn overflow-hidden rounded-lg border border-zinc-800 bg-[#111113] shadow-2xl"
                        onClick={(e) => e.stopPropagation()}
                        id="new-resource-modal"
                    >
                        <div className="flex items-center justify-between border-b border-zinc-800/60 px-6 py-4">
                            <h2 className="text-lg font-semibold text-white">New Resource</h2>
                            <button onClick={() => setShowNewModal(false)} className="rounded-lg p-1 text-zinc-500 hover:bg-zinc-800 hover:text-white">
                                <X size={18} />
                            </button>
                        </div>

                        <form onSubmit={(e) => { e.preventDefault(); create.mutate(); }} className="space-y-5 p-6">
                            <div>
                                <label className="mb-2 block text-sm font-medium text-zinc-400">Resource Type</label>
                                <div className="grid grid-cols-3 gap-1.5 rounded-lg border border-zinc-800/50 bg-zinc-900/80 p-1.5 sm:grid-cols-6">
                                    {RESOURCE_TYPES.map((t) => (
                                        <button
                                            key={t}
                                            type="button"
                                            onClick={() => {
                                                setDeployType(t);
                                                setBpValidation({ status: 'idle' });
                                            }}
                                            className={`flex flex-col items-center gap-1.5 rounded-lg py-3 text-xs font-medium ${
                                                deployType === t ? 'bg-zinc-800 text-white shadow-sm' : 'text-zinc-500 hover:bg-zinc-800/40 hover:text-zinc-300'
                                            }`}
                                        >
                                            <ResourceIcon type={t} size={16} />
                                            <span className="capitalize">{t}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div>
                                <label className="mb-2 block text-sm font-medium text-zinc-400">Resource Name</label>
                                <input
                                    type="text"
                                    placeholder={deployType === 'postgres' ? 'my-postgres-db' : deployType === 'redis' ? 'my-redis-cache' : 'my-web-app'}
                                    value={customName}
                                    onChange={(e) => setCustomName(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                                    required
                                    id="resource-name-input"
                                    className="w-full rounded-lg border border-zinc-800 bg-zinc-900/60 px-3.5 py-2.5 text-sm text-white placeholder:text-zinc-600 hover:border-zinc-700"
                                />
                            </div>

                            <div>
                                <label className="mb-2 block text-sm font-medium text-zinc-400">Region</label>
                                <select
                                    value={region}
                                    onChange={(e) => setRegion(e.target.value)}
                                    id="region-select"
                                    className="w-full appearance-none rounded-lg border border-zinc-800 bg-zinc-900/60 px-3.5 py-2.5 text-sm text-zinc-200 hover:border-zinc-700"
                                >
                                    {REGIONS.map((r) => <option key={r} value={r}>{REGION_LABELS[r] || r}</option>)}
                                </select>
                            </div>

                            {['app', 'worker', 'cron', 'blueprint'].includes(deployType) && (
                                <div className="animate-fadeIn">
                                    <label className="mb-2 block text-sm font-medium text-zinc-400">Repository URL</label>
                                    <input
                                        type="url"
                                        placeholder="https://github.com/user/repo"
                                        value={gitUrl}
                                        onChange={(e) => {
                                            setGitUrl(e.target.value);
                                            setBpValidation({ status: 'idle' });
                                        }}
                                        required
                                        id="git-url-input"
                                        className="w-full rounded-lg border border-zinc-800 bg-zinc-900/60 px-3.5 py-2.5 text-sm text-white placeholder:text-zinc-600 hover:border-zinc-700"
                                    />
                                </div>
                            )}

                            {deployType === 'blueprint' && (
                                <div className="animate-fadeIn space-y-3">
                                    <button
                                        type="button"
                                        onClick={handleVerifyBlueprint}
                                        disabled={!gitUrl || bpValidation.status === 'loading'}
                                        className="flex items-center gap-1.5 rounded-lg bg-pink-600 px-4 py-2 text-xs font-semibold text-white hover:bg-pink-500 disabled:cursor-not-allowed disabled:opacity-50"
                                    >
                                        {bpValidation.status === 'loading' ? <Loader2 size={12} className="animate-spin" /> : <Layers size={12} />}
                                        Verify Repository Blueprint
                                    </button>

                                    {bpValidation.status === 'loading' && (
                                        <div className="flex items-center gap-3 rounded-lg border border-pink-500/10 bg-pink-500/5 p-4">
                                            <Loader2 size={16} className="shrink-0 animate-spin text-pink-400" />
                                            <div className="text-xs font-medium text-pink-300">
                                                Inspecting the repository root for <span className="font-mono text-white">brimble.yaml</span>.
                                            </div>
                                        </div>
                                    )}

                                    {bpValidation.status === 'valid' && (
                                        <div className="animate-fadeIn space-y-3 rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-4">
                                            <div className="flex items-center gap-2 text-emerald-400">
                                                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                                                <span className="text-xs font-bold uppercase tracking-wider">Blueprint verified</span>
                                            </div>
                                            <p className="text-[11px] text-zinc-400">The following resources will be orchestrated and deployed in order:</p>
                                            <div className="grid grid-cols-1 gap-2 pt-1 sm:grid-cols-2">
                                                {bpValidation.services?.map((svc, idx) => (
                                                    <div key={idx} className="flex items-center gap-2 rounded-lg border border-zinc-800 bg-[#0c0c0e] px-3 py-2 text-xs">
                                                        <ResourceIcon type={svc.type} size={13} />
                                                        <span className="truncate font-semibold text-zinc-300">{svc.name}</span>
                                                        <span className="ml-auto text-[9px] font-bold uppercase tracking-wider text-zinc-500">{svc.type}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {bpValidation.status === 'invalid' && (
                                        <div className="animate-fadeIn space-y-2 rounded-lg border border-red-500/20 bg-red-500/5 p-4">
                                            <div className="text-xs font-bold uppercase tracking-wider text-red-400">Validation failed</div>
                                            <p className="font-mono text-xs leading-relaxed text-red-300">{bpValidation.error}</p>
                                        </div>
                                    )}
                                </div>
                            )}

                            {deployType === 'cron' && (
                                <div className="animate-fadeIn">
                                    <label className="mb-2 block text-sm font-medium text-zinc-400">Cron Schedule</label>
                                    <input
                                        placeholder="0 * * * *"
                                        value={cronSchedule}
                                        onChange={(e) => setCronSchedule(e.target.value)}
                                        required
                                        id="cron-schedule-input"
                                        className="w-full rounded-lg border border-zinc-800 bg-zinc-900/60 px-3.5 py-2.5 font-mono text-sm text-white placeholder:text-zinc-600 hover:border-zinc-700"
                                    />
                                </div>
                            )}

                            <button
                                type="submit"
                                disabled={create.isPending || (deployType === 'blueprint' && bpValidation.status !== 'valid')}
                                id="create-resource-btn"
                                className="flex w-full items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-indigo-600 to-indigo-500 py-3 text-sm font-semibold text-white shadow-lg shadow-indigo-500/15 hover:from-indigo-500 hover:to-indigo-400 disabled:cursor-not-allowed disabled:opacity-50"
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
