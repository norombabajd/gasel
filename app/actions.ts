'use server';

import { neonAuth } from '@neondatabase/auth/next/server';
import { db } from '@/app/db';
import { matrices, matrixItems, conversations, userRoles } from '@/app/db/schema';
import { eq, and, desc, asc } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';

async function getAuthUser() {
  const { user } = await neonAuth();
  if (!user) throw new Error('Unauthorized');
  return user;
}

// ---------------------------------------------------------------------------
// Category mapping between app labels and DB enum values
// ---------------------------------------------------------------------------
const CATEGORY_MAP: Record<string, string> = {
  goals: 'Goals',
  assumptions: 'Assumptions',
  constraints: 'Constraints',
  ideas: 'Ideas',
  opinions: 'Opinions',
  decisions: 'Decisions',
};

const CATEGORY_REVERSE: Record<string, string> = {
  Goals: 'goals',
  Assumptions: 'assumptions',
  Constraints: 'constraints',
  Ideas: 'ideas',
  Opinions: 'opinions',
  Decisions: 'decisions',
};

// ---------------------------------------------------------------------------
// Session CRUD (backed by `matrices` table)
// ---------------------------------------------------------------------------

/**
 * Get all sessions for the authenticated user.
 * Returns data shaped for HomeClient: each "session" is a matrix with
 * its items collapsed into a GACIODContent object and conversations
 * collapsed into a messages array.
 */
export async function getSessions() {
  const user = await getAuthUser();

  // 1. Fetch all matrices for this user
  const rows = await db
    .select()
    .from(matrices)
    .where(eq(matrices.creator, user.id))
    .orderBy(desc(matrices.updatedAt));

  // 2. For each matrix, fetch items + conversations
  const sessions = await Promise.all(
    rows.map(async (matrix) => {
      const items = await db
        .select()
        .from(matrixItems)
        .where(eq(matrixItems.matrix, matrix.id))
        .orderBy(asc(matrixItems.sortKey));

      const convos = await db
        .select()
        .from(conversations)
        .where(eq(conversations.matrix, matrix.id))
        .orderBy(asc(conversations.sequenceNum));

      return buildClientSession(matrix, items, convos);
    }),
  );

  return sessions;
}

/**
 * Get a single session by ID.
 */
export async function getSession(sessionId: string) {
  const user = await getAuthUser();

  const rows = await db
    .select()
    .from(matrices)
    .where(and(eq(matrices.id, sessionId), eq(matrices.creator, user.id)));

  const matrix = rows[0];
  if (!matrix) return null;

  const items = await db
    .select()
    .from(matrixItems)
    .where(eq(matrixItems.matrix, matrix.id))
    .orderBy(asc(matrixItems.sortKey));

  const convos = await db
    .select()
    .from(conversations)
    .where(eq(conversations.matrix, matrix.id))
    .orderBy(asc(conversations.sequenceNum));

  return buildClientSession(matrix, items, convos);
}

/**
 * Create a new empty session (matrix).
 */
export async function createSession() {
  const user = await getAuthUser();
  const id = uuidv4();
  const now = new Date().toISOString();

  const results = await db
    .insert(matrices)
    .values({
      id,
      name: 'New Chat',
      creator: user.id,
      title: '',
      question: '',
      context: '',
      createdAt: now,
      updatedAt: now,
    })
    .returning();

  return buildClientSession(results[0], [], []);
}

/**
 * Update a session. Handles:
 * - title / question / context updates on the matrix row
 * - content changes → replace all matrix_items for the matrix
 * - messages changes → replace all conversations for the matrix
 */
export async function updateSession(
  sessionId: string,
  data: {
    title?: string;
    content?: Record<string, string>;
    context?: string;
    messages?: unknown[];
  },
) {
  const user = await getAuthUser();

  // Verify ownership
  const existing = await db
    .select()
    .from(matrices)
    .where(and(eq(matrices.id, sessionId), eq(matrices.creator, user.id)));

  if (!existing[0]) return null;

  const now = new Date().toISOString();

  // Update the matrix row
  const matrixUpdate: Record<string, unknown> = { updatedAt: now };
  if (data.title !== undefined) matrixUpdate.name = data.title;
  if (data.content?.title !== undefined) matrixUpdate.title = data.content.title;
  if (data.context !== undefined) matrixUpdate.context = data.context;

  await db
    .update(matrices)
    .set(matrixUpdate)
    .where(eq(matrices.id, sessionId));

  // Update matrix_items if content changed
  if (data.content !== undefined) {
    // Delete existing items for this matrix
    await db.delete(matrixItems).where(eq(matrixItems.matrix, sessionId));

    // Insert new items
    const newItems: {
      id: string;
      matrix: string;
      category: 'Goals' | 'Assumptions' | 'Constraints' | 'Ideas' | 'Opinions' | 'Decisions';
      content: string;
      sortKey: string;
      createdAt: string;
      updatedAt: string;
      aiGenerated: boolean;
    }[] = [];

    for (const [key, dbCategory] of Object.entries(CATEGORY_MAP)) {
      const text = data.content[key] ?? '';
      if (!text.trim()) continue;
      const lines = text.split('\n').filter((l: string) => l.trim() !== '');
      lines.forEach((line: string, idx: number) => {
        newItems.push({
          id: uuidv4(),
          matrix: sessionId,
          category: dbCategory as 'Goals' | 'Assumptions' | 'Constraints' | 'Ideas' | 'Opinions' | 'Decisions',
          content: line.trim(),
          sortKey: `${dbCategory}-${String(idx).padStart(4, '0')}`,
          createdAt: now,
          updatedAt: now,
          aiGenerated: false,
        });
      });
    }

    if (newItems.length > 0) {
      await db.insert(matrixItems).values(newItems);
    }
  }

  // Update conversations if messages changed
  if (data.messages !== undefined) {
    // Delete existing conversations for this matrix
    await db.delete(conversations).where(eq(conversations.matrix, sessionId));

    // Insert new conversations
    const msgs = data.messages as Array<{
      id: string;
      text: string;
      sender: string;
      timestamp: number;
      [key: string]: unknown;
    }>;

    if (msgs.length > 0) {
      const newConvos = msgs.map((msg, idx) => ({
        id: uuidv4(),
        matrix: sessionId,
        role: msg.sender ?? 'user',
        model: msg.sender === 'assistant' ? 'gpt-5-mini-2025-08-07' : null,
        content: JSON.parse(JSON.stringify(msg)),
        sequenceNum: idx + 1,
        createdAt: msg.timestamp
          ? new Date(msg.timestamp).toISOString()
          : now,
      }));

      await db.insert(conversations).values(newConvos);
    }
  }

  // Return updated session
  return getSession(sessionId);
}

/**
 * Delete a session and all its items + conversations (cascades via FK if set,
 * but we do it explicitly to be safe).
 */
export async function deleteSession(sessionId: string) {
  const user = await getAuthUser();

  // Verify ownership
  const existing = await db
    .select()
    .from(matrices)
    .where(and(eq(matrices.id, sessionId), eq(matrices.creator, user.id)));

  if (!existing[0]) return;

  // Delete children first
  await db.delete(conversations).where(eq(conversations.matrix, sessionId));
  await db.delete(matrixItems).where(eq(matrixItems.matrix, sessionId));
  await db.delete(matrices).where(eq(matrices.id, sessionId));
}

// ---------------------------------------------------------------------------
// Import sessions from an exported JSON file
// ---------------------------------------------------------------------------

export async function importSessions(
  importData: {
    sessions: Array<{
      title: string;
      content: Record<string, string>;
      context: string;
      messages: unknown[];
      createdAt: string | number;
      updatedAt: string | number;
    }>;
  },
) {
  const user = await getAuthUser();
  const results: ReturnType<typeof buildClientSession>[] = [];

  for (const session of importData.sessions) {
    const id = uuidv4();
    const now = new Date().toISOString();

    await db.insert(matrices).values({
      id,
      name: session.title || 'Imported Chat',
      creator: user.id,
      title: session.content?.title || '',
      question: '',
      context: session.context || '',
      createdAt: now,
      updatedAt: now,
    });

    const newItems: {
      id: string;
      matrix: string;
      category: 'Goals' | 'Assumptions' | 'Constraints' | 'Ideas' | 'Opinions' | 'Decisions';
      content: string;
      sortKey: string;
      createdAt: string;
      updatedAt: string;
      aiGenerated: boolean;
    }[] = [];

    for (const [key, dbCategory] of Object.entries(CATEGORY_MAP)) {
      const text = (session.content as Record<string, string>)?.[key] ?? '';
      if (!text.trim()) continue;
      const lines = text.split('\n').filter((l: string) => l.trim() !== '');
      lines.forEach((line: string, idx: number) => {
        newItems.push({
          id: uuidv4(),
          matrix: id,
          category: dbCategory as 'Goals' | 'Assumptions' | 'Constraints' | 'Ideas' | 'Opinions' | 'Decisions',
          content: line.trim(),
          sortKey: `${dbCategory}-${String(idx).padStart(4, '0')}`,
          createdAt: now,
          updatedAt: now,
          aiGenerated: false,
        });
      });
    }

    if (newItems.length > 0) {
      await db.insert(matrixItems).values(newItems);
    }

    const msgs = (session.messages ?? []) as Array<{
      id: string;
      text: string;
      sender: string;
      timestamp: number;
      [key: string]: unknown;
    }>;

    if (msgs.length > 0) {
      const newConvos = msgs.map((msg, idx) => ({
        id: uuidv4(),
        matrix: id,
        role: msg.sender ?? 'user',
        model: msg.sender === 'assistant' ? 'gpt-5-mini-2025-08-07' : null,
        content: JSON.parse(JSON.stringify(msg)),
        sequenceNum: idx + 1,
        createdAt: msg.timestamp
          ? new Date(msg.timestamp).toISOString()
          : now,
      }));
      await db.insert(conversations).values(newConvos);
    }

    // Fetch back the complete session
    const items = await db
      .select()
      .from(matrixItems)
      .where(eq(matrixItems.matrix, id))
      .orderBy(asc(matrixItems.sortKey));

    const convos = await db
      .select()
      .from(conversations)
      .where(eq(conversations.matrix, id))
      .orderBy(asc(conversations.sequenceNum));

    const matrixRow = await db
      .select()
      .from(matrices)
      .where(eq(matrices.id, id));

    if (matrixRow[0]) {
      results.push(buildClientSession(matrixRow[0], items, convos));
    }
  }

  return results;
}

// ---------------------------------------------------------------------------
// Helper: build a ClientSession-compatible object from DB rows
// ---------------------------------------------------------------------------

function buildClientSession(
  matrix: typeof matrices.$inferSelect,
  items: (typeof matrixItems.$inferSelect)[],
  convos: (typeof conversations.$inferSelect)[],
) {
  // Group items by category → reconstruct GACIODContent
  const contentMap: Record<string, string[]> = {
    goals: [],
    assumptions: [],
    constraints: [],
    ideas: [],
    opinions: [],
    decisions: [],
  };

  for (const item of items) {
    const key = CATEGORY_REVERSE[item.category ?? ''];
    if (key && item.content) {
      contentMap[key].push(item.content);
    }
  }

  const content = {
    title: matrix.title ?? '',
    goals: contentMap.goals.join('\n'),
    assumptions: contentMap.assumptions.join('\n'),
    constraints: contentMap.constraints.join('\n'),
    ideas: contentMap.ideas.join('\n'),
    opinions: contentMap.opinions.join('\n'),
    decisions: contentMap.decisions.join('\n'),
  };

  // Reconstruct messages from conversations
  const messages = convos.map((c) => {
    // The full message object is stored in content jsonb
    if (c.content && typeof c.content === 'object' && 'id' in (c.content as Record<string, unknown>)) {
      return c.content as Record<string, unknown>;
    }
    // Fallback: construct from individual fields
    return {
      id: c.id,
      text: typeof c.content === 'string' ? c.content : JSON.stringify(c.content),
      sender: c.role ?? 'user',
      timestamp: c.createdAt ? new Date(c.createdAt).getTime() : Date.now(),
    };
  });

  return {
    id: matrix.id,
    title: matrix.name ?? matrix.title ?? 'New Chat',
    content,
    context: matrix.context ?? '',
    messages,
    createdAt: matrix.createdAt ?? new Date().toISOString(),
    updatedAt: matrix.updatedAt ?? new Date().toISOString(),
  };
}
