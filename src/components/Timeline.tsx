'use client';

import { useEffect, useState } from 'react';
import type { TimelineItem, TimelineTag, ApiResponse, Incident } from '@/types/incident';

type TimelineProps = {
  incidentId: string;
  initialItems: TimelineItem[];
};

const TAG_COLORS: Record<TimelineTag, string> = {
  ACTION: '#3b82f6',
  DECISION: '#a78bfa',
  HYPOTHESIS: '#f59e0b',
  VERIFY: '#06b6d4',
  RESULT: '#22c55e',
};

function TimelineItemRow({
  item,
  isCurrent,
}: {
  item: TimelineItem;
  isCurrent: boolean;
}) {
  const time = new Date(item.time).toLocaleTimeString('ko-KR', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'UTC',
  });

  return (
    <div className="flex gap-4 py-3">
      <div className="flex flex-col items-center">
        <div
          className={`w-3 h-3 rounded-full mt-1 flex-shrink-0 ${isCurrent ? 'animate-pulse' : ''}`}
          style={{ backgroundColor: TAG_COLORS[item.tag] }}
        />
        <div className="w-px flex-1 bg-border-base mt-1" />
      </div>
      <div className="flex-1 pb-2">
        <div className="flex items-center gap-2 mb-1">
          <span className="font-mono text-xs text-text-muted">{time}</span>
          <span
            className="font-mono text-xs px-1.5 py-0.5 rounded"
            style={{
              backgroundColor: `${TAG_COLORS[item.tag]}20`,
              color: TAG_COLORS[item.tag],
            }}
          >
            {item.tag}
          </span>
          <span className="font-mono text-xs text-text-secondary">{item.actor}</span>
        </div>
        <p className="text-sm text-text-primary">{item.content}</p>
      </div>
    </div>
  );
}

export function Timeline({ incidentId, initialItems }: TimelineProps) {
  const [items, setItems] = useState<TimelineItem[]>(initialItems);

  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/incidents/${incidentId}`);
        const json = (await res.json()) as ApiResponse<Incident>;
        if (json.success) {
          setItems(json.data.timeline);
        }
      } catch {
        // 폴링 실패 시 무시
      }
    }, 30_000);
    return () => clearInterval(interval);
  }, [incidentId]);

  return (
    <div className="bg-bg-card border border-border-base rounded-lg p-4">
      <h2 className="font-mono text-sm text-text-secondary uppercase tracking-wider mb-4">
        Timeline
      </h2>
      {items.length === 0 ? (
        <p className="text-sm text-text-muted">타임라인 항목이 없습니다.</p>
      ) : (
        <div>
          {items.map((item, index) => (
            <TimelineItemRow
              key={item.id}
              item={item}
              isCurrent={index === items.length - 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}
