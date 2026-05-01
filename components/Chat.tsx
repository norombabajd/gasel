'use client';

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

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
        return 'bg-green-50 border-green-200';
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
        return 'text-green-900';
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

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case '[Suggestion]':
        return '💡';
      case '[Concern]':
      case '[Conflict]':
        return '⚠️';
      case '[Strength]':
        return '✨';
      case '[Question]':
        return '❓';
      case '[Consideration]':
        return '🤔';
      case '[Missing]':
        return '🔍';
      case '[Incomplete]':
        return '📝';
      case '[Unclear]':
        return '❔';
      default:
        return '•';
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

        return (
          <div
            key={idx}
            className={`border rounded-lg p-3 ${getCategoryColor(category || '')}`}
          >
            {category && (
              <div className="flex items-center gap-1.5 mb-2">
                <span>{getCategoryIcon(category)}</span>
                <span className={`text-xs font-semibold ${getCategoryTextColor(category)}`}>
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
        <div className="border rounded-lg p-3 bg-gray-50 border-gray-200 mt-3">
          <div className="flex items-center gap-1.5 mb-2">
            <span>📋</span>
            <span className="text-xs font-semibold text-gray-800">Summary</span>
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
    <div className="p-3 bg-white border border-gray-200 rounded-lg shadow-sm">
      <div className="mb-3">
        <p className="text-xs font-semibold text-gray-800 mb-1">
          Suggested improvement for {improvement.category}:
        </p>
        {improvement.explanation && (
          <p className="text-xs font-normal text-gray-600 mb-2 italic">{improvement.explanation}</p>
        )}
        <div className="text-sm space-y-2">
          <div className="bg-red-50 border-l-3 border-red-400 rounded-r p-2.5">
            <span className="text-xs font-semibold text-red-900 uppercase tracking-wide">Current</span>
            <div className="text-red-950 font-normal mt-1 leading-relaxed">{improvement.originalText}</div>
          </div>
          <div className="bg-green-50 border-l-3 border-green-500 rounded-r p-2.5">
            <span className="text-xs font-semibold text-green-900 uppercase tracking-wide">Suggested</span>
            <div className="text-green-950 font-normal mt-1 leading-relaxed">{improvement.newText}</div>
          </div>
        </div>
      </div>
      <div className="flex gap-2">
        <button
          onClick={() => onAccept(improvement)}
          className="flex-1 px-3 py-1.5 bg-green-700 text-white text-xs font-semibold rounded hover:bg-green-800 transition-colors"
        >
          Accept
        </button>
        <button
          onClick={onDeny}
          className="flex-1 px-3 py-1.5 bg-gray-100 text-gray-800 text-xs font-semibold rounded border border-gray-300 hover:bg-gray-200 transition-colors"
        >
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
  const getOperationColor = () => {
    switch (modification.operation) {
      case 'ADD':
        return 'bg-green-50 border-green-200';
      case 'UPDATE':
        return 'bg-indigo-50 border-indigo-200';
      case 'DELETE':
        return 'bg-red-50 border-red-200';
    }
  };

  const getOperationHeaderColor = () => {
    switch (modification.operation) {
      case 'ADD':
        return 'text-green-800';
      case 'UPDATE':
        return 'text-indigo-800';
      case 'DELETE':
        return 'text-red-800';
    }
  };

  const getOperationIcon = () => {
    switch (modification.operation) {
      case 'ADD':
        return '➕';
      case 'UPDATE':
        return '✏️';
      case 'DELETE':
        return '🗑️';
    }
  };

  const getCategoryName = (category: string) => {
    return category.charAt(0).toUpperCase() + category.slice(1);
  };

  return (
    <div className="p-3 bg-white border border-gray-200 rounded-lg shadow-sm">
      <div className="mb-3">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-sm" role="img" aria-label={modification.operation.toLowerCase()}>{getOperationIcon()}</span>
          <span className={`text-xs font-semibold ${getOperationHeaderColor()}`}>
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
              <span className="text-xs font-semibold text-red-900 uppercase tracking-wide">Remove</span>
              <div className="text-red-950 font-normal mt-1 leading-relaxed">
                {modification.currentText}
              </div>
            </div>
          )}

          {modification.operation === 'UPDATE' && (
            <>
              {modification.currentText && (
                <div className="bg-red-50 border-l-3 border-red-400 rounded-r p-2.5">
                  <span className="text-xs font-semibold text-red-900 uppercase tracking-wide">Current</span>
                  <div className="text-red-950 font-normal mt-1 leading-relaxed">
                    {modification.currentText}
                  </div>
                </div>
              )}
              {modification.newText && (
                <div className="bg-green-50 border-l-3 border-green-500 rounded-r p-2.5">
                  <span className="text-xs font-semibold text-green-900 uppercase tracking-wide">Replace with</span>
                  <div className="text-green-950 font-normal mt-1 leading-relaxed">
                    {modification.newText}
                  </div>
                </div>
              )}
            </>
          )}

          {modification.operation === 'ADD' && modification.newText && (
            <div className="bg-green-50 border-l-3 border-green-500 rounded-r p-2.5">
              <span className="text-xs font-semibold text-green-900 uppercase tracking-wide">Add</span>
              <div className="text-green-950 font-normal mt-1 leading-relaxed">
                {modification.newText}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="flex gap-2">
        <button
          onClick={() => onAccept(modification)}
          className="flex-1 px-3 py-1.5 bg-green-700 text-white text-xs font-semibold rounded hover:bg-green-800 transition-colors"
        >
          Accept
        </button>
        <button
          onClick={onDeny}
          className="flex-1 px-3 py-1.5 bg-gray-100 text-gray-800 text-xs font-semibold rounded border border-gray-300 hover:bg-gray-200 transition-colors"
        >
          Deny
        </button>
      </div>
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
  showActionsInline = true
}: ChatProps) {
  const handleSend = () => {
    if (!inputValue.trim()) return;
    onSendMessage(inputValue);
    setInputValue('');
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
                message.sender === 'user' ? 'justify-end' : 'justify-start'
              }`}
            >
              <div className={`flex flex-col gap-1 ${
                message.sender === 'user' ? 'items-end max-w-[85%]' : 'items-start max-w-full'
              }`}>
                {message.isStructured ? (
                  <div className="w-full">
                    <StructuredMessage text={message.text} />
                  </div>
                ) : (
                  <div
                    className={`break-words ${
                      message.sender === 'user' ? '' : 'max-w-[85%]'
                    } ${
                      message.isQuote
                        ? 'border-l-4 border-gray-400 pl-4 py-2'
                        : `px-3 py-2 rounded-lg ${
                            message.sender === 'user'
                              ? 'bg-gray-900 text-white rounded-br-sm'
                              : message.sender === 'system'
                              ? 'bg-gray-100 text-gray-700 border border-gray-200'
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
                {message.improvements && message.improvements.length > 0 && (
                  <div className="w-full space-y-2 mt-1">
                    {message.improvements.map((improvement, idx) => {
                      const status = improvement.status ?? 'pending';
                      if (status === 'pending' && onAcceptImprovement && onDenyImprovement) {
                        return (
                          <ImprovementCard
                            key={idx}
                            improvement={improvement}
                            onAccept={onAcceptImprovement}
                            onDeny={() => onDenyImprovement(message.id, idx)}
                          />
                        );
                      }
                      return (
                        <div key={idx} className={`p-2 rounded-lg text-xs flex items-center gap-1.5 ${
                          status === 'accepted' ? 'bg-green-50 text-green-700' : 'bg-gray-50 text-gray-500'
                        }`}>
                          <span>{status === 'accepted' ? '✓' : '✗'}</span>
                          <span className="font-semibold">{status === 'accepted' ? 'Accepted' : 'Denied'}:</span>
                          <span>{improvement.category} improvement</span>
                        </div>
                      );
                    })}
                  </div>
                )}
                {/* Modification cards */}
                {message.modifications && message.modifications.length > 0 && (
                  <div className="w-full space-y-2 mt-1">
                    {message.modifications.map((modification, idx) => {
                      const status = modification.status ?? 'pending';
                      if (status === 'pending' && onAcceptModification && onDenyModification) {
                        return (
                          <ModificationCard
                            key={idx}
                            modification={modification}
                            onAccept={onAcceptModification}
                            onDeny={() => onDenyModification(message.id, idx)}
                          />
                        );
                      }
                      return (
                        <div key={idx} className={`p-2 rounded-lg text-xs flex items-center gap-1.5 ${
                          status === 'accepted' ? 'bg-green-50 text-green-700' : 'bg-gray-50 text-gray-500'
                        }`}>
                          <span>{status === 'accepted' ? '✓' : '✗'}</span>
                          <span className="font-semibold">{status === 'accepted' ? 'Accepted' : 'Denied'}:</span>
                          <span>{modification.operation} in {modification.category}</span>
                        </div>
                      );
                    })}
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
      </div>

      {/* Input area */}
      <div className="border-t border-gray-100 p-2 shrink-0">
        <div className="flex gap-2">
          <textarea
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a message..."
            className="flex-1 resize-none border border-gray-200 rounded-lg px-3 py-2 text-sm font-normal focus:outline-none focus:ring-1 focus:ring-gray-300 focus:border-transparent bg-gray-50"
            rows={1}
          />
          <button
            onClick={handleSend}
            disabled={!inputValue.trim() || isLoading}
            className="px-3 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
          >
            {isLoading ? '...' : 'Send'}
          </button>
        </div>

        {/* Quick action cards - only show if showActionsInline is true */}
        {showActionsInline && (
          <div className="grid grid-cols-3 gap-1.5 mt-3">
            <button
              onClick={() => {
                onSendMessage('Review my GACIOD framework');
              }}
              disabled={isLoading}
              className="bg-gray-50 border border-gray-200 rounded-lg py-2 hover:bg-gray-100 hover:border-gray-300 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1.5"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
                stroke="currentColor"
                className="w-3.5 h-3.5 text-blue-600 shrink-0"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z"
                />
              </svg>
              <span className="text-[11px] font-medium text-gray-600 whitespace-nowrap">Review</span>
            </button>
            <button
              onClick={() => {
                onSendMessage('Find gaps in my GACIOD framework');
              }}
              disabled={isLoading}
              className="bg-gray-50 border border-gray-200 rounded-lg py-2 hover:bg-gray-100 hover:border-gray-300 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1.5"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
                stroke="currentColor"
                className="w-3.5 h-3.5 text-orange-600 shrink-0"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607zM10.5 7.5v6m3-3h-6"
                />
              </svg>
              <span className="text-[11px] font-medium text-gray-600 whitespace-nowrap">Gaps</span>
            </button>
            <button
              onClick={() => {
                onSendMessage('Suggest improvements for my GACIOD framework');
              }}
              disabled={isLoading}
              className="bg-gray-50 border border-gray-200 rounded-lg py-2 hover:bg-gray-100 hover:border-gray-300 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1.5"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
                stroke="currentColor"
                className="w-3.5 h-3.5 text-green-600 shrink-0"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z"
                />
              </svg>
              <span className="text-[11px] font-medium text-gray-600 whitespace-nowrap">Improve</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
