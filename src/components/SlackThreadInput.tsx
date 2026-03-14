'use client';

import { useState } from 'react';
import type { ApiResponse, BriefingPromptResult, SlackThreadBriefingResponse } from '@/types/incident';

type Status = 'idle' | 'loading' | 'success' | 'error';

type SlackThreadInputProps = {
  className?: string;
};

export function SlackThreadInput({ className }: SlackThreadInputProps) {
  const [url, setUrl] = useState('');
  const [status, setStatus] = useState<Status>('idle');
  const [briefing, setBriefing] = useState<BriefingPromptResult | null>(null);
  const [messageCount, setMessageCount] = useState(0);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!url.trim()) return;

    setStatus('loading');
    setBriefing(null);
    setError(null);

    try {
      const res = await fetch('/api/analyze/slack-thread', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slackThreadUrl: url.trim() }),
      });

      const data = (await res.json()) as ApiResponse<SlackThreadBriefingResponse>;

      if (!data.success) {
        setStatus('error');
        setError(data.error);
        return;
      }

      setBriefing(data.data.briefing);
      setMessageCount(data.data.messageCount);
      setStatus('success');
    } catch {
      setStatus('error');
      setError('네트워크 오류가 발생했습니다');
    }
  }

  function handleUrlChange(e: React.ChangeEvent<HTMLInputElement>) {
    setUrl(e.target.value);
    if (status !== 'idle') {
      setStatus('idle');
      setBriefing(null);
      setError(null);
    }
  }

  return (
    <div className={className}>
      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          type="text"
          value={url}
          onChange={handleUrlChange}
          placeholder="https://...slack.com/archives/.../p..."
          className="flex-1 bg-bg-secondary border border-border-base rounded px-3 py-2 text-sm font-mono text-text-primary placeholder-text-muted focus:outline-none focus:border-blue-500"
          disabled={status === 'loading'}
        />
        <button
          type="submit"
          disabled={status === 'loading' || !url.trim()}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-mono rounded transition-colors"
        >
          {status === 'loading' ? '분석 중...' : '브리핑 생성'}
        </button>
      </form>

      {status === 'loading' && (
        <p className="mt-3 text-xs font-mono text-text-muted">
          Slack 메시지 수집 후 AI가 브리핑을 생성합니다...
        </p>
      )}

      {status === 'error' && error && (
        <p className="mt-3 text-xs font-mono text-red-400">{error}</p>
      )}

      {status === 'success' && briefing && (
        <div className="mt-4">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-xs font-mono px-2 py-0.5 bg-blue-500/20 text-blue-400 rounded">
              AI Generated
            </span>
            <span className="text-xs font-mono text-text-muted">
              메시지 {messageCount}개 분석
            </span>
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            <BriefingSection label="인지 방법" content={briefing.detection} accent="#3b82f6" />
            <BriefingSection label="고객 관점" content={briefing.customerImpact} accent="#ef4444" />
            <BriefingSection label="운영 관점" content={briefing.opsImpact} accent="#f59e0b" />
          </div>
        </div>
      )}
    </div>
  );
}

function BriefingSection({
  label,
  content,
  accent,
}: {
  label: string;
  content: string;
  accent: string;
}) {
  return (
    <div className="bg-bg-secondary rounded-lg p-4 border border-border-base">
      <div className="flex items-center gap-2 mb-2">
        <div className="w-1 h-4 rounded-full" style={{ backgroundColor: accent }} />
        <span className="text-xs font-mono text-text-secondary uppercase tracking-wider">{label}</span>
      </div>
      <p className="text-sm text-text-primary leading-relaxed">{content}</p>
    </div>
  );
}
