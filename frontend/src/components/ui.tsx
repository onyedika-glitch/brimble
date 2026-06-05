import type { DeploymentStatus } from '../types';
import { Clock, Rocket, Database, Cpu, GitPullRequest, Layers } from 'lucide-react';

const STATUS_CONFIG: Record<string, { bg: string; text: string; dot: string; label: string; spinning?: boolean }> = {
    pending:   { bg: 'bg-zinc-500/10', text: 'text-zinc-400', dot: 'bg-zinc-400', label: 'Pending' },
    building:  { bg: 'bg-amber-500/10', text: 'text-amber-400', dot: 'bg-amber-400', label: 'Building', spinning: true },
    deploying: { bg: 'bg-blue-500/10', text: 'text-blue-400', dot: 'bg-blue-400', label: 'Deploying', spinning: true },
    running:   { bg: 'bg-emerald-500/10', text: 'text-emerald-400', dot: 'bg-emerald-400', label: 'Live' },
    failed:    { bg: 'bg-red-500/10', text: 'text-red-400', dot: 'bg-red-400', label: 'Failed' },
    stopped:   { bg: 'bg-zinc-500/10', text: 'text-zinc-500', dot: 'bg-zinc-500', label: 'Stopped' },
};

export function StatusBadge({ status, size = 'sm' }: { status: DeploymentStatus; size?: 'sm' | 'lg' }) {
    const c = STATUS_CONFIG[status] ?? STATUS_CONFIG.pending;
    return (
        <span className={`inline-flex items-center gap-1.5 rounded-full font-medium ${c.bg} ${c.text} ${
            size === 'sm' ? 'text-xs px-2.5 py-0.5' : 'text-sm px-3 py-1'
        }`}>
            <span className={`w-1.5 h-1.5 rounded-full ${c.dot} ${c.spinning ? 'animate-pulse' : ''}`} />
            {c.label}
        </span>
    );
}

const RESOURCE_ICON_CONFIG: Record<string, { icon: typeof Rocket; color: string; bg: string }> = {
    app:      { icon: Rocket, color: 'text-indigo-400', bg: 'bg-indigo-500/10' },
    postgres: { icon: Database, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
    redis:    { icon: Database, color: 'text-orange-400', bg: 'bg-orange-500/10' },
    worker:   { icon: Cpu, color: 'text-blue-400', bg: 'bg-blue-500/10' },
    cron:     { icon: Clock, color: 'text-violet-400', bg: 'bg-violet-500/10' },
    blueprint:{ icon: Layers, color: 'text-pink-400', bg: 'bg-pink-500/10' },
};

export function ResourceIcon({ type, size = 14, withBg = false }: { type: string; size?: number; withBg?: boolean }) {
    const config = RESOURCE_ICON_CONFIG[type] ?? RESOURCE_ICON_CONFIG.app;
    const Icon = config.icon;
    if (withBg) {
        return (
            <div className={`flex items-center justify-center w-9 h-9 rounded-lg ${config.bg}`}>
                <Icon size={size} className={config.color} />
            </div>
        );
    }
    return <Icon size={size} className={config.color} />;
}

export function PrBadge({ prNumber }: { prNumber: number }) {
    return (
        <span className="inline-flex items-center gap-1 bg-violet-500/15 text-violet-400 px-2 py-0.5 rounded-md text-xs font-medium border border-violet-500/20">
            <GitPullRequest size={10} /> PR #{prNumber}
        </span>
    );
}

export function Stat({ label, value, isUrl }: { label: string; value: string; isUrl?: boolean }) {
    return (
        <div className="ui-card border border-zinc-800/40 rounded-xl p-4 overflow-hidden">
            <div className="text-xs font-medium text-zinc-500 mb-1">{label}</div>
            <div className={`text-sm font-mono truncate ${isUrl && value !== '—' ? 'text-indigo-400' : 'text-zinc-200'}`}>
                {isUrl && value !== '—' && value.startsWith('http')
                    ? <a href={value} target="_blank" rel="noreferrer" className="hover:underline underline-offset-4 transition-colors hover:text-indigo-300">{value}</a>
                    : value}
            </div>
        </div>
    );
}

export function EmptyState({ icon: Icon, title, description, children }: {
    icon: React.ElementType;
    title: string;
    description: string;
    children?: React.ReactNode;
}) {
    return (
        <div className="flex flex-col items-center justify-center py-16 px-8 text-center">
            <div className="ui-card w-14 h-14 rounded-xl flex items-center justify-center mb-4 border border-zinc-800/40">
                <Icon size={24} className="text-zinc-500" />
            </div>
            <h3 className="text-base font-semibold text-zinc-200 mb-1">{title}</h3>
            <p className="text-sm text-zinc-500 max-w-xs">{description}</p>
            {children && <div className="mt-5">{children}</div>}
        </div>
    );
}
