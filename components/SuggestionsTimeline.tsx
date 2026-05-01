'use client';

import { useMemo } from 'react';
import type { Message, Improvement, Modification } from './Chat';

interface SuggestionEntry {
  messageId: string;
  timestamp: number;
  type: 'improvement' | 'modification';
  improvement?: Improvement;
  modification?: Modification;
}

function formatTime(ts: number): string {
  const d = new Date(ts);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) {
    return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  }
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function StatusBadge({ status }: { status: string }) {
  switch (status) {
    case 'accepted':
      return (
        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-green-100 text-green-700">
          ✓ Accepted
        </span>
      );
    case 'denied':
      return (
        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-gray-100 text-gray-500">
          ✗ Denied
        </span>
      );
    default:
      return (
        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-100 text-amber-700">
          ● Pending
        </span>
      );
  }
}

function ImprovementEntry({ entry }: { entry: SuggestionEntry }) {
  const imp = entry.improvement!;
  const status = imp.status ?? 'pending';

  return (
    <div className="border border-gray-200 rounded-lg p-2.5 bg-white">
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] font-semibold text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded">
            Improvement
          </span>
          <span className="text-[10px] text-gray-400">{imp.category}</span>
        </div>
        <StatusBadge status={status} />
      </div>
      {imp.explanation && (
        <p className="text-[11px] text-gray-500 italic mb-1.5">{imp.explanation}</p>
      )}
      <div className="space-y-1">
        <div className="text-[11px] text-red-700 bg-red-50 rounded px-2 py-1 line-through">
          {imp.originalText}
        </div>
        <div className="text-[11px] text-green-700 bg-green-50 rounded px-2 py-1">
          {imp.newText}
        </div>
      </div>
      <div className="text-[10px] text-gray-400 mt-1.5">{formatTime(entry.timestamp)}</div>
    </div>
  );
}

function ModificationEntry({ entry }: { entry: SuggestionEntry }) {
  const mod = entry.modification!;
  const status = mod.status ?? 'pending';

  const opColor = {
    ADD: 'text-green-700 bg-green-50',
    UPDATE: 'text-indigo-700 bg-indigo-50',
    DELETE: 'text-red-700 bg-red-50',
  }[mod.operation];

  return (
    <div className="border border-gray-200 rounded-lg p-2.5 bg-white">
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-1.5">
          <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${opColor}`}>
            {mod.operation}
          </span>
          <span className="text-[10px] text-gray-400">
            {mod.category}{mod.label ? ` (${mod.label})` : ''}
          </span>
        </div>
        <StatusBadge status={status} />
      </div>
      {mod.explanation && (
        <p className="text-[11px] text-gray-500 italic mb-1.5">{mod.explanation}</p>
      )}
      <div className="space-y-1">
        {mod.currentText && (mod.operation === 'UPDATE' || mod.operation === 'DELETE') && (
          <div className="text-[11px] text-red-700 bg-red-50 rounded px-2 py-1 line-through">
            {mod.currentText}
          </div>
        )}
        {mod.newText && (mod.operation === 'ADD' || mod.operation === 'UPDATE') && (
          <div className="text-[11px] text-green-700 bg-green-50 rounded px-2 py-1">
            {mod.newText}
          </div>
        )}
      </div>
      <div className="text-[10px] text-gray-400 mt-1.5">{formatTime(entry.timestamp)}</div>
    </div>
  );
}

interface SuggestionsTimelineProps {
  messages: Message[];
}

export default function SuggestionsTimeline({ messages }: SuggestionsTimelineProps) {
  const entries = useMemo(() => {
    const result: SuggestionEntry[] = [];
    for (const msg of messages) {
      if (msg.sender !== 'assistant') continue;
      if (msg.improvements) {
        for (const imp of msg.improvements) {
          result.push({
            messageId: msg.id,
            timestamp: msg.timestamp,
            type: 'improvement',
            improvement: imp,
          });
        }
      }
      if (msg.modifications) {
        for (const mod of msg.modifications) {
          result.push({
            messageId: msg.id,
            timestamp: msg.timestamp,
            type: 'modification',
            modification: mod,
          });
        }
      }
    }
    return result;
  }, [messages]);

  if (entries.length === 0) {
    return (
      <div className="flex items-center justify-center h-full p-4">
        <p className="text-sm text-gray-400 text-center">
          No suggestions yet. The assistant will suggest improvements as you work.
        </p>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto p-3 space-y-2">
      {entries.map((entry, idx) => (
        entry.type === 'improvement' ? (
          <ImprovementEntry key={`${entry.messageId}-imp-${idx}`} entry={entry} />
        ) : (
          <ModificationEntry key={`${entry.messageId}-mod-${idx}`} entry={entry} />
        )
      ))}
    </div>
  );
}
