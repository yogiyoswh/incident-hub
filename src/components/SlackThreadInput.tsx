'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { ApiResponse, IncidentSeverity, SlackThreadBriefingResponse } from '@/types/incident';

type Status = 'idle' | 'loading' | 'error';

type SlackThreadInputProps = {
  className?: string;
};

const SEVERITY_OPTIONS: { value: IncidentSeverity; label: string; color: string }[] = [
  { value: 'critical', label: 'Critical', color: 'text-red-400' },
  { value: 'high', label: 'High', color: 'text-orange-400' },
  { value: 'medium', label: 'Medium', color: 'text-yellow-400' },
  { value: 'low', label: 'Low', color: 'text-green-400' },
];

export function SlackThreadInput({ className }: SlackThreadInputProps) {
  const router = useRouter();
  const [url, setUrl] = useState('');
  const [severity, setSeverity] = useState<IncidentSeverity>('medium');
  const [status, setStatus] = useState<Status>('idle');
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!url.trim()) return;

    setStatus('loading');
    setError(null);

    try {
      const res = await fetch('/api/analyze/slack-thread', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slackThreadUrl: url.trim(), severity }),
      });

      const data = (await res.json()) as ApiResponse<SlackThreadBriefingResponse>;

      if (!data.success) {
        setStatus('error');
        setError(data.error);
        return;
      }

      router.push(`/?id=${data.data.incidentId}`);
      router.refresh();
    } catch {
      setStatus('error');
      setError('네트워크 오류가 발생했습니다');
    }
  }

  function handleUrlChange(e: React.ChangeEvent<HTMLInputElement>) {
    setUrl(e.target.value);
    if (status === 'error') {
      setStatus('idle');
      setError(null);
    }
  }

  return (
    <div className={className}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <div className="flex gap-2">
          <input
            type="text"
            value={url}
            onChange={handleUrlChange}
            placeholder="https://...slack.com/archives/.../p..."
            className="flex-1 bg-bg-secondary border border-border-base rounded px-3 py-2 text-sm font-mono text-text-primary placeholder-text-muted focus:outline-none focus:border-blue-500"
            disabled={status === 'loading'}
          />
          <select
            value={severity}
            onChange={(e) => setSeverity(e.target.value as IncidentSeverity)}
            disabled={status === 'loading'}
            className="bg-bg-secondary border border-border-base rounded px-2 py-2 text-sm font-mono text-text-primary focus:outline-none focus:border-blue-500"
          >
            {SEVERITY_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          <button
            type="submit"
            disabled={status === 'loading' || !url.trim()}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-mono rounded transition-colors whitespace-nowrap"
          >
            {status === 'loading' ? '분석 중...' : '장애 열기'}
          </button>
        </div>

        {status === 'loading' && (
          <p className="text-xs font-mono text-text-muted">
            Slack 메시지 수집 → AI 브리핑 + 타임라인 생성 중...
          </p>
        )}

        {status === 'error' && error && (
          <p className="text-xs font-mono text-red-400">{error}</p>
        )}
      </form>
    </div>
  );
}
