import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import type { Deployment, DeploymentStatus, Log } from './types.ts';
import { Rocket, Loader2, ExternalLink, Terminal, CheckCircle2, XCircle, Clock, ArrowLeft } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const API_BASE = '/api';

// Add some global styles for the animations
const extraStyles = `
  @keyframes blob {
    0% { transform: translate(0px, 0px) scale(1); }
    33% { transform: translate(30px, -50px) scale(1.1); }
    66% { transform: translate(-20px, 20px) scale(0.9); }
    100% { transform: translate(0px, 0px) scale(1); }
  }
  .animate-blob {
    animation: blob 7s infinite;
  }
  .animation-delay-2000 {
    animation-delay: 2s;
  }
  .animation-delay-4000 {
    animation-delay: 4s;
  }
`;

export default function App() {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [gitUrl, setGitUrl] = useState('');
  const queryClient = useQueryClient();

  const { data: deployments, isLoading } = useQuery<Deployment[]>({
    queryKey: ['deployments'],
    queryFn: async () => {
      const res = await axios.get(`${API_BASE}/deployments`);
      return res.data;
    },
    refetchInterval: 5000,
  });

  const createMutation = useMutation({
    mutationFn: async (url: string) => {
      const res = await axios.post(`${API_BASE}/deployments`, { gitUrl: url });
      return res.data;
    },
    onSuccess: (data) => {
      setGitUrl('');
      setSelectedId(data.id);
      queryClient.invalidateQueries({ queryKey: ['deployments'] });
    },
  });

  const relaunchMutation = useMutation({
    mutationFn: async () => {
      const { data } = await axios.post(`${API_BASE}/deployments/${selectedId}/relaunch`);
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['deployments'] });
      setSelectedId(data.id);
    }
  });

  const selectedDeployment = deployments?.find(d => d.id === selectedId);

  return (
    <div className="min-h-screen bg-[#050505] text-zinc-100 p-4 md:p-8 font-sans selection:bg-indigo-500/30 overflow-hidden relative">
      <style>{extraStyles}</style>

      {/* Dynamic Background Blobs */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none -z-10">
        <div className="absolute -top-40 -left-40 w-96 h-96 bg-indigo-600/20 rounded-full blur-[120px] animate-blob" />
        <div className="absolute top-1/4 -right-20 w-80 h-80 bg-blue-600/10 rounded-full blur-[100px] animate-blob animation-delay-2000" />
        <div className="absolute -bottom-40 left-1/3 w-96 h-96 bg-purple-600/10 rounded-full blur-[120px] animate-blob animation-delay-4000" />
      </div>

      <div className="max-w-6xl mx-auto relative z-10">
        <header className="flex items-center justify-between mb-12">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-600 rounded-lg flex items-center justify-center shadow-lg shadow-indigo-500/20">
              <Rocket className="text-white w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Brimble Pipeline</h1>
              <p className="text-zinc-500 text-sm">Deployment Control Center</p>
            </div>
          </div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column: Form and List */}
          <div className="lg:col-span-1 space-y-8">
            <section className="bg-zinc-900/40 border border-zinc-800/50 rounded-2xl p-6 shadow-2xl backdrop-blur-xl transition-all hover:border-zinc-700/50">
              <h2 className="text-sm font-bold mb-5 flex items-center gap-2 text-zinc-400 uppercase tracking-[0.2em]">
                <Terminal size={14} className="text-indigo-400" />
                New Deployment
              </h2>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (gitUrl) createMutation.mutate(gitUrl);
                }}
                className="space-y-4"
              >
                <div>
                  <label className="block text-xs font-medium text-zinc-500 uppercase tracking-wider mb-1.5">
                    Git Repository URL
                  </label>
                  <input
                    type="url"
                    placeholder="https://github.com/user/repo"
                    value={gitUrl}
                    onChange={(e) => setGitUrl(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                  />
                </div>
                <button
                  type="submit"
                  disabled={createMutation.isPending || !gitUrl}
                  className="w-full bg-white text-black hover:bg-zinc-200 disabled:opacity-50 disabled:hover:bg-white font-bold py-3 rounded-xl text-xs uppercase tracking-widest transition-all active:scale-[0.98] flex items-center justify-center gap-2 shadow-xl shadow-white/5"
                >
                  {createMutation.isPending ? (
                    <Loader2 className="animate-spin text-zinc-900" size={16} />
                  ) : 'Launch Instance'}
                </button>
              </form>
            </section>

            <section className="bg-zinc-900/40 border border-zinc-800/50 rounded-2xl overflow-hidden shadow-2xl backdrop-blur-xl transition-all">
              <div className="p-5 border-b border-zinc-800/50 flex items-center justify-between bg-white/5">
                <h2 className="text-[10px] font-bold text-zinc-500 uppercase tracking-[0.25em]">Deployments</h2>
                <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
              </div>
              <div className="divide-y divide-zinc-800">
                {isLoading ? (
                  <div className="p-8 flex justify-center">
                    <Loader2 className="animate-spin text-zinc-600" />
                  </div>
                ) : deployments?.length === 0 ? (
                  <div className="p-8 text-center text-zinc-500 text-sm italic">
                    No deployments yet.
                  </div>
                ) : (
                  deployments?.map((d) => (
                    <button
                      key={d.id}
                      onClick={() => setSelectedId(d.id)}
                      className={cn(
                        "w-full text-left p-4 hover:bg-zinc-800/50 transition-colors group",
                        selectedId === d.id && "bg-indigo-500/5 border-l-2 border-indigo-500"
                      )}
                    >
                      <div className="flex items-start justify-between mb-1">
                        <span className="font-mono text-xs font-bold text-zinc-300">{d.name}</span>
                        <StatusBadge status={d.status} />
                      </div>
                      <div className="text-[11px] text-zinc-500 truncate mb-2">
                        {d.gitUrl}
                      </div>
                      {d.liveUrl && d.status === 'running' && (
                        <a
                          href={d.liveUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-[11px] text-indigo-400 flex items-center gap-1 hover:underline mt-1"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <ExternalLink size={10} /> {d.liveUrl}
                        </a>
                      )}
                    </button>
                  ))
                )}
              </div>
            </section>
          </div>

          {/* Right Column: Details & Logs */}
          <div className="lg:col-span-2">
            {selectedId ? (
              <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="bg-zinc-900/40 border border-zinc-800/50 rounded-3xl p-8 shadow-2xl backdrop-blur-2xl relative overflow-hidden group">
                  <button
                    onClick={() => setSelectedId(null)}
                    className="absolute top-4 left-4 z-20 p-2 rounded-full bg-zinc-900/50 border border-zinc-800 hover:bg-zinc-800 transition-all text-zinc-400 hover:text-white"
                  >
                    <ArrowLeft size={16} />
                  </button>
                  <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:opacity-20 transition-opacity">
                    <Rocket size={120} />
                  </div>
                  <div className="flex justify-between items-start mb-10 relative z-10">
                    <div className="flex items-center gap-4">
                      <button
                        onClick={() => setSelectedId(null)}
                        className="p-2 rounded-full bg-zinc-900/50 border border-zinc-800 hover:bg-zinc-800 transition-all text-zinc-400 hover:text-white"
                        title="Close details"
                      >
                        <ArrowLeft size={20} />
                      </button>
                      <div>
                        <h3 className="text-2xl font-black mb-1.5 tracking-tight">
                          {selectedDeployment?.name}
                        </h3>
                        <p className="text-indigo-400/60 text-[10px] font-bold uppercase tracking-[0.3em]">
                          {selectedId}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => relaunchMutation.mutate()}
                        disabled={relaunchMutation.isPending}
                        className="flex items-center gap-2 px-4 py-2 bg-indigo-500/10 border border-indigo-500/20 rounded-xl text-indigo-400 font-bold text-xs uppercase tracking-widest hover:bg-indigo-500/20 transition-all disabled:opacity-50"
                      >
                        {relaunchMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <Rocket size={14} />}
                        Relaunch
                      </button>
                      <StatusBadge status={selectedDeployment?.status || 'pending'} size="lg" />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 py-6 border-y border-zinc-800">
                    <Stat label="Image Tag" value={selectedDeployment?.imageTag || '—'} />
                    <Stat label="Status" value={selectedDeployment?.status.toUpperCase() || '—'} />
                    <Stat label="Live URL" value={selectedDeployment?.liveUrl || '—'} isUrl />
                    <Stat label="Created" value={selectedDeployment ? new Date(selectedDeployment.createdAt).toLocaleTimeString() : '—'} />
                  </div>

                  <div className="mt-8">
                    <div className="flex items-center justify-between mb-4">
                      <h4 className="text-sm font-bold flex items-center gap-2 text-indigo-400">
                        <Terminal size={14} />
                        Live Deployment Logs
                      </h4>
                    </div>
                    <LogViewer key={selectedId} deploymentId={selectedId} status={selectedDeployment?.status} />
                  </div>
                </div>
              </div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center border-2 border-dashed border-zinc-800 rounded-3xl p-12 text-zinc-600">
                <Rocket size={48} className="mb-4 opacity-10" />
                <p className="text-lg">Select a deployment to view details and live logs</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function StatusBadge({ status, size = 'sm' }: { status: DeploymentStatus; size?: 'sm' | 'lg' }) {
  const configs = {
    pending: { color: 'bg-zinc-500', icon: Clock, label: 'Pending' },
    building: { color: 'bg-amber-500', icon: Loader2, label: 'Building', animate: true },
    deploying: { color: 'bg-blue-500', icon: Loader2, label: 'Deploying', animate: true },
    running: { color: 'bg-emerald-500', icon: CheckCircle2, label: 'Running' },
    failed: { color: 'bg-rose-500', icon: XCircle, label: 'Failed' },
  };

  const config = configs[status];
  const Icon = config.icon;
  const shouldAnimate = 'animate' in config && config.animate;

  return (
    <span className={cn(
      "inline-flex items-center gap-1.5 rounded-full font-bold uppercase tracking-wider",
      size === 'sm' ? "text-[9px] px-2 py-0.5" : "text-[11px] px-3 py-1",
      config.color,
      "text-white bg-opacity-10 border border-current border-opacity-20"
    )}>
      <Icon size={size === 'sm' ? 10 : 12} className={cn(shouldAnimate && "animate-spin")} />
      {config.label}
    </span>
  );
}

function Stat({ label, value, isUrl }: { label: string; value: string; isUrl?: boolean }) {
  return (
    <div>
      <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1">{label}</div>
      <div className={cn(
        "text-sm font-mono truncate",
        isUrl && value !== '—' ? "text-indigo-400 underline underline-offset-4" : "text-zinc-200"
      )}>
        {isUrl && value !== '—' ? <a href={value} target="_blank" rel="noreferrer">{value}</a> : value}
      </div>
    </div>
  );
}

function LogViewer({ deploymentId, status }: { deploymentId: string; status?: DeploymentStatus }) {
  const [logs, setLogs] = useState<string[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const active = true;

    // Fetch initial logs
    axios.get(`${API_BASE}/deployments/${deploymentId}`).then(res => {
      if (active) {
        setLogs(res.data.logs?.map((l: Log) => l.content) || []);
      }
    });

    const eventSource = new EventSource(`${API_BASE}/deployments/${deploymentId}/logs/stream`);

    eventSource.onmessage = (event) => {
      const { message } = JSON.parse(event.data);
      setLogs(prev => [...prev, message]);
    };

    return () => {
      eventSource.close();
    };
  }, [deploymentId]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs]);

  return (
    <div className="bg-zinc-950 rounded-lg p-4 font-mono text-[12px] leading-relaxed h-[400px] overflow-y-auto border border-zinc-800" ref={scrollRef}>
      {logs.map((log, i) => (
        <div key={i} className="text-zinc-400 whitespace-pre-wrap py-0.5">
          <span className="text-zinc-600 mr-2">[{i + 1}]</span>
          {log}
        </div>
      ))}
      {(status === 'building' || status === 'deploying') && (
        <div className="flex items-center gap-2 text-indigo-400 mt-2 italic shadow-indigo-500/20 drop-shadow-lg">
          <Loader2 size={12} className="animate-spin" />
          Streaming live output...
        </div>
      )}
    </div>
  );
}
