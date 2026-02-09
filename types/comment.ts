/**
 * LEGACY TYPES
 * These types are not currently used in the main application.
 * They were part of an earlier iteration with AI feedback comments.
 * Only used by legacy components (TableCard, CommentSidebar, EditableTable).
 * Consider removing if those components are no longer needed.
 */
export interface Comment {
  id: string;
  cardId: string;
  tableIdx: number;
  colIdx: number;
  rowIdx: number;
  author: string;
  text: string;
  timestamp: number;
  resolved: boolean;
  replies?: CommentReply[];
}

export interface CommentReply {
  id: string;
  author: string;
  text: string;
  timestamp: number;
}
