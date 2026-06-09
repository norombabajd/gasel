'use client';

import { useState, useEffect, useRef } from 'react';
import type { TablerIcon } from '@tabler/icons-react';
import {
  IconPencil,
  IconEye,
  IconEyeOff,
  IconArchive,
  IconArchiveOff,
  IconX,
} from '@tabler/icons-react';

export type AccentColor =
  | 'green'
  | 'amber'
  | 'red'
  | 'violet'
  | 'orange'
  | 'blue'
  | 'yellow';

// Static class strings per accent (Tailwind cannot resolve runtime-built names).
const ACCENT: Record<
  AccentColor,
  { border: string; title: string; icon: string; link: string }
> = {
  green: { border: 'border-emerald-200', title: 'text-emerald-600', icon: 'text-emerald-500', link: 'text-emerald-600 hover:text-emerald-700' },
  amber: { border: 'border-[#E8B84B]/45', title: 'text-[#E8B84B]', icon: 'text-[#E8B84B]', link: 'text-[#E8B84B] hover:opacity-80' },
  red: { border: 'border-[#E07070]', title: 'text-[#E07070]', icon: 'text-[#E07070]', link: 'text-[#E07070] hover:text-red-600' },
  violet: { border: 'border-[#AB6FD4]', title: 'text-[#AB6FD4]', icon: 'text-[#AB6FD4]', link: 'text-[#AB6FD4] hover:text-violet-700' },
  orange: { border: 'border-[#E8834A]', title: 'text-[#E8834A]', icon: 'text-[#E8834A]', link: 'text-[#E8834A] hover:text-orange-700' },
  blue: { border: 'border-[#4A8FD4]', title: 'text-[#4A8FD4]', icon: 'text-[#4A8FD4]', link: 'text-[#4A8FD4] hover:text-blue-700' },
  yellow: { border: 'border-[#E8B84B]', title: 'text-[#E8B84B]', icon: 'text-[#E8B84B]', link: 'text-[#E8B84B] hover:text-yellow-700' },
};

interface GACIODCardProps {
  title: string;
  content: string;
  onUpdate: (content: string) => void;
  highlightedText?: string;
  highlightedIndices?: number[];
  color: AccentColor;
  icon: TablerIcon;
  subtitle: string;
  prefix: string;
  singular: string;
  plural: string;
  archivedContent?: string;
  onArchive?: (index: number) => void;
  onUnarchive?: (index: number) => void;
}

// Strip an accidental label prefix (e.g. "C-01: ") that may have been baked
// into the item text — the label is rendered separately from the badge.
const stripLabel = (line: string): string =>
  line.replace(/^\s*[GACIOD]-\d{2}:\s*/, '');

// Parse content into list items (each line is an item)
const parseItems = (content: string): string[] => {
  if (!content.trim()) return [];
  return content
    .split('\n')
    .filter(line => line.trim() !== '')
    .map(stripLabel);
};

// Format item number with leading zero
const formatNumber = (num: number): string => {
  return num.toString();
};

export default function GACIODCard({
  title,
  content,
  onUpdate,
  highlightedText,
  highlightedIndices = [],
  color,
  icon: Icon,
  subtitle,
  prefix,
  singular,
  plural,
  archivedContent = '',
  onArchive,
  onUnarchive,
}: GACIODCardProps) {
  const [localContent, setLocalContent] = useState(content);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [newItemText, setNewItemText] = useState('');
  const [showArchived, setShowArchived] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const newItemRef = useRef<HTMLTextAreaElement>(null);

  // Auto-grow a textarea to fit its content
  const autoSize = (el: HTMLTextAreaElement | null) => {
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  };

  const accent = ACCENT[color];
  const items = parseItems(localContent);
  const archivedItems = parseItems(archivedContent);

  // Sync local content with prop changes
  useEffect(() => {
    setLocalContent(content);
  }, [content]);

  // Focus input when editing (and size it to fit the existing text)
  useEffect(() => {
    if (editingIndex !== null && inputRef.current) {
      inputRef.current.focus();
      autoSize(inputRef.current);
    }
  }, [editingIndex]);

  // Items are stored one-per-line, so collapse any newlines within a value
  const sanitize = (text: string) => text.replace(/\s*\n+\s*/g, ' ');

  const handleItemUpdate = (index: number, newText: string) => {
    const cleaned = sanitize(newText);
    const newItems = [...items];
    if (cleaned.trim() === '') {
      // Remove item if empty
      newItems.splice(index, 1);
    } else {
      newItems[index] = cleaned;
    }
    const newContent = newItems.join('\n');
    setLocalContent(newContent);
    onUpdate(newContent);
    setEditingIndex(null);
  };

  const handleAddItem = () => {
    const cleaned = sanitize(newItemText).trim();
    if (cleaned) {
      const newContent = localContent
        ? `${localContent}\n${cleaned}`
        : cleaned;
      setLocalContent(newContent);
      onUpdate(newContent);
      setNewItemText('');
      if (newItemRef.current) {
        newItemRef.current.style.height = 'auto';
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent, index: number, currentText: string) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleItemUpdate(index, currentText);
    } else if (e.key === 'Escape') {
      setEditingIndex(null);
    }
  };

  const handleNewItemKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddItem();
    }
  };

  const handleDeleteItem = (index: number) => {
    const newItems = items.filter((_, i) => i !== index);
    const newContent = newItems.join('\n');
    setLocalContent(newContent);
    onUpdate(newContent);
  };

  const renderItemWithHighlight = (text: string) => {
    if (!highlightedText || !text.includes(highlightedText)) {
      return text;
    }

    const parts = text.split(highlightedText);
    return (
      <>
        {parts.map((part, index) => (
          <span key={index}>
            {part}
            {index < parts.length - 1 && (
              <mark className="bg-yellow-200 rounded px-0.5">{highlightedText}</mark>
            )}
          </span>
        ))}
      </>
    );
  };

  return (
    <div className={`bg-white rounded-xl border-3 ${accent.border} shadow-[0_1px_3px_rgba(0,0,0,0.05)] p-4 h-full flex flex-col min-h-0 overflow-hidden`}>
      {/* Header */}
      <div className="flex items-start gap-2.5 mb-3 shrink-0">
        <Icon className={`w-6 h-6 mt-0.5 shrink-0 ${accent.icon}`} stroke={2} />
        <div className="min-w-0">
          <h2 className={`font-display text-xl leading-tight tracking-tight ${accent.title}`}>{title}</h2>
          <p className={`text-sm font-medium leading-snug ${accent.title}`}>{subtitle}</p>
        </div>
      </div>

      {/* Items */}
      <div className="flex-1 min-h-0 overflow-y-auto space-y-1">
        {items.map((item, index) => {
          const isHighlighted = highlightedIndices.includes(index);
          return (
            <div
              key={index}
              className={`group flex items-start gap-2 py-1 px-1 rounded transition-colors ${
                isHighlighted
                  ? 'bg-amber-50 border border-amber-300 ring-1 ring-amber-200'
                  : 'hover:bg-gray-50'
              }`}
            >
              <span className={`text-sm font-medium select-none shrink-0 ${
                isHighlighted ? 'text-amber-900' : 'text-gray-600'
              }`}>
                {prefix}{formatNumber(index + 1)}
              </span>
              {editingIndex === index ? (
                <textarea
                  ref={inputRef}
                  rows={1}
                  defaultValue={item}
                  onInput={(e) => autoSize(e.currentTarget)}
                  onBlur={(e) => handleItemUpdate(index, e.target.value)}
                  onKeyDown={(e) => handleKeyDown(e, index, e.currentTarget.value)}
                  className="flex-1 min-w-0 resize-none overflow-hidden text-sm font-normal text-gray-700 leading-snug bg-white border border-gray-200 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-gray-300"
                />
              ) : (
                <>
                  <span
                    onClick={() => setEditingIndex(index)}
                    className={`flex-1 text-sm font-normal cursor-text ${
                      isHighlighted ? 'text-amber-900' : 'text-gray-600'
                    }`}
                  >
                    {renderItemWithHighlight(item)}
                  </span>
                  <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                    {onArchive && (
                      <button
                        onClick={() => onArchive(index)}
                        className="text-gray-400 hover:text-gray-700 p-0.5"
                        aria-label="Archive item"
                        title="Archive"
                      >
                        <IconArchive className="w-4 h-4" stroke={1.5} />
                      </button>
                    )}
                    <button
                      onClick={() => handleDeleteItem(index)}
                      className="text-gray-400 hover:text-red-500 p-0.5"
                      aria-label="Delete item"
                      title="Delete"
                    >
                      <IconX className="w-4 h-4" stroke={1.5} />
                    </button>
                  </div>
                </>
              )}
            </div>
          );
        })}

        {/* Add new item input */}
        <div className="flex items-start gap-2 py-1 px-1">
          <span className="text-sm font-medium text-gray-300 select-none shrink-0">
            {prefix}{formatNumber(items.length + 1)}
          </span>
          <textarea
            ref={newItemRef}
            rows={1}
            value={newItemText}
            onChange={(e) => { setNewItemText(e.target.value); autoSize(e.currentTarget); }}
            onKeyDown={handleNewItemKeyDown}
            onBlur={handleAddItem}
            placeholder={`Add ${singular}...`}
            className="flex-1 min-w-0 resize-none overflow-hidden text-sm font-normal text-gray-700 leading-snug bg-transparent placeholder:text-gray-400 focus:outline-none"
          />
        </div>

        {/* Archived items */}
        {showArchived && archivedItems.length > 0 && (
          <div className="mt-2 pt-2 border-t border-gray-100 space-y-1">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400 px-1">
              Archived
            </p>
            {archivedItems.map((item, index) => (
              <div
                key={index}
                className="group flex items-start gap-2 py-1 px-1 rounded hover:bg-gray-50 transition-colors"
              >
                <span className="text-sm font-medium select-none shrink-0 text-gray-400">
                  {prefix}{formatNumber(index + 1)}
                </span>
                <span className="flex-1 text-sm font-normal text-gray-400 line-through">
                  {item}
                </span>
                {onUnarchive && (
                  <button
                    onClick={() => onUnarchive(index)}
                    className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-gray-700 transition-opacity p-0.5 shrink-0"
                    aria-label="Unarchive item"
                    title="Unarchive"
                  >
                    <IconArchiveOff className="w-4 h-4" stroke={1.5} />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer actions */}
      <div className="flex items-center justify-between gap-2 mt-3 pt-2 shrink-0">
        <button
          onClick={() => newItemRef.current?.focus()}
          className={`flex items-center gap-1.5 text-sm font-medium transition-colors ${accent.link}`}
        >
          <IconPencil className="w-4 h-4" stroke={1.75} />
          New {singular}
        </button>
        {archivedItems.length > 0 && (
          <button
            onClick={() => setShowArchived((v) => !v)}
            className={`flex items-center gap-1.5 text-sm font-medium transition-colors ${accent.link}`}
          >
            {showArchived ? (
              <IconEyeOff className="w-4 h-4" stroke={1.75} />
            ) : (
              <IconEye className="w-4 h-4" stroke={1.75} />
            )}
            {showArchived ? 'Hide' : 'Show'} archived {plural}
          </button>
        )}
      </div>
    </div>
  );
}

// Utility function to convert GACIOD content to labeled format for AI
export const formatForAI = (gaciodContent: {
  goals: string;
  assumptions: string;
  constraints: string;
  ideas: string;
  opinions: string;
  decisions: string;
}): string => {
  const sections = [
    { title: 'Goals', prefix: 'G', content: gaciodContent.goals },
    { title: 'Assumptions', prefix: 'A', content: gaciodContent.assumptions },
    { title: 'Constraints', prefix: 'C', content: gaciodContent.constraints },
    { title: 'Ideas', prefix: 'I', content: gaciodContent.ideas },
    { title: 'Opinions', prefix: 'O', content: gaciodContent.opinions },
    { title: 'Decisions', prefix: 'D', content: gaciodContent.decisions },
  ];

  return sections
    .map(({ title, prefix, content }) => {
      const items = parseItems(content);
      if (items.length === 0) return `## ${title}\n(empty)`;

      const labeledItems = items
        .map((item, index) => `${prefix}-${formatNumber(index + 1)}: ${item}`)
        .join('\n');

      return `## ${title}\n${labeledItems}`;
    })
    .join('\n\n');
};

// Utility function to parse AI response that references labels
export const parseAILabels = (text: string): { label: string; content: string }[] => {
  const labelPattern = /([GACIOD]-\d{2})/g;
  const matches = text.match(labelPattern) || [];
  return matches.map(label => ({ label, content: text }));
};
