import type { Deployment, DeploymentStatus } from '../types';
import { CheckCircle2, XCircle, Clock, Loader2, Rocket, Database, GitPullRequest } from 'lucide-react';

export function StatusBadge({ status, size = 'sm' }: { status: DeploymentStatus; size?: 'sm' | 'lg' }) {
    const configs = {
        pending:   { color: 'text-zinc-400  bg-zinc-500/10  border-zinc-500/20',  icon: Clock,        label: 'Pending' },
        building:  { color: 'text-amber-400 bg-amber-500/10 border-amber-500/20', icon: Loader2,      label: 'Building',  spin: true },
        deploying: { color: 'text-blue-400  bg-blue-500/10  border-blue-500/20',  icon: Loader2,      label: 'Deploying', spin: true },
        running:   { color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20', icon: CheckCircle2, label: 'Running' },
        failed:    { color: 'text-rose-400  bg-rose-500/10  border-rose-500/20',  icon: XCircle,      label: 'Failed' },
        stopped:   { color: 'text-zinc-500  bg-zinc-500/10  border-zinc-500/20',  icon: XCircle,      label: 'Stopped' },
    };
    const c = configs[status] ?? configs.pending;
    const Icon = c.icon;
    return (
        <span className={`inline-flex items-center gap-1.5 rounded-full font-bold uppercase tracking-wider border shrink-0 ${c.color} ${ size === 'sm' ? 'text-[9px] px-2 py-0.5' : 'text-[11px] px-3 py-1'}`}>
            <Icon size={size === 'sm' ? 10 : 12} className={'spin' in c && c.spin ? 'animate-spin' : ''} />
            {c.label}
        </span>
    );
}

export function ResourceIcon({ type, size = 14 }: { type: string; size?: number }) {
    if (type === 'postgres' || type === 'redis') return <Database size={size} className="text-amber-400" />;
    if (type === 'worker') return <Loader2 size={size} className="text-blue-400" />;
    if (type === 'cron') return <Clock size={size} className="text-purple-400" />;
    return <Rocket size={size} className="text-indigo-400" />;
}

export function PrBadge({ prNumber }: { prNumber: number }) {
    return (
        <span className="ml-1 inline-flex items-center gap-1 bg-purple-500/20 text-purple-400 px-1.5 py-0.5 rounded text-[9px] font-bold">
            <GitPullRequest size={9} /> PR #{prNumber}
        </span>
    );
}

export function Stat({ label, value, isUrl }: { label: string; value: string; isUrl?: boolean }) {
    return (
        <div className="overflow-hidden">
            <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1">{label}</div>
            <div className={`text-sm font-mono truncate ${isUrl && value !== '—' ? 'text-indigo-400 underline underline-offset-4' : 'text-zinc-200'}`}>
                {isUrl && value !== '—' && value.startsWith('http')
                    ? <a href={value} target="_blank" rel="noreferrer">{value}</a>
                    : value}
            </div>
        </div>
    );
}
