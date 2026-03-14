'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import type { Incident, Responder } from '@/types/incident';

type TopBarProps = {
  incidents: Pick<Incident, 'id' | 'title' | 'status'>[];
  currentId: string;
  elapsed: number;
  responders: Responder[];
};

export function TopBar({ incidents, currentId, elapsed, responders }: TopBarProps) {
  const router = useRouter();
  const [elapsedMinutes, setElapsedMinutes] = useState(elapsed);

  useEffect(() => {
    setElapsedMinutes(elapsed);
    const interval = setInterval(() => {
      setElapsedMinutes((prev) => prev + 1);
    }, 60_000);
    return () => clearInterval(interval);
  }, [elapsed]);

  const current = incidents.find((i) => i.id === currentId);
  const isLive = current?.status === 'open' || current?.status === 'investigating';

  function formatElapsed(minutes: number): string {
    if (minutes < 60) return `${minutes}m`;
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return `${h}h ${m}m`;
  }

  return (
    <header className="sticky top-0 z-10 h-14 bg-bg-secondary border-b border-border-base flex items-center px-6 gap-4">
      <span className="font-mono text-sm text-text-muted">IncidentHub</span>

      <select
        className="bg-bg-card border border-border-base text-text-primary text-sm rounded px-3 py-1 font-mono focus:outline-none focus:border-border-active"
        value={currentId}
        onChange={(e) => router.push(`/?id=${e.target.value}`)}
      >
        {incidents.map((inc) => (
          <option key={inc.id} value={inc.id}>
            {inc.id} — {inc.title}
          </option>
        ))}
      </select>

      {isLive && (
        <span className="flex items-center gap-1.5 text-xs font-mono text-red-400">
          <span className="w-2 h-2 rounded-full bg-red-400 animate-pulse" />
          LIVE
        </span>
      )}

      <span className="font-mono text-sm text-text-secondary">{formatElapsed(elapsedMinutes)}</span>

      <div className="ml-auto flex items-center gap-2">
        {responders.map((r) => (
          <div
            key={r.name}
            className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-mono text-white"
            style={{ backgroundColor: r.avatarColor }}
            title={`${r.name} (${r.role})`}
          >
            {r.name[0]}
          </div>
        ))}
      </div>
    </header>
  );
}
