import { useReducer, useEffect, useRef, useMemo } from 'react';
import { Loader2, Terminal, Circle } from 'lucide-react';
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

    const isStreaming = status === 'building' || status === 'deploying';

    return (
        <div className="flex flex-col h-full">
            {/* Header */}
            <div className="flex items-center justify-between mb-3 shrink-0">
                <h4 className="text-sm font-medium flex items-center gap-2 text-zinc-300">
                    <Terminal size={14} className="text-indigo-400" />
                    Build & Deploy Logs
                </h4>
                {isStreaming && (
                    <span className="flex items-center gap-1.5 text-xs text-emerald-400 font-medium">
                        <Circle size={6} fill="currentColor" className="animate-pulse" />
                        Live
                    </span>
                )}
            </div>

            {/* Log output */}
            <div
                ref={scrollRef}
                className="flex-1 min-h-0 bg-[#0c0c0e] rounded-xl p-4 font-mono text-[12px] leading-[1.7] overflow-y-auto border border-zinc-800/60 shadow-inner"
                id="log-output"
            >
                {logs.length === 0 && (
                    <span className="text-zinc-600 italic text-sm">Waiting for output...</span>
                )}
                {logs.map((log, i) => (
                    <div key={i} className="text-zinc-400 whitespace-pre-wrap py-px hover:bg-zinc-800/20 px-1 -mx-1 rounded transition-colors">
                        <span className="text-zinc-600 select-none mr-3 text-[11px] inline-block w-8 text-right">{i + 1}</span>
                        {colorize(log)}
                    </div>
                ))}
                {isStreaming && (
                    <div className="flex items-center gap-2 text-indigo-400 mt-3 text-[12px]">
                        <Loader2 size={12} className="animate-spin" />
                        <span className="opacity-70">Streaming live output...</span>
                    </div>
                )}
            </div>
        </div>
    );
}

/** Simple log colorization */
function colorize(line: string) {
    if (line.includes('✅') || line.includes('success') || line.includes('complete'))
        return <span className="text-emerald-400">{line}</span>;
    if (line.includes('❌') || line.includes('Error') || line.includes('error') || line.includes('failed'))
        return <span className="text-red-400">{line}</span>;
    if (line.includes('⚠️') || line.includes('warn'))
        return <span className="text-amber-400">{line}</span>;
    if (line.includes('🔨') || line.includes('📥') || line.includes('🚀') || line.includes('🔍'))
        return <span className="text-indigo-300">{line}</span>;
    return line;
}
