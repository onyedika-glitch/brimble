import { useState } from 'react';
import { api, setToken } from '../api';
import { Loader2, Mail, Lock, User as UserIcon, ArrowRight, Users } from 'lucide-react';
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
        <div className="min-h-screen bg-[#09090b] flex items-center justify-center p-4 relative overflow-hidden">
            {/* Ambient gradient orbs */}
            <div className="absolute top-[-20%] left-[-10%] w-[600px] h-[600px] bg-indigo-600/8 rounded-full blur-[140px] pointer-events-none" />
            <div className="absolute bottom-[-20%] right-[-10%] w-[500px] h-[500px] bg-violet-600/6 rounded-full blur-[120px] pointer-events-none" />

            <div className="w-full max-w-[420px] relative z-10 animate-fadeIn">
                {/* Logo */}
                <div className="text-center mb-10">
                    <div className="inline-flex items-center justify-center w-12 h-12 bg-gradient-to-br from-indigo-500 to-violet-600 rounded-xl shadow-lg shadow-indigo-500/20 mb-4">
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M4.5 16.5c-1.5 1.38-2 2.5-2 3.5 2 0 4-1.5 5.5-3 1.5-1.5 2.5-3 3-5.5L7.5 8C5 8.5 3.5 9.5 2 11l4.5 4.5z"/>
                            <path d="m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z"/>
                            <path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0"/>
                            <path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5"/>
                        </svg>
                    </div>
                    <h1 className="text-2xl font-bold text-white tracking-tight">Rimble</h1>
                    <p className="text-zinc-500 mt-1 text-sm">Your cloud deployment platform</p>
                </div>

                {/* Card */}
                <div className="bg-[#111113] border border-zinc-800/80 rounded-2xl p-7 shadow-2xl">
                    {/* Mode toggle */}
                    <div className="flex bg-zinc-900/80 p-1 rounded-lg mb-7 border border-zinc-800/50">
                        {(['login', 'register'] as const).map(m => (
                            <button
                                key={m}
                                onClick={() => { setMode(m); setError(''); }}
                                className={`flex-1 py-2.5 text-sm font-semibold rounded-md transition-all duration-200 ${
                                    mode === m
                                        ? 'bg-zinc-800 text-white shadow-sm'
                                        : 'text-zinc-500 hover:text-zinc-300'
                                }`}
                            >
                                {m === 'login' ? 'Sign In' : 'Sign Up'}
                            </button>
                        ))}
                    </div>

                    <form onSubmit={submit} className="space-y-5">
                        {mode === 'register' && (
                            <div className="space-y-5 animate-fadeIn">
                                <InputField
                                    icon={<UserIcon size={16} />}
                                    label="Full Name"
                                    type="text"
                                    value={name}
                                    onChange={setName}
                                    placeholder="John Doe"
                                    required
                                    id="auth-name"
                                />
                                <InputField
                                    icon={<Users size={16} />}
                                    label="Team Name"
                                    type="text"
                                    value={teamName}
                                    onChange={setTeamName}
                                    placeholder="My Team (optional)"
                                    id="auth-team"
                                />
                            </div>
                        )}

                        <InputField
                            icon={<Mail size={16} />}
                            label="Email"
                            type="email"
                            value={email}
                            onChange={setEmail}
                            placeholder="you@example.com"
                            required
                            id="auth-email"
                        />
                        <InputField
                            icon={<Lock size={16} />}
                            label="Password"
                            type="password"
                            value={password}
                            onChange={setPassword}
                            placeholder="••••••••"
                            required
                            id="auth-password"
                        />

                        {error && (
                            <div className="flex items-start gap-2 text-sm text-red-400 bg-red-500/8 border border-red-500/15 rounded-lg p-3 animate-fadeIn">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="mt-0.5 shrink-0">
                                    <circle cx="12" cy="12" r="10"/><line x1="15" x2="9" y1="9" y2="15"/><line x1="9" x2="15" y1="9" y2="15"/>
                                </svg>
                                {error}
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={loading}
                            id="auth-submit"
                            className="w-full bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-lg text-sm transition-all duration-200 flex items-center justify-center gap-2 shadow-lg shadow-indigo-500/15 hover:shadow-indigo-500/25 active:scale-[0.98]"
                        >
                            {loading ? (
                                <Loader2 size={16} className="animate-spin" />
                            ) : (
                                <ArrowRight size={16} />
                            )}
                            {mode === 'login' ? 'Sign In' : 'Create Account'}
                        </button>
                    </form>
                </div>

                <p className="text-center text-zinc-600 text-xs mt-6">
                    Powered by Rimble · Zero-config deployments
                </p>
            </div>
        </div>
    );
}

function InputField({ icon, label, type, value, onChange, placeholder, required, id }: {
    icon: React.ReactNode;
    label: string;
    type: string;
    value: string;
    onChange: (v: string) => void;
    placeholder: string;
    required?: boolean;
    id?: string;
}) {
    return (
        <div>
            <label htmlFor={id} className="block text-sm font-medium text-zinc-400 mb-1.5">{label}</label>
            <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500">{icon}</span>
                <input
                    id={id}
                    type={type}
                    value={value}
                    onChange={e => onChange(e.target.value)}
                    placeholder={placeholder}
                    required={required}
                    className="w-full bg-zinc-900/60 border border-zinc-800 rounded-lg pl-10 pr-4 py-2.5 text-sm text-white placeholder:text-zinc-600 transition-all duration-200 hover:border-zinc-700"
                />
            </div>
        </div>
    );
}
