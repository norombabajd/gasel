'use client';

import { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  IconChevronDown,
  IconNotes,
  IconSend2,
  IconBulb,
  IconAlertTriangle,
  IconSparkles,
  IconHelpCircle,
  IconAlertCircle,
  IconSearch,
  IconPencil,
  IconQuestionMark,
  IconClipboardList,
  IconPoint,
  IconPlus,
  IconTrash,
  IconCheck,
  IconX,
  IconChecklist,
  IconZoomQuestion,
  type TablerIcon,
} from '@tabler/icons-react';

export interface Improvement {
  category: string;
  originalText: string;
  newText: string;
  explanation?: string;
  status?: 'pending' | 'accepted' | 'denied';
}

export type ModificationOperation = 'ADD' | 'UPDATE' | 'DELETE';

export interface Modification {
  operation: ModificationOperation;
  category: 'title' | 'goals' | 'assumptions' | 'constraints' | 'ideas' | 'opinions' | 'decisions';
  label?: string;
  currentText?: string;
  newText?: string;
  explanation: string;
  status?: 'pending' | 'accepted' | 'denied';
}

export interface Message {
  id: string;
  text: string;
  sender: 'user' | 'assistant' | 'system';
  timestamp: number;
  isQuote?: boolean;
  isStructured?: boolean;
  improvements?: Improvement[];
  modifications?: Modification[];
  /** A suggested guiding question (onboarding) — rendered as a read-only card under the bubble. */
  topicSuggestion?: string;
}

function StructuredMessage({ text }: { text: string }) {
  // First, separate the summary section from the feedback items
  const summaryDelimiter = '---\n\n**Summary**\n';
  const parts = text.split(summaryDelimiter);
  const feedbackText = parts[0];
  const summaryText = parts[1]?.trim() || null;

  // Updated to handle new feedback types from academic-focused responses
  const sections = feedbackText.split(/\[(?:Suggestion|Concern|Strength|Question|Consideration|Missing|Conflict|Unclear|Incomplete)\]/).filter(Boolean);
  const categories = feedbackText.match(/\[(?:Suggestion|Concern|Strength|Question|Consideration|Missing|Conflict|Unclear|Incomplete)\]/g) || [];

  const getCategoryColor = (category: string) => {
    switch (category) {
      case '[Suggestion]':
        return 'bg-blue-50 border-blue-200';
      case '[Concern]':
      case '[Conflict]':
        return 'bg-orange-50 border-orange-200';
      case '[Strength]':
        return 'bg-emerald-50 border-emerald-200';
      case '[Question]':
        return 'bg-purple-50 border-purple-200';
      case '[Consideration]':
        return 'bg-yellow-50 border-yellow-200';
      case '[Missing]':
      case '[Incomplete]':
        return 'bg-red-50 border-red-200';
      case '[Unclear]':
        return 'bg-gray-50 border-gray-300';
      default:
        return 'bg-gray-50 border-gray-200';
    }
  };

  const getCategoryTextColor = (category: string) => {
    switch (category) {
      case '[Suggestion]':
        return 'text-blue-900';
      case '[Concern]':
      case '[Conflict]':
        return 'text-orange-900';
      case '[Strength]':
        return 'text-emerald-900';
      case '[Question]':
        return 'text-purple-900';
      case '[Consideration]':
        return 'text-yellow-900';
      case '[Missing]':
      case '[Incomplete]':
        return 'text-red-900';
      case '[Unclear]':
        return 'text-gray-800';
      default:
        return 'text-gray-800';
    }
  };

  const getCategoryIcon = (category: string): TablerIcon => {
    switch (category) {
      case '[Suggestion]':
        return IconBulb;
      case '[Concern]':
      case '[Conflict]':
        return IconAlertTriangle;
      case '[Strength]':
        return IconSparkles;
      case '[Question]':
        return IconHelpCircle;
      case '[Consideration]':
        return IconAlertCircle;
      case '[Missing]':
        return IconSearch;
      case '[Incomplete]':
        return IconPencil;
      case '[Unclear]':
        return IconQuestionMark;
      default:
        return IconPoint;
    }
  };

  return (
    <div className="space-y-2">
      {sections.map((section, idx) => {
        const category = categories[idx];
        const lines = section.trim().split('\n');

        // Find all quote lines (starting with >)
        const quoteLines = lines.filter(line => line.trim().startsWith('>'));

        // Find all GACIOD item reference lines (like "C-03: ...", "D-02: ...")
        const itemRefPattern = /^[GACIOD]-\d{2}:/;
        const itemRefLines = lines.filter(line =>
          !line.trim().startsWith('>') && itemRefPattern.test(line.trim())
        );

        // Get the actual feedback message (lines that aren't quotes or item references)
        const feedbackLines = lines.filter(line =>
          !line.trim().startsWith('>') && !itemRefPattern.test(line.trim())
        );

        const CategoryIcon = getCategoryIcon(category || '');
        return (
          <div
            key={idx}
            className={`border rounded-xl p-3 ${getCategoryColor(category || '')}`}
          >
            {category && (
              <div className="flex items-center gap-1.5 mb-2">
                <CategoryIcon className={`w-4 h-4 ${getCategoryTextColor(category)}`} stroke={2} />
                <span className={`font-display text-sm ${getCategoryTextColor(category)}`}>
                  {category.replace('[', '').replace(']', '')}
                </span>
              </div>
            )}
            {/* Primary quote */}
            {quoteLines.length > 0 && (
              <div className="border-l-3 border-gray-400 pl-3 py-1 mb-2 bg-white/50 rounded">
                <p className="text-sm font-normal text-gray-800 italic">
                  {quoteLines.map(line => line.replace('>', '').trim()).join('\n')}
                </p>
              </div>
            )}
            {/* Related GACIOD item references - each in its own quote block */}
            {itemRefLines.length > 0 && (
              <div className="space-y-1 mb-2">
                {itemRefLines.map((line, i) => (
                  <div key={i} className="border-l-2 border-gray-400 pl-3 py-1 bg-white/50 rounded">
                    <p className="text-sm font-normal text-gray-700">{line.trim()}</p>
                  </div>
                ))}
              </div>
            )}
            {/* Actual feedback message */}
            <p className="text-sm font-normal text-gray-900 break-words whitespace-pre-wrap leading-relaxed">
              {feedbackLines.join('\n').trim()}
            </p>
          </div>
        );
      })}

      {/* Summary section - rendered separately */}
      {summaryText && (
        <div className="border rounded-xl p-3 bg-gray-50 border-gray-200 mt-3">
          <div className="flex items-center gap-1.5 mb-2">
            <IconClipboardList className="w-4 h-4 text-gray-700" stroke={2} />
            <span className="font-display text-sm text-gray-800">Summary</span>
          </div>
          <p className="text-sm font-normal text-gray-900 break-words whitespace-pre-wrap leading-relaxed">
            {summaryText}
          </p>
        </div>
      )}
    </div>
  );
}

function ImprovementCard({
  improvement,
  onAccept,
  onDeny,
}: {
  improvement: Improvement;
  onAccept: (improvement: Improvement) => void;
  onDeny: () => void;
}) {
  return (
    <div className="p-3 bg-white border border-gray-200 rounded-xl shadow-[0_1px_3px_rgba(0,0,0,0.05)]">
      <div className="mb-3">
        <div className="flex items-center gap-1.5 mb-1">
          <IconSparkles className="w-4 h-4 text-emerald-600 shrink-0" stroke={2} />
          <span className="font-display text-sm text-gray-800">
            Improve {improvement.category}
          </span>
        </div>
        {improvement.explanation && (
          <p className="text-xs font-normal text-gray-600 mb-2 italic">{improvement.explanation}</p>
        )}
        <div className="text-sm space-y-2">
          <div className="bg-red-50 border-l-3 border-red-400 rounded-r p-2.5">
            <span className="text-[10px] font-semibold text-red-900 uppercase tracking-wide">Current</span>
            <div className="text-red-950 font-normal mt-1 leading-relaxed">{improvement.originalText}</div>
          </div>
          <div className="bg-emerald-50 border-l-3 border-emerald-500 rounded-r p-2.5">
            <span className="text-[10px] font-semibold text-emerald-900 uppercase tracking-wide">Suggested</span>
            <div className="text-emerald-950 font-normal mt-1 leading-relaxed">{improvement.newText}</div>
          </div>
        </div>
      </div>
      <div className="flex gap-2">
        <button
          onClick={() => onAccept(improvement)}
          className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-emerald-600 text-white text-xs font-medium rounded-lg hover:bg-emerald-700 transition-colors"
        >
          <IconCheck className="w-3.5 h-3.5" stroke={2} />
          Accept
        </button>
        <button
          onClick={onDeny}
          className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-gray-100 text-gray-700 text-xs font-medium rounded-lg border border-gray-200 hover:bg-gray-200 transition-colors"
        >
          <IconX className="w-3.5 h-3.5" stroke={2} />
          Deny
        </button>
      </div>
    </div>
  );
}

function ModificationCard({
  modification,
  onAccept,
  onDeny,
}: {
  modification: Modification;
  onAccept: (modification: Modification) => void;
  onDeny: () => void;
}) {
  const getOperationHeaderColor = () => {
    switch (modification.operation) {
      case 'ADD':
        return 'text-emerald-700';
      case 'UPDATE':
        return 'text-indigo-700';
      case 'DELETE':
        return 'text-red-700';
    }
  };

  const operationIconMap: Record<ModificationOperation, TablerIcon> = {
    ADD: IconPlus,
    UPDATE: IconPencil,
    DELETE: IconTrash,
  };

  const getCategoryName = (category: string) => {
    return category.charAt(0).toUpperCase() + category.slice(1);
  };

  const OperationIcon = operationIconMap[modification.operation];

  return (
    <div className="p-3 bg-white border border-gray-200 rounded-xl shadow-[0_1px_3px_rgba(0,0,0,0.05)]">
      <div className="mb-3">
        <div className="flex items-center gap-1.5 mb-1">
          <OperationIcon className={`w-4 h-4 shrink-0 ${getOperationHeaderColor()}`} stroke={2} />
          <span className={`font-display text-sm ${getOperationHeaderColor()}`}>
            {modification.operation} in {getCategoryName(modification.category)}
            {modification.label && ` (${modification.label})`}
          </span>
        </div>
        {modification.explanation && (
          <p className="text-xs font-normal text-gray-600 mb-2 italic">
            {modification.explanation}
          </p>
        )}

        <div className="text-sm space-y-2">
          {modification.operation === 'DELETE' && modification.currentText && (
            <div className="bg-red-50 border-l-3 border-red-400 rounded-r p-2.5">
              <span className="text-[10px] font-semibold text-red-900 uppercase tracking-wide">Remove</span>
              <div className="text-red-950 font-normal mt-1 leading-relaxed">
                {modification.currentText}
              </div>
            </div>
          )}

          {modification.operation === 'UPDATE' && (
            <>
              {modification.currentText && (
                <div className="bg-red-50 border-l-3 border-red-400 rounded-r p-2.5">
                  <span className="text-[10px] font-semibold text-red-900 uppercase tracking-wide">Current</span>
                  <div className="text-red-950 font-normal mt-1 leading-relaxed">
                    {modification.currentText}
                  </div>
                </div>
              )}
              {modification.newText && (
                <div className="bg-emerald-50 border-l-3 border-emerald-500 rounded-r p-2.5">
                  <span className="text-[10px] font-semibold text-emerald-900 uppercase tracking-wide">Replace with</span>
                  <div className="text-emerald-950 font-normal mt-1 leading-relaxed">
                    {modification.newText}
                  </div>
                </div>
              )}
            </>
          )}

          {modification.operation === 'ADD' && modification.newText && (
            <div className="bg-emerald-50 border-l-3 border-emerald-500 rounded-r p-2.5">
              <span className="text-[10px] font-semibold text-emerald-900 uppercase tracking-wide">Add</span>
              <div className="text-emerald-950 font-normal mt-1 leading-relaxed">
                {modification.newText}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="flex gap-2">
        <button
          onClick={() => onAccept(modification)}
          className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-emerald-600 text-white text-xs font-medium rounded-lg hover:bg-emerald-700 transition-colors"
        >
          <IconCheck className="w-3.5 h-3.5" stroke={2} />
          Accept
        </button>
        <button
          onClick={onDeny}
          className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-gray-100 text-gray-700 text-xs font-medium rounded-lg border border-gray-200 hover:bg-gray-200 transition-colors"
        >
          <IconX className="w-3.5 h-3.5" stroke={2} />
          Deny
        </button>
      </div>
    </div>
  );
}

export interface ResolvedChip {
  key: React.Key;
  label: string;
  accepted: boolean;
}

/** Collapsed summary of resolved (accepted/denied) items — expands to show per-item chips. */
export function ResolvedSummary({
  items,
  verb,
  noun,
}: {
  items: ResolvedChip[];
  verb: string;
  noun: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const accepted = items.filter((i) => i.accepted).length;
  const denied = items.length - accepted;
  const plural = (n: number) => (n === 1 ? '' : 's');
  const summary =
    accepted > 0
      ? `${verb} ${accepted} ${noun}${plural(accepted)}`
      : `Dismissed ${denied} ${noun}${plural(denied)}`;

  return (
    <div>
      <button
        onClick={() => setExpanded((e) => !e)}
        className="inline-flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700 transition-colors"
      >
        {accepted > 0 ? (
          <IconCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" stroke={2} />
        ) : (
          <IconX className="w-3.5 h-3.5 text-gray-400 shrink-0" stroke={2} />
        )}
        <span className="font-medium">{summary}</span>
        {accepted > 0 && denied > 0 && (
          <span className="text-gray-400">· {denied} dismissed</span>
        )}
        <IconChevronDown
          className={`w-3.5 h-3.5 transition-transform ${expanded ? 'rotate-180' : ''}`}
          stroke={2}
        />
      </button>
      {expanded && (
        <div className="flex flex-wrap gap-1 mt-1.5">
          {items.map((i) => (
            <span
              key={i.key}
              className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] ${
                i.accepted
                  ? 'bg-emerald-50 text-emerald-700'
                  : 'bg-gray-100 text-gray-400 line-through'
              }`}
            >
              {i.accepted ? (
                <IconCheck className="w-3 h-3 shrink-0" stroke={2.5} />
              ) : (
                <IconX className="w-3 h-3 shrink-0" stroke={2.5} />
              )}
              {i.label}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

interface ChatProps {
  messages: Message[];
  onSendMessage: (text: string) => void;
  inputValue: string;
  setInputValue: (value: string) => void;
  isLoading?: boolean;
  onAcceptImprovement?: (improvement: Improvement) => void;
  onDenyImprovement?: (messageId: string, improvementIndex: number) => void;
  onAcceptModification?: (modification: Modification) => void;
  onDenyModification?: (messageId: string, modificationIndex: number) => void;
  showActionsInline?: boolean;
  showInput?: boolean;
  inputPlaceholder?: string;
  /** Optional node rendered at the end of the scrollable message area (e.g. a suggested-topic card). */
  footer?: React.ReactNode;
  /** Optional node rendered below the input, separated by a divider (e.g. quick actions). */
  belowInput?: React.ReactNode;
  /** Optional node floated just above the input area (e.g. quick action chips). */
  aboveInput?: React.ReactNode;
}

export default function Chat({
  messages,
  onSendMessage,
  inputValue,
  setInputValue,
  isLoading = false,
  onAcceptImprovement,
  onDenyImprovement,
  onAcceptModification,
  onDenyModification,
  showActionsInline = true,
  showInput = true,
  inputPlaceholder = 'Type a message...',
  footer,
  belowInput,
  aboveInput,
}: ChatProps) {
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const autoSizeInput = (el: HTMLTextAreaElement | null) => {
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  };

  // Keep the latest message / thinking indicator in view as the conversation grows.
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages.length, isLoading]);

  const handleSend = () => {
    if (!inputValue.trim()) return;
    onSendMessage(inputValue);
    setInputValue('');
    if (inputRef.current) inputRef.current.style.height = 'auto';
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex flex-col h-full bg-transparent">
      {/* Messages area */}
      <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden p-4 space-y-4">
        {messages.length === 0 ? (
          <div className="flex items-center justify-center h-full text-gray-400 text-sm font-normal">
            <p>Start a conversation...</p>
          </div>
        ) : (
          messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${
                message.sender === 'user'
                  ? 'justify-end'
                  : message.sender === 'system'
                  ? 'justify-center'
                  : 'justify-start'
              }`}
            >
              <div className={`flex flex-col gap-1 ${
                message.sender === 'user'
                  ? 'items-end max-w-[85%]'
                  : message.sender === 'system'
                  ? 'items-center max-w-full'
                  : 'items-start max-w-full'
              }`}>
                {message.isStructured ? (
                  <div className="w-full">
                    <StructuredMessage text={message.text} />
                  </div>
                ) : message.sender === 'system' ? (
                  <div className="text-gray-500 text-xs font-medium text-center">
                    {message.text}
                  </div>
                ) : (
                  <div
                    className={`wrap-break-word ${
                      message.sender === 'user' ? '' : 'max-w-[85%]'
                    } ${
                      message.isQuote
                        ? 'border-l-4 border-gray-400 pl-4 py-2'
                        : `px-3 py-2 rounded-lg ${
                            message.sender === 'user'
                              ? 'bg-gray-900 text-white rounded-br-sm'
                              : 'bg-gray-100 text-gray-900 rounded-bl-sm'
                          }`
                    }`}
                  >
                    {message.sender === 'assistant' && !message.isQuote ? (
                      <div className="text-sm font-normal prose prose-sm max-w-none prose-p:my-2 prose-ul:my-2 prose-ol:my-2 prose-headings:my-2 prose-headings:font-semibold prose-strong:font-medium">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                          {message.text}
                        </ReactMarkdown>
                      </div>
                    ) : (
                      <p className={`text-sm font-normal whitespace-pre-wrap ${message.isQuote ? 'text-gray-600 italic' : ''}`}>
                        {message.text}
                      </p>
                    )}
                  </div>
                )}
                {/* Improvement cards */}
                {message.improvements && message.improvements.length > 0 && (() => {
                  const items = message.improvements.map((improvement, idx) => ({ improvement, idx }));
                  const pending = items.filter(({ improvement }) => (improvement.status ?? 'pending') === 'pending');
                  const resolved = items.filter(({ improvement }) => (improvement.status ?? 'pending') !== 'pending');
                  const canAct = !!(onAcceptImprovement && onDenyImprovement);
                  return (
                    <div className="w-full mt-1 space-y-2">
                      {canAct && pending.length > 1 && (
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-medium text-gray-500">{pending.length} suggested improvements</span>
                          <div className="flex gap-1.5">
                            <button
                              onClick={() => pending.forEach(({ improvement }) => onAcceptImprovement!(improvement))}
                              className="px-2 py-1 rounded-md text-xs font-medium bg-emerald-600 text-white hover:bg-emerald-700 transition-colors"
                            >
                              Accept all
                            </button>
                            <button
                              onClick={() => pending.forEach(({ idx }) => onDenyImprovement!(message.id, idx))}
                              className="px-2 py-1 rounded-md text-xs font-medium bg-gray-100 text-gray-700 border border-gray-200 hover:bg-gray-200 transition-colors"
                            >
                              Deny all
                            </button>
                          </div>
                        </div>
                      )}
                      {canAct && pending.map(({ improvement, idx }) => (
                        <ImprovementCard
                          key={idx}
                          improvement={improvement}
                          onAccept={onAcceptImprovement!}
                          onDeny={() => onDenyImprovement!(message.id, idx)}
                        />
                      ))}
                      {resolved.length > 0 && (
                        <ResolvedSummary
                          verb="Applied"
                          noun="improvement"
                          items={resolved.map(({ improvement, idx }) => ({
                            key: idx,
                            label: improvement.category,
                            accepted: (improvement.status ?? 'pending') === 'accepted',
                          }))}
                        />
                      )}
                    </div>
                  );
                })()}
                {/* Modification cards */}
                {message.modifications && message.modifications.length > 0 && (() => {
                  const items = message.modifications.map((modification, idx) => ({ modification, idx }));
                  const pending = items.filter(({ modification }) => (modification.status ?? 'pending') === 'pending');
                  const resolved = items.filter(({ modification }) => (modification.status ?? 'pending') !== 'pending');
                  const canAct = !!(onAcceptModification && onDenyModification);
                  return (
                    <div className="w-full mt-1 space-y-2">
                      {canAct && pending.length > 1 && (
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-medium text-gray-500">{pending.length} proposed changes</span>
                          <div className="flex gap-1.5">
                            <button
                              onClick={() => pending.forEach(({ modification }) => onAcceptModification!(modification))}
                              className="px-2 py-1 rounded-md text-xs font-medium bg-emerald-600 text-white hover:bg-emerald-700 transition-colors"
                            >
                              Accept all
                            </button>
                            <button
                              onClick={() => pending.forEach(({ idx }) => onDenyModification!(message.id, idx))}
                              className="px-2 py-1 rounded-md text-xs font-medium bg-gray-100 text-gray-700 border border-gray-200 hover:bg-gray-200 transition-colors"
                            >
                              Deny all
                            </button>
                          </div>
                        </div>
                      )}
                      {canAct && pending.map(({ modification, idx }) => (
                        <ModificationCard
                          key={idx}
                          modification={modification}
                          onAccept={onAcceptModification!}
                          onDeny={() => onDenyModification!(message.id, idx)}
                        />
                      ))}
                      {resolved.length > 0 && (
                        <ResolvedSummary
                          verb="Added"
                          noun="item"
                          items={resolved.map(({ modification, idx }) => ({
                            key: idx,
                            label: `${modification.operation} ${modification.category}`,
                            accepted: (modification.status ?? 'pending') === 'accepted',
                          }))}
                        />
                      )}
                    </div>
                  );
                })()}
                {/* Suggested topic (onboarding) — stays in the conversation history */}
                {message.topicSuggestion && (
                  <div className="w-full mt-1 border border-emerald-200 bg-white rounded-xl p-3 flex items-start gap-2.5">
                    <IconNotes className="w-5 h-5 mt-0.5 shrink-0 text-emerald-500" stroke={2} />
                    <div className="min-w-0 flex-1">
                      <h4 className="font-display text-base leading-tight text-emerald-700">Suggested topic</h4>
                      <p className="text-sm font-normal text-gray-800 leading-snug mt-1.5 whitespace-pre-wrap break-words">{message.topicSuggestion}</p>
                      <p className="text-xs text-gray-400 mt-2">Reply below to confirm, or tell me what to change.</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))
        )}
        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-gray-100 px-3 py-2 rounded-lg">
              <div className="flex items-center gap-2">
                <div className="flex gap-1">
                  <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                  <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                  <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                </div>
                <span className="text-xs font-normal text-gray-500">Thinking...</span>
              </div>
            </div>
          </div>
        )}
        {footer}
        <div ref={bottomRef} />
      </div>

        {/* Below-input slot (e.g. quick actions), divided from the input */}
        {belowInput && (
          <div className="p-2 border-t-[3.5px] border-gray-100">
            {belowInput}
          </div>
        )}

      {/* Input area */}
      {showInput && (
      <div className="border-t-[3.5px] border-gray-100 p-2 shrink-0">
        <div className="px-2 pt-1.5 shrink-0">
          {aboveInput}
        </div>
        <div className="flex items-end gap-2">
          <textarea
            ref={inputRef}
            value={inputValue}
            onChange={(e) => { setInputValue(e.target.value); autoSizeInput(e.currentTarget); }}
            onKeyDown={handleKeyDown}
            placeholder={inputPlaceholder}
            className="flex-1 min-w-0 max-h-40 overflow-y-auto resize-none border border-gray-200 rounded-lg px-3 py-2 text-sm font-normal leading-snug focus:outline-none focus:ring-1 focus:ring-gray-300 focus:border-transparent bg-gray-50"
            rows={1}
          />
          <button
            onClick={handleSend}
            disabled={!inputValue.trim() || isLoading}
            className="shrink-0 px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium flex items-center gap-1.5"
          >
            <IconSend2 className="w-4 h-4" stroke={1.5} />
            {isLoading ? '...' : 'Send'}
          </button>
        </div>

        {/* Quick action cards - only show if showActionsInline is true */}
        {/* {showActionsInline && (
          <div className="grid grid-cols-3 gap-1.5 mt-3">
            <button
              onClick={() => {
                onSendMessage('Review my GACIOD framework');
              }}
              disabled={isLoading}
              className="bg-gray-50 border border-gray-200 rounded-lg py-2 hover:bg-gray-100 hover:border-gray-300 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1.5"
            >
              <IconChecklist className="w-3.5 h-3.5 text-blue-600 shrink-0" stroke={2} />
              <span className="font-display text-xs text-gray-600 whitespace-nowrap">Review</span>
            </button>
            <button
              onClick={() => {
                onSendMessage('Find gaps in my GACIOD framework');
              }}
              disabled={isLoading}
              className="bg-gray-50 border border-gray-200 rounded-lg py-2 hover:bg-gray-100 hover:border-gray-300 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1.5"
            >
              <IconZoomQuestion className="w-3.5 h-3.5 text-orange-600 shrink-0" stroke={2} />
              <span className="font-display text-xs text-gray-600 whitespace-nowrap">Gaps</span>
            </button>
            <button
              onClick={() => {
                onSendMessage('Suggest improvements for my GACIOD framework');
              }}
              disabled={isLoading}
              className="bg-gray-50 border border-gray-200 rounded-lg py-2 hover:bg-gray-100 hover:border-gray-300 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1.5"
            >
              <IconSparkles className="w-3.5 h-3.5 text-emerald-600 shrink-0" stroke={2} />
              <span className="font-display text-xs text-gray-600 whitespace-nowrap">Improve</span>
            </button>
          </div>
        )} */}
      </div>
      )}
    </div>
  );
}
