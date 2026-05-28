import { useState } from 'react';
import { api, setToken } from '../api';
import { Rocket, Loader2, Mail, Lock, User as UserIcon, ArrowRight } from 'lucide-react';
import type { User, Team } from '../types';

interface Props {
    onAuth: (token: string, user: User, teams: Team[]) => void;
}

export function AuthPage({ onAuth }: Props) {
    const [mode, setMode] = useState<'login' | 'register'>('login');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [name, setName] = useState('');
    const [teamName, setTeamName] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const submit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        try {
            const payload = mode === 'login'
                ? { email, password }
                : { email, password, name, teamName };
            const res = await api.post(`/auth/${mode}`, payload);
            setToken(res.data.token);
            onAuth(res.data.token, res.data.user, res.data.teams || []);
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : 'Something went wrong';
            const axiosErr = err as { response?: { data?: { error?: string } } };
            setError(axiosErr.response?.data?.error || msg);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-[#050505] flex items-center justify-center p-4 relative overflow-hidden">
            <div className="absolute -top-40 -left-40 w-96 h-96 bg-indigo-600/20 rounded-full blur-[120px]" />
            <div className="absolute -bottom-40 right-0 w-96 h-96 bg-purple-600/10 rounded-full blur-[120px]" />

            <div className="w-full max-w-md relative z-10">
                <div className="text-center mb-8">
                    <div className="w-14 h-14 bg-indigo-600 rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-500/30 mx-auto mb-4">
                        <Rocket className="text-white w-7 h-7" />
                    </div>
                    <h1 className="text-3xl font-black text-white tracking-tight">Rimble</h1>
                    <p className="text-zinc-500 mt-1 text-sm">Your personal PaaS platform</p>
                </div>

                <div className="bg-zinc-900/60 border border-zinc-800/60 rounded-3xl p-8 shadow-2xl backdrop-blur-xl">
                    <div className="flex gap-1 bg-zinc-950 p-1 rounded-xl mb-6">
                        {(['login', 'register'] as const).map(m => (
                            <button key={m} onClick={() => { setMode(m); setError(''); }}
                                className={`flex-1 py-2 text-xs font-bold uppercase tracking-widest rounded-lg transition-all ${mode === m ? 'bg-zinc-800 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}>
                                {m === 'login' ? 'Sign In' : 'Sign Up'}
                            </button>
                        ))}
                    </div>

                    <form onSubmit={submit} className="space-y-4">
                        {mode === 'register' && (
                            <>
                                <Field icon={<UserIcon size={14} />} label="Full Name" type="text" value={name} onChange={setName} placeholder="Your name" required />
                                <Field icon={<UserIcon size={14} />} label="Team Name (optional)" type="text" value={teamName} onChange={setTeamName} placeholder="Acme Inc" />
                            </>
                        )}
                        <Field icon={<Mail size={14} />} label="Email" type="email" value={email} onChange={setEmail} placeholder="you@example.com" required />
                        <Field icon={<Lock size={14} />} label="Password" type="password" value={password} onChange={setPassword} placeholder="••••••••" required />

                        {error && (
                            <div className="text-red-400 text-xs bg-red-500/10 border border-red-500/20 rounded-lg p-3">{error}</div>
                        )}

                        <button type="submit" disabled={loading}
                            className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-bold py-3 rounded-xl text-sm uppercase tracking-widest transition-all flex items-center justify-center gap-2 shadow-lg shadow-indigo-500/20">
                            {loading ? <Loader2 size={16} className="animate-spin" /> : <ArrowRight size={16} />}
                            {mode === 'login' ? 'Sign In' : 'Create Account'}
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
}

function Field({ icon, label, type, value, onChange, placeholder, required }: {
    icon: React.ReactNode; label: string; type: string;
    value: string; onChange: (v: string) => void;
    placeholder: string; required?: boolean;
}) {
    return (
        <div>
            <label className="block text-xs font-bold text-zinc-500 uppercase tracking-widest mb-1.5">{label}</label>
            <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500">{icon}</span>
                <input type={type} value={value} onChange={e => onChange(e.target.value)}
                    placeholder={placeholder} required={required}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl pl-9 pr-4 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 transition-all" />
            </div>
        </div>
    );
}
