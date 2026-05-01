'use client';

import { useState, useEffect, useRef } from 'react';

interface GACIODCardProps {
  title: string;
  content: string;
  onUpdate: (content: string) => void;
  highlightedText?: string;
  highlightedIndices?: number[];
}

// Get prefix from title (G for Goals, A for Assumptions, etc.)
const getPrefix = (title: string): string => {
  const prefixMap: Record<string, string> = {
    'Goals': 'G',
    'Assumptions': 'A',
    'Constraints': 'C',
    'Ideas': 'I',
    'Opinions': 'O',
    'Decisions': 'D',
  };
  return prefixMap[title] || title.charAt(0).toUpperCase();
};

// Parse content into list items (each line is an item)
const parseItems = (content: string): string[] => {
  if (!content.trim()) return [];
  return content.split('\n').filter(line => line.trim() !== '');
};

// Format item number with leading zero
const formatNumber = (num: number): string => {
  return num.toString().padStart(2, '0');
};

export default function GACIODCard({ title, content, onUpdate, highlightedText, highlightedIndices = [] }: GACIODCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [localContent, setLocalContent] = useState(content);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [newItemText, setNewItemText] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const newItemRef = useRef<HTMLInputElement>(null);

  const prefix = getPrefix(title);
  const items = parseItems(localContent);

  // Sync local content with prop changes
  useEffect(() => {
    setLocalContent(content);
  }, [content]);

  // Focus input when editing
  useEffect(() => {
    if (editingIndex !== null && inputRef.current) {
      inputRef.current.focus();
    }
  }, [editingIndex]);

  const handleItemUpdate = (index: number, newText: string) => {
    const newItems = [...items];
    if (newText.trim() === '') {
      // Remove item if empty
      newItems.splice(index, 1);
    } else {
      newItems[index] = newText;
    }
    const newContent = newItems.join('\n');
    setLocalContent(newContent);
    onUpdate(newContent);
    setEditingIndex(null);
  };

  const handleAddItem = () => {
    if (newItemText.trim()) {
      const newContent = localContent
        ? `${localContent}\n${newItemText.trim()}`
        : newItemText.trim();
      setLocalContent(newContent);
      onUpdate(newContent);
      setNewItemText('');
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
    <div className="bg-white rounded-xl shadow-[0_1px_3px_rgba(0,0,0,0.05)] p-4 h-full flex flex-col min-h-0 overflow-hidden">
      <h3 className="text-sm font-semibold text-gray-800 mb-3 shrink-0">{title}</h3>
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
              <span className={`text-[10px] font-medium mt-0.5 select-none shrink-0 ${
                isHighlighted ? 'text-amber-600' : 'text-gray-400'
              }`}>
                {prefix}-{formatNumber(index + 1)}
              </span>
              {editingIndex === index ? (
                <input
                  ref={inputRef}
                  type="text"
                  defaultValue={item}
                  onBlur={(e) => handleItemUpdate(index, e.target.value)}
                  onKeyDown={(e) => handleKeyDown(e, index, e.currentTarget.value)}
                  className="flex-1 text-sm font-normal text-gray-700 bg-white border border-gray-200 rounded px-2 py-0.5 focus:outline-none focus:ring-1 focus:ring-gray-300"
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
                  <button
                    onClick={() => handleDeleteItem(index)}
                    className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-500 transition-opacity p-0.5"
                    aria-label="Delete item"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                      strokeWidth={1.5}
                      stroke="currentColor"
                      className="w-3.5 h-3.5"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M6 18L18 6M6 6l12 12"
                      />
                    </svg>
                  </button>
                </>
              )}
            </div>
          );
        })}

        {/* Add new item input */}
        <div className="flex items-start gap-2 py-1 px-1">
          <span className="text-[10px] font-medium text-gray-300 mt-0.5 select-none shrink-0">
            {prefix}-{formatNumber(items.length + 1)}
          </span>
          <input
            ref={newItemRef}
            type="text"
            value={newItemText}
            onChange={(e) => setNewItemText(e.target.value)}
            onKeyDown={handleNewItemKeyDown}
            onBlur={handleAddItem}
            placeholder={`Add ${title.toLowerCase().slice(0, -1)}...`}
            className="flex-1 text-sm font-normal text-gray-700 bg-transparent placeholder:text-gray-400 focus:outline-none"
          />
        </div>
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
