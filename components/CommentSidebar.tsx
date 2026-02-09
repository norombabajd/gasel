/**
 * LEGACY COMPONENT
 * This component is not currently used in the main application.
 * It was part of an earlier iteration with AI feedback comments on table items.
 * Consider removing if no longer needed.
 */
'use client';

import { Comment, CommentReply } from '@/types/comment';
import { useState } from 'react';

interface CommentSidebarProps {
  comments: Comment[];
  onAddReply: (commentId: string, text: string, author?: string) => void;
  onResolve: (commentId: string) => void;
  onDelete: (commentId: string) => void;
  markdown: string;
}

interface TableData {
  headers: string[];
  rows: string[][];
}

function parseMarkdownTable(markdown: string): TableData[] {
  const tables: TableData[] = [];
  const lines = markdown.split('\n');
  let i = 0;

  while (i < lines.length) {
    const line = lines[i].trim();
    if (line.startsWith('|')) {
      const headers = line.split('|').slice(1, -1).map(h => h.trim());
      i++;
      if (i < lines.length && lines[i].includes('---')) {
        i++;

        // Group all rows by column - each cell gets all its bullet points
        const columnData: string[][] = headers.map(() => []);

        while (i < lines.length && lines[i].trim().startsWith('|')) {
          const row = lines[i].trim().split('|').slice(1, -1).map(c => {
            const trimmed = c.trim();
            if (trimmed.startsWith('•')) return trimmed.slice(1).trim();
            if (trimmed.startsWith('-')) return trimmed.slice(1).trim();
            if (trimmed.startsWith('*')) return trimmed.slice(1).trim();
            return trimmed;
          });

          // Add each cell's content to its column
          row.forEach((cell, colIdx) => {
            if (cell) {
              columnData[colIdx].push(cell);
            }
          });
          i++;
        }

        // Now create rows array where each row contains one bullet from each column
        const maxRows = Math.max(...columnData.map(col => col.length));
        const rows: string[][] = [];
        for (let rowIdx = 0; rowIdx < maxRows; rowIdx++) {
          rows.push(columnData.map(col => col[rowIdx] || ''));
        }

        tables.push({ headers, rows });
      }
    } else {
      i++;
    }
  }
  return tables;
}

export default function CommentSidebar({
  comments,
  onAddReply,
  onResolve,
  onDelete,
  markdown,
}: CommentSidebarProps) {
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');
  const [gptReplying, setGptReplying] = useState<string | null>(null);
  const tables = parseMarkdownTable(markdown);

  const handleAddReply = (commentId: string) => {
    if (replyText.trim()) {
      onAddReply(commentId, replyText);
      setReplyText('');
      setReplyingTo(null);
    }
  };

  const handleGptReply = async (comment: Comment, userReply: string) => {
    setGptReplying(comment.id);
    try {
      const context = getCommentContext(comment);

      const response = await fetch('/api/reply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          comment: comment.text,
          reply: userReply,
          context: context,
          fullMarkdown: markdown,
        }),
      });

      if (!response.ok) throw new Error('Failed to get GPT reply');

      const data = await response.json();
      onAddReply(comment.id, data.reply, '✨ GPT');
    } catch (error) {
      console.error('Error getting GPT reply:', error);
      alert('Failed to get GPT reply. Please try again.');
    } finally {
      setGptReplying(null);
    }
  };

  const formatTimestamp = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  const activeComments = comments.filter(c => !c.resolved);
  const resolvedComments = comments.filter(c => c.resolved);

  const getCommentContext = (comment: Comment): string => {
    try {
      const table = tables[comment.tableIdx];
      if (!table) return '';

      const header = table.headers[comment.colIdx] || '';
      const cellValue = table.rows[comment.rowIdx]?.[comment.colIdx] || '';

      return cellValue ? `${header}: ${cellValue}` : header;
    } catch (e) {
      return '';
    }
  };

  return (
    <div className="w-80 bg-gray-50 border-l border-gray-200 flex-shrink-0 flex flex-col h-full">
      <div className="px-4 py-3 border-b border-gray-200 bg-white">
        <h2 className="text-sm font-medium text-gray-700">Comments</h2>
        <p className="text-xs text-gray-500 mt-0.5">
          {activeComments.length} active
        </p>
      </div>

      <div className="p-3 space-y-3 bg-gray-50 flex-1 overflow-y-auto">
        {activeComments.length === 0 ? (
          <div className="text-center py-8 text-gray-500 text-sm">
            No comments yet. Hover over items to add a comment.
          </div>
        ) : (
          activeComments.map((comment) => (
            <div
              key={comment.id}
              className="border border-gray-300 rounded-lg p-3 bg-white shadow-sm hover:shadow transition-shadow"
            >
              <div className="flex items-start justify-between mb-2">
                <div className="flex-1">
                  <div className="font-medium text-sm text-gray-900">
                    {comment.author}
                  </div>
                  <div className="text-xs text-gray-500">
                    {formatTimestamp(comment.timestamp)}
                  </div>
                </div>
                <button
                  onClick={() => onDelete(comment.id)}
                  className="text-gray-400 hover:text-red-600 transition-colors"
                  title="Delete comment"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={2}
                    stroke="currentColor"
                    className="w-4 h-4"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              </div>

              {getCommentContext(comment) && (
                <div className="bg-blue-50 border-l-4 border-blue-400 px-3 py-2 mb-3 rounded">
                  <div className="text-xs font-medium text-blue-800 mb-1">Commenting on:</div>
                  <div className="text-sm text-blue-900 italic">{getCommentContext(comment)}</div>
                </div>
              )}

              <p className="text-sm text-gray-700 mb-3">{comment.text}</p>

              {comment.replies && comment.replies.length > 0 && (
                <div className="space-y-2 mb-3 pl-3 border-l-2 border-blue-200">
                  {comment.replies.map((reply) => (
                    <div key={reply.id} className="text-sm">
                      <div className="font-medium text-gray-900">
                        {reply.author}
                      </div>
                      <div className="text-gray-700">{reply.text}</div>
                      <div className="text-xs text-gray-500 mt-1">
                        {formatTimestamp(reply.timestamp)}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {replyingTo === comment.id ? (
                <div className="space-y-2">
                  <textarea
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    placeholder="Write a reply..."
                    className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                    rows={2}
                    autoFocus
                  />
                  <div className="flex gap-2">
                    {comment.author.includes('GPT') ? (
                      <button
                        onClick={async () => {
                          if (replyText.trim()) {
                            const userReplyText = replyText;
                            // Add the user's reply directly without closing the UI
                            onAddReply(comment.id, userReplyText);
                            // Clear the text field but keep the reply box open
                            setReplyText('');
                            // Get GPT response with the user's text
                            await handleGptReply(comment, userReplyText);
                            // Close reply box after GPT responds
                            setReplyingTo(null);
                          }
                        }}
                        disabled={gptReplying === comment.id}
                        className="px-3 py-1 text-xs bg-purple-600 text-white rounded hover:bg-purple-700 transition-colors disabled:opacity-50"
                      >
                        {gptReplying === comment.id ? '✨ Thinking...' : '✨ Reply & Ask GPT'}
                      </button>
                    ) : (
                      <button
                        onClick={() => handleAddReply(comment.id)}
                        className="px-3 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                      >
                        Reply
                      </button>
                    )}
                    <button
                      onClick={() => {
                        setReplyingTo(null);
                        setReplyText('');
                      }}
                      className="px-3 py-1 text-xs bg-gray-200 text-gray-700 rounded hover:bg-gray-300 transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex gap-2 items-center">
                  <button
                    onClick={() => setReplyingTo(comment.id)}
                    className="text-xs text-blue-600 hover:text-blue-700 font-medium"
                  >
                    {comment.author.includes('GPT') ? '✨ Reply to GPT' : 'Reply'}
                  </button>
                  <button
                    onClick={() => onResolve(comment.id)}
                    className="text-xs text-green-600 hover:text-green-700 font-medium"
                  >
                    Resolve
                  </button>
                </div>
              )}
            </div>
          ))
        )}

        {resolvedComments.length > 0 && (
          <div className="pt-4 border-t border-gray-200">
            <h3 className="text-sm font-semibold text-gray-600 mb-3">
              Resolved ({resolvedComments.length})
            </h3>
            {resolvedComments.map((comment) => (
              <div
                key={comment.id}
                className="border border-gray-200 rounded-lg p-3 bg-gray-50 opacity-60 mb-2"
              >
                <div className="font-medium text-sm text-gray-900">
                  {comment.author}
                </div>
                {getCommentContext(comment) && (
                  <div className="bg-blue-50 border-l-4 border-blue-400 px-3 py-2 my-2 rounded">
                    <div className="text-xs font-medium text-blue-800 mb-1">Commenting on:</div>
                    <div className="text-sm text-blue-900 italic">{getCommentContext(comment)}</div>
                  </div>
                )}
                <p className="text-sm text-gray-700 mt-1">{comment.text}</p>
                <div className="text-xs text-green-600 mt-2">✓ Resolved</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
