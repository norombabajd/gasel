/**
 * LEGACY COMPONENT
 * This component is not currently used in the main application.
 * It was part of an earlier iteration with table-based editing and AI feedback comments.
 * Consider removing if no longer needed.
 */
'use client';

import { useState } from 'react';
import EditableTable from './EditableTable';
import CommentSidebar from './CommentSidebar';
import { Comment } from '@/types/comment';

interface TableCardProps {
  id: string;
  title: string;
  initialMarkdown: string;
  onDelete: (id: string) => void;
  onUpdate: (id: string, markdown: string) => void;
  onUpdateTitle: (id: string, title: string) => void;
  onAddComment: (cardId: string, tableIdx: number, colIdx: number, rowIdx: number, text: string, author?: string) => void;
  onAddReply: (commentId: string, text: string, author?: string) => void;
  onResolveComment: (commentId: string) => void;
  onDeleteComment: (commentId: string) => void;
  comments: Comment[];
}

type Mode = 'markdown' | 'live';

export default function TableCard({ id, title, initialMarkdown, onDelete, onUpdate, onUpdateTitle, onAddComment, onAddReply, onResolveComment, onDeleteComment, comments }: TableCardProps) {
  const [markdown, setMarkdown] = useState(initialMarkdown);
  const [cardTitle, setCardTitle] = useState(title);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [mode, setMode] = useState<Mode>('live');
  const [isLoadingFeedback, setIsLoadingFeedback] = useState(false);

  const handleMarkdownChange = (value: string) => {
    setMarkdown(value);
    onUpdate(id, value);
  };

  const handleTitleBlur = () => {
    setIsEditingTitle(false);
    onUpdateTitle(id, cardTitle);
  };

  const handleGetAIFeedback = async () => {
    setIsLoadingFeedback(true);
    try {
      const response = await fetch('/api/feedback', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          markdown,
          title: cardTitle
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to get AI feedback');
      }

      const data = await response.json();

      // Process feedback and create comments
      if (data.feedback && Array.isArray(data.feedback)) {
        data.feedback.forEach((item: any) => {
          const sectionMap: { [key: string]: number } = {
            'Goals': 0,
            'Assumptions': 1,
            'Constraint': 2,
            'Idea': 0,
            'Opinion': 1,
            'Decision': 2,
          };

          const tableIdx = ['Goals', 'Assumptions', 'Constraint'].includes(item.section) ? 0 : 1;
          const colIdx = sectionMap[item.section];
          const rowIdx = item.itemIndex || 0;

          const feedbackPrefix = {
            'suggestion': '💡 Suggestion: ',
            'concern': '⚠️ Concern: ',
            'praise': '✨ Great: ',
            'question': '❓ Question: ',
          }[item.type as 'suggestion' | 'concern' | 'praise' | 'question'] || '';

          onAddComment(id, tableIdx, colIdx, rowIdx, feedbackPrefix + item.feedback, '✨ GPT');
        });
      }
    } catch (error) {
      console.error('Error getting AI feedback:', error);
      alert('Failed to get AI feedback. Please check your API key and try again.');
    } finally {
      setIsLoadingFeedback(false);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden flex gap-0 h-[calc(100vh-180px)] min-h-[600px]">
      <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
      <div className="px-8 py-6 border-b border-gray-200">
        {isEditingTitle ? (
          <input
            type="text"
            value={cardTitle}
            onChange={(e) => setCardTitle(e.target.value)}
            onBlur={handleTitleBlur}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleTitleBlur();
            }}
            autoFocus
            className="w-full text-2xl font-normal text-gray-900 bg-white border-b-2 border-blue-500 focus:outline-none pb-1"
          />
        ) : (
          <h3
            onClick={() => setIsEditingTitle(true)}
            className="text-2xl font-normal text-gray-900 cursor-pointer hover:text-gray-600 transition-colors pb-1"
          >
            {cardTitle}
          </h3>
        )}
      </div>
      <div className="px-8 py-3 border-b border-gray-100 flex items-center justify-between bg-gray-50">
        <div className="flex items-center gap-2">
          <div className="flex bg-white rounded border border-gray-300">
            <button
              onClick={() => setMode('markdown')}
              className={`px-3 py-1.5 text-xs font-medium rounded-l transition-colors ${
                mode === 'markdown'
                  ? 'bg-blue-100 text-blue-700'
                  : 'bg-white text-gray-600 hover:bg-gray-50'
              }`}
            >
              Markdown
            </button>
            <button
              onClick={() => setMode('live')}
              className={`px-3 py-1.5 text-xs font-medium rounded-r transition-colors border-l ${
                mode === 'live'
                  ? 'bg-blue-100 text-blue-700 border-blue-200'
                  : 'bg-white text-gray-600 hover:bg-gray-50 border-gray-300'
              }`}
            >
              Live
            </button>
          </div>

          <button
            onClick={handleGetAIFeedback}
            disabled={isLoadingFeedback}
            className="px-3 py-1.5 text-xs font-medium bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
            title="Get AI feedback"
          >
            {isLoadingFeedback ? (
              <>
                <svg
                  className="animate-spin h-4 w-4"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  ></circle>
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  ></path>
                </svg>
                Getting feedback...
              </>
            ) : (
              <>
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={1.5}
                  stroke="currentColor"
                  className="w-4 h-4"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z"
                  />
                </svg>
                AI Feedback
              </>
            )}
          </button>
        </div>

        <button
          onClick={() => onDelete(id)}
          className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-gray-100 rounded transition-colors"
          title="Delete design"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            stroke="currentColor"
            className="w-4 h-4"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0"
            />
          </svg>
        </button>
      </div>

      <div className="px-8 py-6 flex-1 bg-white">
        {mode === 'markdown' ? (
          <textarea
            value={markdown}
            onChange={(e) => handleMarkdownChange(e.target.value)}
            className="w-full h-full p-4 font-mono text-sm text-gray-800 bg-white border border-gray-200 rounded focus:ring-1 focus:ring-blue-400 focus:border-blue-400 resize-none"
            placeholder="Enter your markdown table here..."
          />
        ) : (
          <div>
            <EditableTable
              markdown={markdown}
              onUpdate={handleMarkdownChange}
              cardId={id}
              onAddComment={onAddComment}
              comments={comments}
            />
          </div>
        )}
      </div>
      </div>
      <CommentSidebar
        comments={comments}
        onAddReply={onAddReply}
        onResolve={onResolveComment}
        onDelete={onDeleteComment}
        markdown={markdown}
      />
    </div>
  );
}
