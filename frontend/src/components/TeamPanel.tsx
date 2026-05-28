import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../api';
import { Loader2, Users, BarChart2, FileText, Bell, ChevronRight } from 'lucide-react';
import type { Team, AuditLog, UsageData, NotificationSetting } from '../types';

export function TeamPanel({ team }: { team: Team }) {
    const qc = useQueryClient();
    const [tab, setTab] = useState<'members' | 'audit' | 'usage' | 'notifications'>('usage');
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

    const inputCls = 'bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 transition-all w-full';
    const btnCls = 'bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-bold px-4 py-2 rounded-lg transition-all flex items-center gap-1.5';

    const tabs = [
        { key: 'usage', label: 'Usage', icon: BarChart2 },
        { key: 'audit', label: 'Audit Log', icon: FileText },
        { key: 'members', label: 'Members', icon: Users },
        { key: 'notifications', label: 'Alerts', icon: Bell },
    ] as const;

    return (
        <div className="bg-zinc-900/40 border border-zinc-800/50 rounded-2xl p-5 shadow-xl backdrop-blur-xl">
            <div className="flex items-center justify-between mb-4">
                <div>
                    <h3 className="font-bold text-white text-sm">{team.name}</h3>
                    <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">{team.plan} plan · {team.role}</span>
                </div>
            </div>

            <div className="flex gap-1 bg-zinc-950 p-1 rounded-xl mb-4 overflow-x-auto">
                {tabs.map(({ key, label, icon: Icon }) => (
                    <button key={key} onClick={() => setTab(key as 'members' | 'audit' | 'usage' | 'notifications')}
                        className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all whitespace-nowrap ${tab === key ? 'bg-zinc-800 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}>
                        <Icon size={10} />{label}
                    </button>
                ))}
            </div>

            {tab === 'usage' && usage && (
                <div className="space-y-3">
                    {Object.entries(usage.usage).map(([metric, value]: [string, number]) => {
                        const limit = usage.limits[metric] || 1;
                        const pct = Math.min((value / limit) * 100, 100);
                        return (
                            <div key={metric}>
                                <div className="flex justify-between text-[10px] text-zinc-500 mb-1">
                                    <span className="uppercase font-bold">{metric.replace(/_/g, ' ')}</span>
                                    <span>{value.toFixed(1)} / {limit === Infinity ? '∞' : limit}</span>
                                </div>
                                <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                                    <div className={`h-full rounded-full transition-all ${pct > 85 ? 'bg-rose-500' : pct > 60 ? 'bg-amber-500' : 'bg-indigo-500'}`}
                                        style={{ width: `${pct}%` }} />
                                </div>
                            </div>
                        );
                    })}
                    <div className="text-[10px] text-zinc-600 pt-1">Plan: <span className="text-zinc-400 font-bold capitalize">{usage.plan}</span></div>
                </div>
            )}

            {tab === 'audit' && (
                <div className="space-y-1 max-h-60 overflow-y-auto">
                    {audit?.map(log => (
                        <div key={log.id} className="flex items-start gap-2 text-[11px] py-1.5 border-b border-zinc-800/50 last:border-0">
                            <ChevronRight size={10} className="text-zinc-600 mt-0.5 shrink-0" />
                            <div>
                                <span className="text-indigo-400 font-bold font-mono">{log.action}</span>
                                <span className="text-zinc-500 ml-2">{new Date(log.createdAt).toLocaleString()}</span>
                                {log.user && <span className="text-zinc-600 ml-2">by {log.user.name}</span>}
                            </div>
                        </div>
                    ))}
                    {(!audit || audit.length === 0) && <p className="text-zinc-600 text-xs italic">No audit events yet.</p>}
                </div>
            )}

            {tab === 'members' && (
                <div className="space-y-3">
                    <form onSubmit={e => { e.preventDefault(); invite.mutate(); }} className="flex gap-2">
                        <input placeholder="colleague@company.com" value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} required type="email" className={`${inputCls} flex-1`} />
                        <button type="submit" disabled={invite.isPending} className={btnCls}>
                            {invite.isPending ? <Loader2 size={11} className="animate-spin" /> : 'Invite'}
                        </button>
                    </form>
                </div>
            )}

            {tab === 'notifications' && (
                <div className="space-y-3">
                    <input placeholder="https://hooks.slack.com/..." value={slackUrl} onChange={e => setSlackUrl(e.target.value)} className={inputCls} />
                    <div className="grid grid-cols-2 gap-2">
                        {(['emailEnabled', 'onSuccess', 'onFailure', 'onPrPreview'] as const).map(k => (
                            <label key={k} className="flex items-center gap-2 text-xs text-zinc-400 cursor-pointer">
                                <input type="checkbox" checked={!!notifSettings[k]} onChange={e => setNotifSettings(s => ({ ...s, [k]: e.target.checked }))} className="accent-indigo-500" />
                                {k.replace(/([A-Z])/g, ' $1').trim()}
                            </label>
                        ))}
                    </div>
                    <button onClick={() => saveNotif.mutate()} disabled={saveNotif.isPending} className={`${btnCls} w-full justify-center`}>
                        {saveNotif.isPending ? <Loader2 size={11} className="animate-spin" /> : 'Save Notification Settings'}
                    </button>
                </div>
            )}
        </div>
    );
}
