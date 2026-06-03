import { useState } from 'react';
import { ArrowRight, Loader2, Lock, Mail, Rocket, User as UserIcon, Users } from 'lucide-react';
import { api, setToken } from '../api';
import type { Team, User } from '../types';

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
            const payload = mode === 'login' ? { email, password } : { email, password, name, teamName };
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
        <div className="flex min-h-screen items-center justify-center bg-[#09090b] p-4">
            <div className="w-full max-w-[420px] animate-fadeIn">
                <div className="mb-8 text-center">
                    <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 shadow-lg shadow-indigo-500/20">
                        <Rocket size={22} className="text-white" />
                    </div>
                    <h1 className="text-2xl font-bold text-white">Brimble</h1>
                    <p className="mt-1 text-sm text-zinc-500">Deployment infrastructure for compact teams</p>
                </div>

                <div className="rounded-lg border border-zinc-800/80 bg-[#111113] p-7 shadow-2xl">
                    <div className="mb-7 flex rounded-lg border border-zinc-800/50 bg-zinc-900/80 p-1">
                        {(['login', 'register'] as const).map((m) => (
                            <button
                                key={m}
                                onClick={() => {
                                    setMode(m);
                                    setError('');
                                }}
                                className={`flex-1 rounded-md py-2.5 text-sm font-semibold ${
                                    mode === m ? 'bg-zinc-800 text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-300'
                                }`}
                            >
                                {m === 'login' ? 'Sign In' : 'Sign Up'}
                            </button>
                        ))}
                    </div>

                    <form onSubmit={submit} className="space-y-5">
                        {mode === 'register' && (
                            <div className="space-y-5 animate-fadeIn">
                                <InputField icon={<UserIcon size={16} />} label="Full Name" type="text" value={name} onChange={setName} placeholder="Jane Doe" required id="auth-name" />
                                <InputField icon={<Users size={16} />} label="Team Name" type="text" value={teamName} onChange={setTeamName} placeholder="Platform Team" id="auth-team" />
                            </div>
                        )}

                        <InputField icon={<Mail size={16} />} label="Email" type="email" value={email} onChange={setEmail} placeholder="you@example.com" required id="auth-email" />
                        <InputField icon={<Lock size={16} />} label="Password" type="password" value={password} onChange={setPassword} placeholder="Enter password" required id="auth-password" />

                        {error && (
                            <div className="flex items-start gap-2 rounded-lg border border-red-500/15 bg-red-500/10 p-3 text-sm text-red-400 animate-fadeIn">
                                <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-red-400" />
                                {error}
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={loading}
                            id="auth-submit"
                            className="flex w-full items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-indigo-600 to-indigo-500 py-3 text-sm font-semibold text-white shadow-lg shadow-indigo-500/15 hover:from-indigo-500 hover:to-indigo-400 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            {loading ? <Loader2 size={16} className="animate-spin" /> : <ArrowRight size={16} />}
                            {mode === 'login' ? 'Sign In' : 'Create Account'}
                        </button>
                    </form>
                </div>

                <p className="mt-6 text-center text-xs text-zinc-600">Powered by Brimble / Zero-config deployments</p>
            </div>
        </div>
    );
}

function InputField({
    icon,
    label,
    type,
    value,
    onChange,
    placeholder,
    required,
    id,
}: {
    icon: React.ReactNode;
    label: string;
    type: string;
    value: string;
    onChange: (value: string) => void;
    placeholder: string;
    required?: boolean;
    id?: string;
}) {
    return (
        <div>
            <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-zinc-400">{label}</label>
            <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500">{icon}</span>
                <input
                    id={id}
                    type={type}
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    placeholder={placeholder}
                    required={required}
                    className="w-full rounded-lg border border-zinc-800 bg-zinc-900/60 py-2.5 pl-10 pr-4 text-sm text-white placeholder:text-zinc-600 hover:border-zinc-700"
                />
            </div>
        </div>
    );
}
