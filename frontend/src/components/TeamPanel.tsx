import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../api';
import { Loader2, Users, BarChart2, FileText, Bell, Save, Shield, Send } from 'lucide-react';
import type { Team, AuditLog, UsageData, NotificationSetting } from '../types';

const AUDIT_ACTION_LABELS: Record<string, { label: string; color: string; bg: string; border: string }> = {
    'user.registered': { 
        label: 'User Signed Up', 
        color: 'text-emerald-400', 
        bg: 'bg-emerald-500/10', 
        border: 'border-emerald-500/20' 
    },
    'deployment.created': { 
        label: 'Deployment Initialized', 
        color: 'text-blue-400', 
        bg: 'bg-blue-500/10', 
        border: 'border-blue-500/20' 
    },
    'deployment.succeeded': { 
        label: 'Deployment Succeeded', 
        color: 'text-emerald-400', 
        bg: 'bg-emerald-500/10', 
        border: 'border-emerald-500/20' 
    },
    'deployment.failed': { 
        label: 'Deployment Failed', 
        color: 'text-rose-400', 
        bg: 'bg-rose-500/10', 
        border: 'border-rose-500/20' 
    },
    'deployment.destroyed': { 
        label: 'Resource Deleted', 
        color: 'text-zinc-400', 
        bg: 'bg-zinc-800/50', 
        border: 'border-zinc-700/30' 
    },
};

function formatAction(action: string) {
    const config = AUDIT_ACTION_LABELS[action];
    if (config) {
        return (
            <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${config.bg} ${config.color} border ${config.border}`}>
                {config.label}
            </span>
        );
    }
    // Fallback if not mapped
    const cleanLabel = action.split('.').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
    return (
        <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-zinc-900 border border-zinc-800 text-zinc-300">
            {cleanLabel}
        </span>
    );
}

export function TeamPanel({ team }: { team: Team }) {
    const qc = useQueryClient();
    const [tab, setTab] = useState<'usage' | 'members' | 'audit' | 'notifications'>('usage');
    const [inviteEmail, setInviteEmail] = useState('');
    const [slackUrl, setSlackUrl] = useState('');
    const [notifSettings, setNotifSettings] = useState<Partial<NotificationSetting>>({
        emailEnabled: true, onSuccess: true, onFailure: true, onPrPreview: true,
    });

    const { data: audit } = useQuery<AuditLog[]>({
        queryKey: ['audit', team.id],
        queryFn: () => api.get(`/teams/${team.id}/audit`).then(r => r.data),
        enabled: tab === 'audit',
    });

    const { data: usage } = useQuery<UsageData>({
        queryKey: ['usage', team.id],
        queryFn: () => api.get(`/teams/${team.id}/usage`).then(r => r.data),
        enabled: tab === 'usage',
        refetchInterval: 30_000,
    });

    const invite = useMutation({
        mutationFn: () => api.post(`/teams/${team.id}/invite`, { email: inviteEmail, role: 'member' }),
        onSuccess: () => { setInviteEmail(''); qc.invalidateQueries({ queryKey: ['me'] }); },
    });

    const saveNotif = useMutation({
        mutationFn: () => api.put('/auth/notifications', { ...notifSettings, slackWebhook: slackUrl || null }),
    });

    const inputCls = 'bg-[#0c0c0e] border border-zinc-800 rounded-xl px-4 py-3 text-sm text-white placeholder:text-zinc-600 transition-all hover:border-zinc-700 w-full focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none';

    const tabs = [
        { key: 'usage', icon: BarChart2, label: 'Usage & Limits' },
        { key: 'members', icon: Users, label: 'Team Members' },
        { key: 'audit', icon: FileText, label: 'Audit Logs' },
        { key: 'notifications', icon: Bell, label: 'Alerts & Webhooks' },
    ] as const;

    const mockMembers = [
        { name: 'Omogo Peter Onyedika', email: 'omogopeter48@gmail.com', role: 'Owner', status: 'active' },
        { name: 'Colleague Dev', email: 'dev.partner@company.com', role: 'Developer', status: 'invited' },
    ];

    return (
        <div className="grid grid-cols-1 md:grid-cols-[240px_1fr] gap-8 mt-6">
            {/* ─── Settings Sidebar ─── */}
            <div className="flex flex-col gap-1">
                {tabs.map(({ key, icon: Icon, label }) => (
                    <button
                        key={key}
                        onClick={() => setTab(key as typeof tab)}
                        className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                            tab === key
                                ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20'
                                : 'text-zinc-400 hover:text-white hover:bg-zinc-900/40'
                        }`}
                    >
                        <Icon size={16} />
                        {label}
                    </button>
                ))}
            </div>

            {/* ─── Main Content Pane ─── */}
            <div className="bg-[#111113] border border-zinc-800/80 rounded-lg p-8 shadow-2xl shadow-black/40 min-h-[480px]">
                
                {/* ─── USAGE TAB ─── */}
                {tab === 'usage' && (
                    <div className="space-y-6">
                        <div>
                            <h2 className="text-lg font-bold text-white tracking-tight">Resource Usage</h2>
                            <p className="text-xs text-zinc-500 mt-1">Realtime metric monitoring against plan limits.</p>
                        </div>

                        {usage ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {Object.entries(usage.usage).map(([metric, value]: [string, number]) => {
                                    const limit = usage.limits[metric] || 1;
                                    const pct = Math.min((value / limit) * 100, 100);
                                    
                                    return (
                                        <div key={metric} className="bg-[#151517] border border-zinc-800/60 p-5 rounded-xl space-y-4">
                                            <div className="flex justify-between items-start">
                                                <div>
                                                    <span className="capitalize text-xs font-semibold text-zinc-400 tracking-wide">{metric.replace(/_/g, ' ')}</span>
                                                    <h3 className="text-2xl font-bold text-white mt-1 tabular-nums">
                                                        {value.toFixed(1)}
                                                        <span className="text-xs text-zinc-500 font-medium ml-1">
                                                            / {limit === Infinity ? '∞' : limit}
                                                        </span>
                                                    </h3>
                                                </div>
                                                <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${
                                                    pct > 85 ? 'bg-red-500/10 text-red-400' :
                                                    pct > 60 ? 'bg-amber-500/10 text-amber-400' :
                                                    'bg-indigo-500/10 text-indigo-400'
                                                }`}>
                                                    {pct.toFixed(0)}%
                                                </span>
                                            </div>

                                            <div className="h-2 bg-zinc-950 rounded-full overflow-hidden border border-zinc-800/20">
                                                <div
                                                    className={`h-full rounded-full transition-all duration-500 ${
                                                        pct > 85 ? 'bg-gradient-to-r from-red-600 to-rose-500' :
                                                        pct > 60 ? 'bg-gradient-to-r from-amber-500 to-yellow-400' :
                                                        'bg-gradient-to-r from-indigo-600 to-indigo-400'
                                                    }`}
                                                    style={{ width: `${pct}%` }}
                                                />
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        ) : (
                            <div className="flex flex-col items-center justify-center py-20 text-zinc-600">
                                <Loader2 className="animate-spin text-indigo-500 mb-3" size={24} />
                                <p className="text-sm font-medium">Fetching usage records...</p>
                            </div>
                        )}
                    </div>
                )}

                {/* ─── MEMBERS TAB ─── */}
                {tab === 'members' && (
                    <div className="space-y-6">
                        <div>
                            <h2 className="text-lg font-bold text-white tracking-tight">Team Members</h2>
                            <p className="text-xs text-zinc-500 mt-1">Manage team access and send new developer invitations.</p>
                        </div>

                        {/* Invite input form */}
                        <div className="bg-[#151517] border border-zinc-800/60 p-5 rounded-xl">
                            <h3 className="text-xs font-bold text-zinc-300 uppercase tracking-wider mb-3">Invite Team Member</h3>
                            <form onSubmit={e => { e.preventDefault(); invite.mutate(); }} className="flex gap-3">
                                <input 
                                    placeholder="developer@company.com" 
                                    value={inviteEmail} 
                                    onChange={e => setInviteEmail(e.target.value)} 
                                    required 
                                    type="email" 
                                    className={`${inputCls} flex-1`} 
                                />
                                <button 
                                    type="submit" 
                                    disabled={invite.isPending} 
                                    className="bg-indigo-600 hover:bg-indigo-500 text-white font-semibold px-5 rounded-xl transition-all duration-200 shadow-lg shadow-indigo-600/10 active:scale-95 flex items-center gap-2 shrink-0 disabled:opacity-50"
                                >
                                    {invite.isPending ? <Loader2 size={16} className="animate-spin" /> : <Send size={15} />}
                                    Send Invite
                                </button>
                            </form>
                        </div>

                        {/* Members List */}
                        <div className="border border-zinc-800/80 rounded-xl overflow-hidden">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-[#151517] border-b border-zinc-800 text-[11px] font-bold text-zinc-500 uppercase tracking-wider">
                                        <th className="px-5 py-3">Member</th>
                                        <th className="px-5 py-3">Role</th>
                                        <th className="px-5 py-3 text-right">Status</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-zinc-800/50">
                                    {mockMembers.map((m, idx) => (
                                        <tr key={idx} className="hover:bg-[#151517]/30 transition-colors">
                                            <td className="px-5 py-4">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center text-xs font-semibold text-zinc-300">
                                                        {m.name.slice(0, 2).toUpperCase()}
                                                    </div>
                                                    <div>
                                                        <h4 className="font-semibold text-sm text-zinc-200">{m.name}</h4>
                                                        <p className="text-xs text-zinc-500 mt-0.5">{m.email}</p>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-5 py-4">
                                                <span className="flex items-center gap-1.5 text-xs text-zinc-400 font-medium">
                                                    <Shield size={12} className="text-zinc-500" />
                                                    {m.role}
                                                </span>
                                            </td>
                                            <td className="px-5 py-4 text-right">
                                                <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                                                    m.status === 'active' 
                                                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/15'
                                                        : 'bg-zinc-800 text-zinc-500 border border-zinc-700/50'
                                                }`}>
                                                    {m.status}
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {/* ─── AUDIT LOG TAB ─── */}
                {tab === 'audit' && (
                    <div className="space-y-6">
                        <div>
                            <h2 className="text-lg font-bold text-white tracking-tight">Audit Logs</h2>
                            <p className="text-xs text-zinc-500 mt-1">Full immutable ledger of platform events for this team.</p>
                        </div>

                        {audit ? (
                            <div className="border border-zinc-800/80 rounded-xl overflow-hidden">
                                <table className="w-full text-left border-collapse">
                                    <thead>
                                        <tr className="bg-[#151517] border-b border-zinc-800 text-[11px] font-bold text-zinc-500 uppercase tracking-wider">
                                            <th className="px-5 py-3">Event Action</th>
                                            <th className="px-5 py-3">Initiator</th>
                                            <th className="px-5 py-3 text-right">Timestamp</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-zinc-800/50 text-[13px]">
                                        {audit.map(log => (
                                            <tr key={log.id} className="hover:bg-[#151517]/30 transition-colors">
                                                <td className="px-5 py-4">
                                                    {formatAction(log.action)}
                                                </td>
                                                <td className="px-5 py-4 text-zinc-300">
                                                    {log.user?.name || 'System Worker'}
                                                </td>
                                                <td className="px-5 py-4 text-right text-zinc-500 text-xs">
                                                    {new Date(log.createdAt).toLocaleString()}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                                {audit.length === 0 && (
                                    <p className="text-zinc-500 text-xs py-10 italic text-center">No ledger logs recorded yet.</p>
                                )}
                            </div>
                        ) : (
                            <div className="flex flex-col items-center justify-center py-20 text-zinc-600">
                                <Loader2 className="animate-spin text-indigo-500 mb-3" size={24} />
                                <p className="text-sm font-medium">Loading ledger logs...</p>
                            </div>
                        )}
                    </div>
                )}

                {/* ─── ALERTS TAB ─── */}
                {tab === 'notifications' && (
                    <div className="space-y-6">
                        <div>
                            <h2 className="text-lg font-bold text-white tracking-tight">Alerts & Integrations</h2>
                            <p className="text-xs text-zinc-500 mt-1">Configure external messaging alerts and webhooks for events.</p>
                        </div>

                        {/* Slack integration */}
                        <div className="bg-[#151517] border border-zinc-800/60 p-5 rounded-xl space-y-4">
                            <div>
                                <h3 className="text-sm font-semibold text-white">Slack Webhook</h3>
                                <p className="text-xs text-zinc-500 mt-0.5">Post deployment notifications to your Slack workspace.</p>
                            </div>
                            <div className="flex gap-3">
                                <input 
                                    placeholder="https://hooks.slack.com/services/..." 
                                    value={slackUrl} 
                                    onChange={e => setSlackUrl(e.target.value)} 
                                    className={`${inputCls} flex-1`} 
                                />
                                <button 
                                    onClick={() => saveNotif.mutate()} 
                                    disabled={saveNotif.isPending} 
                                    className="bg-indigo-600 hover:bg-indigo-500 text-white font-semibold px-5 rounded-xl transition-all duration-200 flex items-center justify-center gap-1.5 shadow-lg active:scale-95 disabled:opacity-50"
                                >
                                    {saveNotif.isPending ? <Loader2 size={16} className="animate-spin" /> : <Save size={15} />} 
                                    Save Webhook
                                </button>
                            </div>
                        </div>

                        {/* Event Toggles */}
                        <div className="border border-zinc-800/80 rounded-xl p-5 space-y-3">
                            <h3 className="text-xs font-bold text-zinc-300 uppercase tracking-wider mb-2">Notification Preferences</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {(['emailEnabled', 'onSuccess', 'onFailure', 'onPrPreview'] as const).map(k => (
                                    <label key={k} className="flex items-center gap-3 p-3 bg-[#151517]/40 border border-zinc-800/60 rounded-xl cursor-pointer hover:border-zinc-700 transition-all hover:bg-zinc-900/40">
                                        <input
                                            type="checkbox"
                                            checked={!!notifSettings[k]}
                                            onChange={e => setNotifSettings(s => ({ ...s, [k]: e.target.checked }))}
                                            className="accent-indigo-500 w-4 h-4 rounded border-zinc-800 bg-zinc-950 cursor-pointer"
                                        />
                                        <div className="min-w-0">
                                            <span className="text-xs font-bold text-zinc-200 capitalize block leading-none">
                                                {k.replace(/([A-Z])/g, ' $1').trim()}
                                            </span>
                                        </div>
                                    </label>
                                ))}
                            </div>
                        </div>
                    </div>
                )}

            </div>
        </div>
    );
}
