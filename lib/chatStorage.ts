import { Message } from '@/components/Chat';

export interface GACIODContent {
  title: string;
  goals: string;
  assumptions: string;
  constraints: string;
  ideas: string;
  opinions: string;
  decisions: string;
}

export interface ChatSession {
  id: string;
  title: string;
  messages: Message[];
  content: GACIODContent;
  context: string;
  createdAt: number;
  updatedAt: number;
}

const STORAGE_KEY = 'gasel-chat-sessions';
const ACTIVE_SESSION_KEY = 'gasel-active-session';

function emptyContent(): GACIODContent {
  return {
    title: '',
    goals: '',
    assumptions: '',
    constraints: '',
    ideas: '',
    opinions: '',
    decisions: '',
  };
}

export function createSession(): ChatSession {
  return {
    id: Date.now().toString(),
    title: 'New Chat',
    messages: [],
    content: emptyContent(),
    context: '',
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

export function loadSessions(): ChatSession[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as ChatSession[];
  } catch {
    return [];
  }
}

export function saveSessions(sessions: ChatSession[]) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
}

export function saveSession(session: ChatSession) {
  const sessions = loadSessions();
  const idx = sessions.findIndex(s => s.id === session.id);
  if (idx >= 0) {
    sessions[idx] = session;
  } else {
    sessions.unshift(session);
  }
  saveSessions(sessions);
}

export function deleteSession(id: string) {
  const sessions = loadSessions().filter(s => s.id !== id);
  saveSessions(sessions);
}

export function loadActiveSessionId(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(ACTIVE_SESSION_KEY);
}

export function saveActiveSessionId(id: string) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(ACTIVE_SESSION_KEY, id);
}

/** Derive a short title from the session content or first user message */
export function deriveTitle(session: ChatSession): string {
  if (session.content.title.trim()) {
    return session.content.title.trim().slice(0, 50);
  }
  const firstUserMsg = session.messages.find(m => m.sender === 'user');
  if (firstUserMsg) {
    return firstUserMsg.text.slice(0, 50);
  }
  return 'New Chat';
}
