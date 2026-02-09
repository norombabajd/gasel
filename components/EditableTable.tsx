/**
 * LEGACY COMPONENT
 * This component is not currently used in the main application.
 * It was part of an earlier iteration with table-based editing.
 * Only imported by the legacy TableCard component.
 * Consider removing if no longer needed.
 */
'use client';

import { useState } from 'react';
import { Comment } from '@/types/comment';

interface EditableTableProps {
  markdown: string;
  onUpdate: (markdown: string) => void;
  cardId: string;
  onAddComment: (cardId: string, tableIdx: number, colIdx: number, rowIdx: number, text: string, author?: string) => void;
  comments: Comment[];
}

interface TableData {
  headers: string[];
  rows: string[][];
}

function parseMarkdownTable(markdown: string): TableData[] {
  const tables: TableData[] = [];
  const lines = markdown.trim().split('\n');

  let i = 0;
  while (i < lines.length) {
    const line = lines[i].trim();

    // Check if this line looks like a table header
    if (line.startsWith('|') && line.endsWith('|')) {
      const headers = line
        .split('|')
        .slice(1, -1)
        .map(h => h.trim());

      // Check for separator line
      if (i + 1 < lines.length && lines[i + 1].includes('---')) {
        i += 2; // Skip header and separator
        const rows: string[][] = [];

        // Collect all table rows
        while (i < lines.length && lines[i].trim().startsWith('|')) {
          const row = lines[i]
            .trim()
            .split('|')
            .slice(1, -1)
            .map(c => {
              // Remove leading bullet points (•, -, *) and trim
              const trimmed = c.trim();
              if (trimmed.startsWith('•')) return trimmed.slice(1).trim();
              if (trimmed.startsWith('-')) return trimmed.slice(1).trim();
              if (trimmed.startsWith('*')) return trimmed.slice(1).trim();
              return trimmed;
            });
          rows.push(row);
          i++;
        }

        tables.push({ headers, rows });
        continue;
      }
    }
    i++;
  }

  return tables;
}

function tableToMarkdown(table: TableData): string {
  const headerRow = '| ' + table.headers.join(' | ') + ' |';
  const separatorRow = '|' + table.headers.map(() => '------|').join('');
  // Add markdown bullet points (dash) to each cell
  const dataRows = table.rows.map(row =>
    '| ' + row.map(cell => cell.trim() ? `- ${cell.trim()}` : '').join(' | ') + ' |'
  );

  return [headerRow, separatorRow, ...dataRows].join('\n');
}

function formatBulletPoints(items: string[]): React.JSX.Element[] {
  const nonEmptyItems = items.filter(item => item.trim() !== '');
  if (nonEmptyItems.length === 0) {
    return [];
  }

  return nonEmptyItems.map((item, idx) => (
    <div key={idx} className="flex items-start gap-2 mb-2">
      <span className="text-blue-600 mt-1">•</span>
      <span className="flex-1">{item.trim()}</span>
    </div>
  ));
}

export default function EditableTable({ markdown, onUpdate, cardId, onAddComment, comments }: EditableTableProps) {
  const tables = parseMarkdownTable(markdown);
  const [editingCell, setEditingCell] = useState<{
    tableIdx: number;
    colIdx: number;
  } | null>(null);
  const [commentingOn, setCommentingOn] = useState<{
    tableIdx: number;
    colIdx: number;
    rowIdx: number;
  } | null>(null);
  const [commentText, setCommentText] = useState('');

  const updateCell = (tableIdx: number, colIdx: number, value: string) => {
    const updatedTables = [...tables];

    // Split value by newlines to create multiple rows
    const lines = value.split('\n');
    const newRows: string[][] = [];

    // Create rows from the lines, maintaining column structure
    lines.forEach(line => {
      const newRow = new Array(updatedTables[tableIdx].headers.length).fill('');
      let cleanLine = line.trim();
      // Remove bullet prefix if present
      if (cleanLine.startsWith('• ')) cleanLine = cleanLine.slice(2);
      if (cleanLine.startsWith('- ')) cleanLine = cleanLine.slice(2);
      if (cleanLine.startsWith('* ')) cleanLine = cleanLine.slice(2);
      newRow[colIdx] = cleanLine;
      newRows.push(newRow);
    });

    // Merge with existing data from other columns
    const maxRows = Math.max(newRows.length, updatedTables[tableIdx].rows.length);
    const mergedRows: string[][] = [];

    for (let rowIdx = 0; rowIdx < maxRows; rowIdx++) {
      const row = new Array(updatedTables[tableIdx].headers.length).fill('');

      for (let col = 0; col < updatedTables[tableIdx].headers.length; col++) {
        if (col === colIdx) {
          // Use the new data for the edited column
          row[col] = rowIdx < newRows.length ? newRows[rowIdx][col] : '';
        } else {
          // Keep existing data for other columns
          row[col] = rowIdx < updatedTables[tableIdx].rows.length
            ? updatedTables[tableIdx].rows[rowIdx][col]
            : '';
        }
      }

      mergedRows.push(row);
    }

    updatedTables[tableIdx].rows = mergedRows;

    // Convert all tables back to markdown
    const markdownParts = updatedTables.map(table => tableToMarkdown(table));
    onUpdate(markdownParts.join('\n\n'));
  };

  const handleAddComment = () => {
    if (commentingOn && commentText.trim()) {
      onAddComment(
        cardId,
        commentingOn.tableIdx,
        commentingOn.colIdx,
        commentingOn.rowIdx,
        commentText
      );
      setCommentText('');
      setCommentingOn(null);
    }
  };

  const hasComment = (tableIdx: number, colIdx: number, rowIdx: number) => {
    return comments.some(
      c => c.tableIdx === tableIdx && c.colIdx === colIdx && c.rowIdx === rowIdx && !c.resolved
    );
  };

  if (tables.length === 0) {
    return (
      <div className="text-gray-500 text-center py-8">
        No valid tables found. Switch to Markdown mode to create a table.
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {tables.map((table, tableIdx) => (
        <div key={tableIdx} className="grid grid-cols-3 gap-4">
          {table.headers.map((header, colIdx) => {
            // Extract all values from this column across all rows
            const columnValues = table.rows.map(row => row[colIdx] || '');
            const columnText = columnValues.join('\n');
            // For editing, show with bullets
            const columnTextWithBullets = columnValues
              .map(val => val.trim() ? `• ${val}` : '')
              .join('\n');

            return (
              <div key={colIdx} className="flex flex-col">
                <div className="bg-blue-50 rounded-t-lg border-2 border-blue-200 px-4 py-2">
                  <div className="text-base font-bold text-blue-900 text-center">
                    {header}
                  </div>
                </div>
                <div className="bg-white rounded-b-lg border-2 border-t-0 border-blue-200 flex-1 px-4 py-3">
                  {editingCell?.tableIdx === tableIdx &&
                  editingCell?.colIdx === colIdx ? (
                    <textarea
                      value={columnTextWithBullets}
                      onChange={(e) => updateCell(tableIdx, colIdx, e.target.value)}
                      onBlur={() => setEditingCell(null)}
                      onKeyDown={(e) => {
                        if (e.key === 'Escape') {
                          setEditingCell(null);
                        }
                      }}
                      autoFocus
                      placeholder="• Enter each item on a new line&#10;• Start each line with a bullet"
                      className="w-full h-auto text-sm text-gray-700 bg-blue-50 border-2 border-blue-500 rounded px-3 py-2 focus:outline-none resize-none font-sans leading-relaxed"
                      rows={6}
                    />
                  ) : (
                    <div className="space-y-2">
                      <div
                        onClick={() => setEditingCell({ tableIdx, colIdx })}
                        className="cursor-pointer hover:bg-gray-50 rounded px-2 py-2"
                      >
                        {columnText && columnText.trim() !== '' ? (
                          <div className="text-sm text-gray-700">
                            {columnValues.map((value, rowIdx) => {
                              if (value.trim() === '') return null;
                              const hasCommentMarker = hasComment(tableIdx, colIdx, rowIdx);
                              return (
                                <div
                                  key={rowIdx}
                                  className={`flex items-start gap-2 mb-1.5 group relative ${
                                    hasCommentMarker ? 'bg-yellow-50 -mx-2 px-2 py-1 rounded' : ''
                                  }`}
                                >
                                  <span className="text-blue-600 mt-0.5 text-xs">•</span>
                                  <span className="flex-1 leading-snug">{value.trim()}</span>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setCommentingOn({ tableIdx, colIdx, rowIdx });
                                    }}
                                    className="opacity-0 group-hover:opacity-100 transition-opacity text-gray-400 hover:text-blue-600"
                                    title="Add comment"
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
                                        d="M12 4.5v15m7.5-7.5h-15"
                                      />
                                    </svg>
                                  </button>
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <div className="text-gray-400 italic">Click to add items...</div>
                        )}
                      </div>

                      {commentingOn?.tableIdx === tableIdx &&
                      commentingOn?.colIdx === colIdx && (
                        <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-3">
                          <textarea
                            value={commentText}
                            onChange={(e) => setCommentText(e.target.value)}
                            placeholder="Add a comment..."
                            className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                            rows={3}
                            autoFocus
                          />
                          <div className="flex gap-2 mt-2">
                            <button
                              onClick={handleAddComment}
                              className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                            >
                              Comment
                            </button>
                            <button
                              onClick={() => {
                                setCommentingOn(null);
                                setCommentText('');
                              }}
                              className="px-3 py-1 text-sm bg-gray-200 text-gray-700 rounded hover:bg-gray-300 transition-colors"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
