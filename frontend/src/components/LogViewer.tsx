import { useReducer, useEffect, useRef, useMemo } from 'react';
import { Loader2, Terminal } from 'lucide-react';
import type { DeploymentStatus, Log } from '../types';
import { API_BASE } from '../api';

type Action = { type: 'reset' } | { type: 'append'; msg: string };

function reducer(state: string[], action: Action): string[] {
    if (action.type === 'reset') return [];
    return [...state, action.msg];
}

export function LogViewer({ deploymentId, status, logs: initialLogs }: {
    deploymentId: string;
    status?: DeploymentStatus;
    logs?: Log[];
}) {
    const base = useMemo(() => initialLogs?.map(l => l.content) ?? [], [initialLogs]);
    const [streamed, dispatch] = useReducer(reducer, []);
    const logs = useMemo(() => [...base, ...streamed], [base, streamed]);
    const scrollRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        dispatch({ type: 'reset' });
        const es = new EventSource(`${API_BASE}/deployments/${deploymentId}/logs/stream`);
        es.onmessage = (event) => {
            const { message } = JSON.parse(event.data);
            dispatch({ type: 'append', msg: message });
        };
        return () => es.close();
    }, [deploymentId]);

    useEffect(() => {
        if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }, [logs]);

    return (
        <div className="flex flex-col h-full">
            <h4 className="text-xs font-bold flex items-center gap-2 text-indigo-400 mb-3 shrink-0">
                <Terminal size={12} /> Live Logs
            </h4>
            <div ref={scrollRef} className="flex-1 min-h-[220px] bg-zinc-950 rounded-xl p-4 font-mono text-[11px] leading-relaxed overflow-y-auto border border-zinc-800/80 shadow-inner">
                {logs.length === 0 && <span className="text-zinc-600 italic">No logs yet...</span>}
                {logs.map((log, i) => (
                    <div key={i} className="text-zinc-400 whitespace-pre-wrap py-0.5 border-b border-zinc-900/50 last:border-0">
                        <span className="text-zinc-600 mr-2 text-[10px]">[{String(i + 1).padStart(3, '0')}]</span>{log}
                    </div>
                ))}
                {(status === 'building' || status === 'deploying') && (
                    <div className="flex items-center gap-2 text-indigo-400 mt-4 bg-indigo-500/10 p-2 rounded italic text-[11px]">
                        <Loader2 size={11} className="animate-spin" /> Streaming live output...
                    </div>
                )}
            </div>
        </div>
    );
}
