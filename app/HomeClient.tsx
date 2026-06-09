'use client';

import { useState, useMemo, useEffect, useCallback, useTransition, useRef, forwardRef } from 'react';
import GACIODCard, { formatForAI, type AccentColor } from '@/components/GACIODCard';
import Chat, { Message, Improvement, Modification } from '@/components/Chat';
import ChatSidebar from '@/components/ChatSidebar';
import { authClient } from '@/lib/auth/client';
import {
  IconTarget,
  IconHelpCircle,
  IconLock,
  IconBulb,
  IconMessageCircle,
  IconFlagCheck,
  IconChecklist,
  IconZoomQuestion,
  IconSparkles,
  IconShare3,
  IconNotes,
  IconMessages,
  IconPencil,
  type TablerIcon,
  IconCheck,
} from '@tabler/icons-react';
import {
  createSession as createDbSession,
  updateSession as updateDbSession,
  deleteSession as deleteDbSession,
  importSessions as importDbSessions,
} from '@/app/actions';

export interface GACIODContent {
  title: string;
  goals: string;
  assumptions: string;
  constraints: string;
  ideas: string;
  opinions: string;
  decisions: string;
  goalsArchived: string;
  assumptionsArchived: string;
  constraintsArchived: string;
  ideasArchived: string;
  opinionsArchived: string;
  decisionsArchived: string;
}

// Map an active category key → its archived counterpart
const ARCHIVED_KEY: Record<string, keyof GACIODContent> = {
  goals: 'goalsArchived',
  assumptions: 'assumptionsArchived',
  constraints: 'constraintsArchived',
  ideas: 'ideasArchived',
  opinions: 'opinionsArchived',
  decisions: 'decisionsArchived',
};

export interface ClientSession {
  id: string;
  title: string;
  content: GACIODContent;
  context: string;
  messages: Message[];
  onboarded: boolean;
  createdAt: number;
  updatedAt: number;
}

// Greeting bank for the chat-first onboarding (client-seeded, no API call).
const GREETINGS = [
  "Hi {name} — I'm Gazelle. Let's turn an idea into a plan. What are you working on?",
  "Hello {name}! Gazelle here. What's the project on your mind today?",
  "Hey {name}, I'm Gazelle. Tell me what you're trying to build and we'll shape it together — what are you working on?",
  "Welcome, {name}. I'm Gazelle, your design partner. What problem are we tackling this time?",
  "Hi {name} — Gazelle at your service. What's the thing you want to design or figure out?",
];

function pickGreeting(firstName: string): string {
  const name = firstName || 'there';
  return GREETINGS[Math.floor(Math.random() * GREETINGS.length)].replace('{name}', name);
}

// Lightweight, dependency-free confetti burst (uses the matrix accent colors).
function fireConfetti() {
  if (typeof document === 'undefined') return;
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;

  const colors = ['#22C55E', '#E8B84B', '#E07070', '#AB6FD4', '#E8834A', '#4A8FD4'];
  const container = document.createElement('div');
  container.style.cssText =
    'position:fixed;inset:0;pointer-events:none;z-index:9999;overflow:hidden;';
  document.body.appendChild(container);

  const count = 130;
  for (let i = 0; i < count; i++) {
    const piece = document.createElement('div');
    const w = 6 + Math.random() * 6;
    const h = w * (0.4 + Math.random() * 0.9);
    const color = colors[Math.floor(Math.random() * colors.length)];
    piece.style.cssText =
      `position:absolute;top:-20px;left:${Math.random() * 100}vw;width:${w}px;height:${h}px;` +
      `background:${color};border-radius:1px;will-change:transform;`;
    container.appendChild(piece);

    const xDrift = (Math.random() - 0.5) * 260;
    const rotate = (Math.random() - 0.5) * 720;
    const duration = 2200 + Math.random() * 1600;
    const delay = Math.random() * 350;
    const anim = piece.animate(
      [
        { transform: 'translate(0, 0) rotate(0deg)', opacity: 1 },
        { transform: `translate(${xDrift}px, 105vh) rotate(${rotate}deg)`, opacity: 1, offset: 0.85 },
        { transform: `translate(${xDrift}px, 110vh) rotate(${rotate}deg)`, opacity: 0 },
      ],
      { duration, delay, easing: 'cubic-bezier(0.2, 0.6, 0.4, 1)', fill: 'forwards' },
    );
    anim.onfinish = () => piece.remove();
  }

  setTimeout(() => container.remove(), 5000);
}

// A single-line-styled textarea that wraps and grows with its content (no clipping).
const AutoTextarea = forwardRef<HTMLTextAreaElement, {
  value: string;
  onChange: (value: string) => void;
  onKeyDown?: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  placeholder?: string;
  className?: string;
}>(function AutoTextarea({ value, onChange, onKeyDown, placeholder, className }, forwardedRef) {
  const innerRef = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    const el = innerRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }, [value]);
  return (
    <textarea
      ref={(node) => {
        innerRef.current = node;
        if (typeof forwardedRef === 'function') forwardedRef(node);
        else if (forwardedRef) forwardedRef.current = node;
      }}
      rows={1}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={onKeyDown}
      placeholder={placeholder}
      className={`resize-none ${className ?? ''}`}
    />
  );
});

function emptyContent(): GACIODContent {
  return {
    title: '',
    goals: '',
    assumptions: '',
    constraints: '',
    ideas: '',
    opinions: '',
    decisions: '',
    goalsArchived: '',
    assumptionsArchived: '',
    constraintsArchived: '',
    ideasArchived: '',
    opinionsArchived: '',
    decisionsArchived: '',
  };
}

interface CardConfig {
  key: 'goals' | 'assumptions' | 'constraints' | 'ideas' | 'opinions' | 'decisions';
  title: string;
  prefix: string;
  color: AccentColor;
  icon: TablerIcon;
  subtitle: string;
  singular: string;
  plural: string;
}

const CARDS: CardConfig[] = [
  { key: 'goals', title: 'Goals', prefix: 'G', color: 'green', icon: IconTarget, subtitle: 'What are the outcomes you are designing towards?', singular: 'goal', plural: 'goals' },
  { key: 'assumptions', title: 'Assumptions', prefix: 'A', color: 'yellow', icon: IconHelpCircle, subtitle: 'What are you treating as true without full evidence?', singular: 'assumption', plural: 'assumptions' },
  { key: 'constraints', title: 'Constraints', prefix: 'C', color: 'red', icon: IconLock, subtitle: 'What limits our solution space?', singular: 'constraint', plural: 'constraints' },
  { key: 'ideas', title: 'Ideas', prefix: 'I', color: 'violet', icon: IconBulb, subtitle: 'What approaches are worth exploring?', singular: 'idea', plural: 'ideas' },
  { key: 'opinions', title: 'Opinions', prefix: 'O', color: 'orange', icon: IconMessageCircle, subtitle: "What do we think, but can't prove?", singular: 'opinion', plural: 'opinions' },
  { key: 'decisions', title: 'Decision + Rationale', prefix: 'D', color: 'blue', icon: IconFlagCheck, subtitle: 'What have we committed to and why?', singular: 'decision', plural: 'decisions' },
];

const LEFT_WIDTH_DEFAULT = 440;
const LEFT_WIDTH_MIN = 340;
const LEFT_WIDTH_MAX = 720;

/** Convert DB session rows (from buildClientSession in actions.ts) to client format */
function toClientSession(row: any): ClientSession {
  return {
    id: row.id,
    title: row.title ?? 'New Chat',
    content: { ...emptyContent(), ...(row.content as Partial<GACIODContent>) },
    context: row.context ?? '',
    messages: (row.messages as Message[]) ?? [],
    onboarded: row.onboarded ?? true,
    createdAt: row.createdAt ? new Date(row.createdAt).getTime() : Date.now(),
    updatedAt: row.updatedAt ? new Date(row.updatedAt).getTime() : Date.now(),
  };
}

interface HomeClientProps {
  initialSessions: any[];
}

export default function HomeClient({ initialSessions }: HomeClientProps) {
  const { data: sessionData } = authClient.useSession();
  const userName = sessionData?.user?.name || '';
  const firstName = userName.split(' ')[0] || '';

  const [sessions, setSessions] = useState<ClientSession[]>(
    () => initialSessions.map(toClientSession),
  );
  const [activeSessionId, setActiveSessionId] = useState<string>(
    () => sessions[0]?.id ?? '',
  );
  const [chatSidebarOpen, setChatSidebarOpen] = useState(false);
  const [, startTransition] = useTransition();

  const activeSession = useMemo(
    () => sessions.find((s) => s.id === activeSessionId),
    [sessions, activeSessionId],
  );

  const [content, setContent] = useState<GACIODContent>(
    () => activeSession?.content ?? emptyContent(),
  );
  const [messages, setMessages] = useState<Message[]>(
    () => activeSession?.messages ?? [],
  );
  // Onboarding (chat-first) state. A session is "onboarded" once the matrix is revealed.
  const [onboarded, setOnboarded] = useState<boolean>(
    () => activeSession?.onboarded ?? false,
  );
  const [pendingTopic, setPendingTopic] = useState<string | null>(null);
  const [pendingContext, setPendingContext] = useState<string | null>(null);
  type OnboardStep = 'topic' | 'offer_walkthrough' | 'walkthrough' | 'done';
  const [onboardStep, setOnboardStep] = useState<OnboardStep>('topic');
  const [openCountdown, setOpenCountdown] = useState<number | null>(null);
  const onboardingInit = useRef(false);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showDebugMenu, setShowDebugMenu] = useState(false);
  const [context, setContext] = useState(activeSession?.context ?? '');
  const [leftWidth, setLeftWidth] = useState(LEFT_WIDTH_DEFAULT);
  const columnsRef = useRef<HTMLDivElement>(null);
  const isResizing = useRef(false);
  const topicRef = useRef<HTMLTextAreaElement>(null);

  // Restore persisted left-column width
  useEffect(() => {
    const saved = Number(localStorage.getItem('gasel-left-width'));
    if (saved >= LEFT_WIDTH_MIN && saved <= LEFT_WIDTH_MAX) setLeftWidth(saved);
  }, []);

  useEffect(() => {
    localStorage.setItem('gasel-left-width', String(leftWidth));
  }, [leftWidth]);

  const startResize = (e: React.MouseEvent) => {
    e.preventDefault();
    isResizing.current = true;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    const onMove = (ev: MouseEvent) => {
      if (!isResizing.current) return;
      const containerLeft = columnsRef.current?.getBoundingClientRect().left ?? 0;
      const w = Math.min(LEFT_WIDTH_MAX, Math.max(LEFT_WIDTH_MIN, ev.clientX - containerLeft));
      setLeftWidth(w);
    };
    const onUp = () => {
      isResizing.current = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  // Begin a fresh chat-first onboarding (no DB write yet — session is created lazily on first send).
  const startOnboarding = useCallback(() => {
    setActiveSessionId('');
    setContent(emptyContent());
    setContext('');
    setPendingTopic(null);
    setPendingContext(null);
    setOnboardStep('topic');
    setMessages([
      {
        id: Date.now().toString(),
        text: pickGreeting(firstName),
        sender: 'assistant',
        timestamp: Date.now(),
      },
    ]);
    setOnboarded(false);
    setChatSidebarOpen(false);
  }, [firstName]);

  // Brand-new users (no sessions) start in onboarding once auth (and their name) resolves.
  useEffect(() => {
    if (onboardingInit.current) return;
    if (sessionData === undefined) return; // wait for the user's name to load
    if (sessions.length === 0) {
      onboardingInit.current = true;
      startOnboarding();
    }
  }, [sessionData, sessions.length, startOnboarding]);

  // Ensure a DB session exists, creating one lazily. Returns its id.
  const ensureSession = useCallback(async (): Promise<string> => {
    if (activeSessionId) return activeSessionId;
    const newRow = await createDbSession();
    const cs = toClientSession(newRow);
    setSessions((prev) => [cs, ...prev]);
    setActiveSessionId(cs.id);
    return cs.id;
  }, [activeSessionId]);

  // Derive title helper
  const deriveTitle = useCallback(
    (msgs: Message[], cont: GACIODContent): string => {
      if (cont.title.trim()) return cont.title.trim().slice(0, 50);
      const firstUserMsg = msgs.find((m) => m.sender === 'user');
      if (firstUserMsg) return firstUserMsg.text.slice(0, 50);
      return 'New Chat';
    },
    [],
  );

  // Persist to DB on content/messages/context change (debounced). Runs during
  // onboarding too (once a session exists) so the conversation is saved.
  useEffect(() => {
    if (!activeSessionId) return;
    const timeout = setTimeout(() => {
      const title = deriveTitle(messages, content);
      startTransition(async () => {
        await updateDbSession(activeSessionId, {
          title,
          content: content as unknown as Record<string, string>,
          context,
          messages: messages as unknown[],
          onboarded,
        });
      });
      // Update local sessions state
      setSessions((prev) =>
        prev.map((s) =>
          s.id === activeSessionId
            ? { ...s, title, content, context, messages, onboarded, updatedAt: Date.now() }
            : s,
        ),
      );
    }, 500);
    return () => clearTimeout(timeout);
  }, [content, messages, context, activeSessionId, onboarded, deriveTitle]);

  const handleNewChat = () => {
    startOnboarding();
  };

  const handleSelectSession = (id: string) => {
    if (id === activeSessionId && onboarded) {
      setChatSidebarOpen(false);
      return;
    }
    const session = sessions.find((s) => s.id === id);
    if (!session) return;
    setActiveSessionId(id);
    setContent(session.content);
    setMessages(session.messages);
    setContext(session.context);
    setOnboarded(session.onboarded);
    setPendingTopic(null);
    setPendingContext(null);
    setOnboardStep(session.onboarded ? 'done' : 'topic');
    setInputValue('');
    setChatSidebarOpen(false);
  };

  const handleDeleteSession = (id: string) => {
    startTransition(async () => {
      await deleteDbSession(id);
    });
    const remaining = sessions.filter((s) => s.id !== id);
    if (remaining.length === 0) {
      setSessions([]);
      handleNewChat();
    } else {
      setSessions(remaining);
      if (id === activeSessionId) {
        const next = remaining[0];
        setActiveSessionId(next.id);
        setContent(next.content);
        setMessages(next.messages);
        setContext(next.context);
        setOnboarded(next.onboarded);
        setPendingTopic(null);
        setPendingContext(null);
        setOnboardStep(next.onboarded ? 'done' : 'topic');
      }
    }
    setInputValue('');
  };

  const updateContent = (key: keyof GACIODContent, value: string) => {
    setContent({ ...content, [key]: value });
  };

  // Move an item between the active and archived lists for a category.
  const moveItem = (
    category: keyof GACIODContent,
    index: number,
    direction: 'archive' | 'unarchive',
  ) => {
    const archivedKey = ARCHIVED_KEY[category];
    if (!archivedKey) return;
    setContent((prev) => {
      const fromKey = direction === 'archive' ? category : archivedKey;
      const toKey = direction === 'archive' ? archivedKey : category;
      const fromItems = parseItems(prev[fromKey]);
      if (index < 0 || index >= fromItems.length) return prev;
      const [moved] = fromItems.splice(index, 1);
      const toItems = parseItems(prev[toKey]);
      toItems.push(moved);
      return {
        ...prev,
        [fromKey]: fromItems.join('\n'),
        [toKey]: toItems.join('\n'),
      };
    });
  };

  const stripLabel = (text: string): string => {
    return text.replace(/^[GACIOD]-\d{2}:\s*/, '').trim();
  };

  const parseItems = (contentStr: string): string[] => {
    if (!contentStr.trim()) return [];
    return contentStr
      .split('\n')
      .filter((line) => line.trim() !== '')
      .map(stripLabel);
  };

  const resolveLabelToIndex = (
    label: string,
  ): { category: keyof GACIODContent; index: number } | null => {
    const match = label.match(/^([GACIOD])-(\d{2})$/);
    if (!match) return null;
    const [, prefix, numStr] = match;
    const index = parseInt(numStr, 10) - 1;
    const categoryMap: Record<string, keyof GACIODContent> = {
      G: 'goals',
      A: 'assumptions',
      C: 'constraints',
      I: 'ideas',
      O: 'opinions',
      D: 'decisions',
    };
    const category = categoryMap[prefix];
    if (!category) return null;
    const items = parseItems(content[category]);
    if (index < 0 || index >= items.length) return null;
    return { category, index };
  };

  const handleAcceptImprovement = (improvement: Improvement) => {
    const category = improvement.category.toLowerCase() as keyof GACIODContent;
    const originalTextClean = stripLabel(improvement.originalText);
    const newTextClean = stripLabel(improvement.newText);

    // Use functional update to avoid stale closure over content
    setContent((prev) => {
      if (prev[category]) {
        const items = parseItems(prev[category]);
        const matchIndex = items.findIndex(
          (item) =>
            item === originalTextClean ||
            item.trim() === originalTextClean.trim() ||
            item.includes(originalTextClean) ||
            originalTextClean.includes(item),
        );

        if (matchIndex !== -1) {
          const newItems = [...items];
          newItems[matchIndex] = newTextClean;
          return { ...prev, [category]: newItems.join('\n') };
        }
      }
      return prev;
    });

    // Always mark the improvement status regardless of content match
    setMessages((prev) =>
      prev.map((msg) => {
        if (msg.improvements) {
          const newImprovements = msg.improvements.map((imp) =>
            imp.category === improvement.category &&
            imp.originalText === improvement.originalText
              ? { ...imp, status: 'accepted' as const }
              : imp,
          );
          return { ...msg, improvements: newImprovements };
        }
        return msg;
      }),
    );
  };

  const handleDenyImprovement = (
    messageId: string,
    improvementIndex: number,
  ) => {
    setMessages((prev) =>
      prev.map((msg) => {
        if (msg.id === messageId && msg.improvements) {
          const newImprovements = msg.improvements.map((imp, idx) =>
            idx === improvementIndex
              ? { ...imp, status: 'denied' as const }
              : imp,
          );
          return { ...msg, improvements: newImprovements };
        }
        return msg;
      }),
    );
  };

  const handleAcceptModification = (modification: Modification) => {
    const category = modification.category as keyof GACIODContent;

    // Use functional update to avoid stale closure over content
    setContent((prev) => {
      const newText = modification.newText ? stripLabel(modification.newText) : '';

      if (category === 'title') {
        switch (modification.operation) {
          case 'ADD':
          case 'UPDATE':
            if (newText) {
              return { ...prev, title: newText };
            }
            break;
          case 'DELETE':
            return { ...prev, title: '' };
        }
        return prev;
      }

      const items = parseItems(prev[category]);
      let newItems: string[] | null = null;

      switch (modification.operation) {
        case 'ADD':
          if (newText) {
            newItems = [...items, newText];
          }
          break;
        case 'UPDATE':
          if (modification.label && newText) {
            // Resolve label against the current (up-to-date) content
            const match = modification.label.match(/^([GACIOD])-(\d{2})$/);
            if (match) {
              const index = parseInt(match[2], 10) - 1;
              if (index >= 0 && index < items.length) {
                newItems = [...items];
                newItems[index] = newText;
              }
            }
          }
          break;
        case 'DELETE':
          if (modification.label) {
            const match = modification.label.match(/^([GACIOD])-(\d{2})$/);
            if (match) {
              const index = parseInt(match[2], 10) - 1;
              if (index >= 0 && index < items.length) {
                newItems = items.filter((_, idx) => idx !== index);
              }
            }
          }
          break;
      }

      if (newItems !== null) {
        return { ...prev, [category]: newItems.join('\n') };
      }
      return prev;
    });

    // Always mark the modification status, even if content application failed
    // Use a flag to only mark the first matching pending modification
    setMessages((prev) =>
      prev.map((msg) => {
        if (msg.modifications) {
          let found = false;
          const newModifications = msg.modifications.map((mod) => {
            if (found) return mod;
            const isMatch = category === 'title'
              ? mod.operation === modification.operation &&
                mod.category === modification.category &&
                mod.newText === modification.newText
              : mod.label === modification.label &&
                mod.operation === modification.operation &&
                mod.category === modification.category &&
                mod.newText === modification.newText &&
                mod.currentText === modification.currentText;
            if (isMatch && (mod.status ?? 'pending') === 'pending') {
              found = true;
              return { ...mod, status: 'accepted' as const };
            }
            return mod;
          });
          return { ...msg, modifications: newModifications };
        }
        return msg;
      }),
    );
  };

  const handleDenyModification = (
    messageId: string,
    modificationIndex: number,
  ) => {
    setMessages((prev) =>
      prev.map((msg) => {
        if (msg.id === messageId && msg.modifications) {
          const newModifications = msg.modifications.map((mod, idx) =>
            idx === modificationIndex
              ? { ...mod, status: 'denied' as const }
              : mod,
          );
          return { ...msg, modifications: newModifications };
        }
        return msg;
      }),
    );
  };

  const handleExportData = () => {
    try {
      const exportData = {
        exportedAt: new Date().toISOString(),
        exportedTimestamp: Date.now(),
        activeSessionId,
        totalSessions: sessions.length,
        sessions,
      };
      const dataStr = JSON.stringify(exportData, null, 2);
      const blob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `gasel-chat-export-${Date.now()}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error exporting data:', error);
    }
  };

  // Share = export the matrix, drop a "Workspace shared." note in the chat, and celebrate.
  const handleShare = () => {
    handleExportData();
    setMessages((prev) => [
      ...prev,
      {
        id: `${Date.now()}-share`,
        text: 'Workspace shared.',
        sender: 'system',
        timestamp: Date.now(),
      },
    ]);
    fireConfetti();
  };

  const handleImportData = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,application/json';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;

      try {
        const text = await file.text();
        const importData = JSON.parse(text);

        if (!importData.sessions || !Array.isArray(importData.sessions)) {
          alert('Invalid import file: missing sessions array.');
          return;
        }

        startTransition(async () => {
          const newSessions = await importDbSessions(importData);
          const clientSessions = newSessions.map(toClientSession);

          setSessions((prev) => [...clientSessions, ...prev]);
          if (clientSessions.length > 0) {
            const first = clientSessions[0];
            setActiveSessionId(first.id);
            setContent(first.content);
            setMessages(first.messages);
            setContext(first.context);
            setOnboarded(true);
          }
        });
      } catch (error) {
        console.error('Error importing data:', error);
        alert('Failed to import data. Please check the file format.');
      }
    };
    input.click();
  };

  // Onboarding conversation: gather Topic + Context, then reveal the matrix.
  const handleOnboardingMessage = async (text: string) => {
    const priorMessages = messages;
    const newMessage: Message = {
      id: Date.now().toString(),
      text,
      sender: 'user',
      timestamp: Date.now(),
    };
    setMessages((prev) => [...prev, newMessage]);
    setIsLoading(true);

    try {
      await ensureSession();
      const formattedGACIOD = formatForAI({
        goals: content.goals,
        assumptions: content.assumptions,
        constraints: content.constraints,
        ideas: content.ideas,
        opinions: content.opinions,
        decisions: content.decisions,
      });
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [...priorMessages, newMessage],
          phase: 'onboarding',
          step: onboardStep,
          background: pendingContext ?? context,
          formattedGACIOD,
        }),
      });
      if (!response.ok) throw new Error('Failed to get response from Gazelle');
      const data = await response.json();
      if (data.error) throw new Error(data.error);

      const mods: Modification[] | undefined =
        Array.isArray(data.modifications) && data.modifications.length > 0
          ? data.modifications
          : undefined;

      // Attach the topic card only when this is a NEW/changed suggestion, so each
      // distinct proposal (incl. rejected ones) stays in the conversation history.
      const newTopic =
        typeof data.topic === 'string' && data.topic.trim() ? data.topic.trim() : null;
      // Only surface a topic card while we're still choosing the topic. Once the
      // user has accepted (step advances past "topic"), don't re-show it.
      const isNewSuggestion =
        data.step === 'topic' && !!newTopic && newTopic !== (pendingTopic ?? '');

      const assistantMessage: Message = {
        id: `${Date.now()}-assistant`,
        text: data.message || 'Tell me a bit about what you want to build.',
        sender: 'assistant',
        timestamp: Date.now(),
        modifications: mods,
        topicSuggestion: isNewSuggestion ? newTopic : undefined,
      };
      setMessages((prev) => [...prev, assistantMessage]);

      if (typeof data.step === 'string') setOnboardStep(data.step as OnboardStep);
      // Lock the topic once accepted — only update while still choosing it.
      if (newTopic && data.step === 'topic') {
        setPendingTopic(newTopic);
      }
      if (typeof data.background === 'string' && data.background.trim()) {
        setPendingContext(data.background.trim());
        setContext(data.background.trim());
      }
    } catch (error: unknown) {
      const errorMessage: Message = {
        id: `${Date.now()}-error`,
        text: 'Sorry, I ran into a problem. Please try again.',
        sender: 'system',
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, errorMessage]);
      console.error('Onboarding error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Reveal the matrix workspace, applying the suggested Topic + Context and
  // welcoming the user into GACIOD with a short "here's what you can do" message.
  const openWorkspace = () => {
    const topic = (pendingTopic ?? content.title ?? '').trim();
    const ctx = pendingContext ?? context;
    const nextContent = { ...content, title: topic || content.title };
    const intro: Message = {
      id: `${Date.now()}-intro`,
      text:
        "Your workspace is open. The GACIOD matrix gives you six cards to structure your thinking — Goals, Assumptions, Constraints, Ideas, Opinions, and Decisions. Fill them in yourself, or ask me anytime to populate a section, review your framework, find gaps, or suggest improvements.",
      sender: 'assistant',
      timestamp: Date.now(),
    };
    const nextMessages = [...messages, intro];
    setMessages(nextMessages);
    setContent(nextContent);
    setContext(ctx);
    setOnboarded(true);
    setOnboardStep('done');
    startTransition(async () => {
      const id = await ensureSession();
      await updateDbSession(id, {
        content: nextContent as unknown as Record<string, string>,
        context: ctx,
        onboarded: true,
        messages: nextMessages as unknown[],
      });
      setSessions((prev) =>
        prev.map((s) =>
          s.id === id
            ? { ...s, content: nextContent, context: ctx, onboarded: true, messages: nextMessages }
            : s,
        ),
      );
    });
  };

  // Always call the latest openWorkspace from the auto-open timer (avoids stale closure).
  const openWorkspaceRef = useRef(openWorkspace);
  openWorkspaceRef.current = openWorkspace;

  // When onboarding reaches "done", count down from 3s and auto-open the workspace.
  useEffect(() => {
    if (onboarded || onboardStep !== 'done') {
      setOpenCountdown(null);
      return;
    }
    setOpenCountdown(3);
    const interval = setInterval(() => {
      setOpenCountdown((c) => (c === null ? null : Math.max(0, c - 1)));
    }, 1000);
    const timer = setTimeout(() => {
      openWorkspaceRef.current();
    }, 3000);
    return () => {
      clearInterval(interval);
      clearTimeout(timer);
    };
  }, [onboarded, onboardStep]);

  // Skip onboarding straight to the workspace (advanced users).
  const skipToWorkspace = () => {
    setOnboarded(true);
    setOnboardStep('done');
    startTransition(async () => {
      const id = await ensureSession();
      await updateDbSession(id, { onboarded: true, messages: messages as unknown[] });
      setSessions((prev) =>
        prev.map((s) => (s.id === id ? { ...s, onboarded: true } : s)),
      );
    });
  };

  const handleSendMessage = async (text: string) => {
    if (!onboarded) {
      await handleOnboardingMessage(text);
      return;
    }
    const newMessage: Message = {
      id: Date.now().toString(),
      text,
      sender: 'user',
      timestamp: Date.now(),
    };
    setMessages((prev) => [...prev, newMessage]);
    setIsLoading(true);

    try {
      const formattedGACIOD = formatForAI({
        goals: content.goals,
        assumptions: content.assumptions,
        constraints: content.constraints,
        ideas: content.ideas,
        opinions: content.opinions,
        decisions: content.decisions,
      });

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [...messages, newMessage],
          gacIODContext: content,
          formattedGACIOD,
          additionalContext: context,
        }),
      });

      if (!response.ok) throw new Error('Failed to get response from ChatGPT');

      const data = await response.json();
      if (data.error) throw new Error(data.error);

      // Auto-apply ADD modifications when sparse, marking them as accepted
      let allModifications: Modification[] | undefined =
        data.modifications?.length > 0 ? [...data.modifications] : undefined;
      if (allModifications) {
        const gaciodCategories: (keyof GACIODContent)[] = [
          'goals',
          'assumptions',
          'constraints',
          'ideas',
          'opinions',
          'decisions',
        ];
        const totalItems = gaciodCategories.reduce(
          (sum, cat) => sum + parseItems(content[cat]).length,
          0,
        );
        const isSparse = totalItems <= 3;
        const updatedContent = { ...content };
        let didAutoApply = false;
        const autoAppliedSet = new Set<number>();

        // Auto-apply title ADD if title is blank
        allModifications.forEach((m: Modification, idx: number) => {
          if (
            m.category === 'title' &&
            m.operation === 'ADD' &&
            m.newText &&
            !content.title.trim() &&
            !didAutoApply // only first title mod
          ) {
            updatedContent.title = m.newText!;
            didAutoApply = true;
            autoAppliedSet.add(idx);
          }
        });

        if (isSparse) {
          allModifications.forEach((m: Modification, idx: number) => {
            if (
              m.operation === 'ADD' &&
              m.newText &&
              m.category !== 'title' &&
              !autoAppliedSet.has(idx)
            ) {
              const category = m.category as keyof GACIODContent;
              const existingItems = parseItems(updatedContent[category]);
              updatedContent[category] = [
                ...existingItems,
                m.newText,
              ].join('\n');
              didAutoApply = true;
              autoAppliedSet.add(idx);
            }
          });
        }

        if (didAutoApply) setContent(updatedContent);

        // Mark auto-applied modifications with status: 'accepted'
        allModifications = allModifications.map((m: Modification, idx: number) =>
          autoAppliedSet.has(idx) ? { ...m, status: 'accepted' as const } : m,
        );
      }

      let displayText = data.message || '';
      const hasFeedback = data.feedback && data.feedback.length > 0;
      if (hasFeedback) {
        const feedbackText = data.feedback
          .map((item: any) => {
            const typeLabel = item.type
              ? item.type.charAt(0).toUpperCase() + item.type.slice(1)
              : 'Feedback';
            let text = `[${typeLabel}]\n`;
            if (item.quote) text += `> "${item.quote}"\n`;
            text += item.message || '';
            return text;
          })
          .join('\n\n');

        displayText = data.summary
          ? feedbackText + `\n\n---\n\n**Summary**\n${data.summary}`
          : feedbackText;
      }

      const improvements =
        data.improvements?.length > 0 ? data.improvements : undefined;

      const assistantMessage: Message = {
        id: `${Date.now()}-assistant`,
        text: displayText || 'No response received',
        sender: 'assistant',
        timestamp: Date.now(),
        isStructured: hasFeedback,
        improvements,
        modifications: allModifications && allModifications.length > 0 ? allModifications : undefined,
      };
      setMessages((prev) => [...prev, assistantMessage]);
    } catch (error: any) {
      let errorText =
        'Sorry, I encountered an error. Please make sure your OpenAI API key is set in the environment variables.';
      if (
        error?.message?.includes('429') ||
        error?.message?.includes('quota') ||
        error?.message?.includes('rate')
      ) {
        errorText =
          'API rate limit exceeded. Please wait a moment and try again.';
      } else if (
        error?.message?.includes('401') ||
        error?.message?.includes('API key')
      ) {
        errorText =
          'Invalid API key. Please check your OpenAI API key in the environment variables.';
      }
      const errorMessage: Message = {
        id: `${Date.now()}-error`,
        text: errorText,
        sender: 'system',
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const highlightedIndices = useMemo(() => {
    const highlights: Record<string, Set<number>> = {
      goals: new Set(),
      assumptions: new Set(),
      constraints: new Set(),
      ideas: new Set(),
      opinions: new Set(),
      decisions: new Set(),
    };

    for (const msg of messages) {
      if (msg.improvements) {
        for (const imp of msg.improvements) {
          if (imp.status && imp.status !== 'pending') continue;
          const category = imp.category.toLowerCase();
          if (
            category in highlights &&
            content[category as keyof GACIODContent]
          ) {
            const items = parseItems(
              content[category as keyof GACIODContent],
            );
            const originalTextClean = stripLabel(imp.originalText);
            for (let i = 0; i < items.length; i++) {
              if (
                items[i] === originalTextClean ||
                items[i].trim() === originalTextClean.trim() ||
                items[i].includes(originalTextClean) ||
                originalTextClean.includes(items[i])
              ) {
                highlights[category].add(i);
              }
            }
          }
        }
      }
      if (msg.modifications) {
        for (const mod of msg.modifications) {
          if (mod.status && mod.status !== 'pending') continue;
          const category = mod.category;
          if (category in highlights) {
            if (mod.label) {
              const resolved = resolveLabelToIndex(mod.label);
              if (resolved && resolved.category === category) {
                highlights[category].add(resolved.index);
              }
            }
          }
        }
      }
    }

    const result: Record<string, number[]> = {};
    for (const [key, set] of Object.entries(highlights)) {
      result[key] = Array.from(set);
    }
    return result;
  }, [messages, content]);

  return (
    <div className="h-screen bg-[#E8EDF2] flex flex-row overflow-hidden">
      <ChatSidebar
        sessions={sessions}
        activeSessionId={activeSessionId}
        onNewChat={handleNewChat}
        onSelectSession={handleSelectSession}
        onDeleteSession={handleDeleteSession}
        isOpen={chatSidebarOpen}
        onToggle={() => setChatSidebarOpen(!chatSidebarOpen)}
        onOpenSettings={() => setShowDebugMenu(!showDebugMenu)}
      />

      {!onboarded ? (
        <div className="flex-1 min-w-0 overflow-y-auto px-4 py-6">
          <div className="min-h-full flex flex-col items-center justify-center">
          <div className="w-full max-w-2xl flex flex-col gap-3 sm:gap-4">
            {/* Header */}
            <div className="bg-white rounded-2xl shadow-[0_1px_3px_rgba(0,0,0,0.05)] px-6 py-5 shrink-0">
              <h1 className="text-lg sm:text-2xl font-medium text-gray-900 whitespace-nowrap">
            the <span className="font-display font-normal align-baseline text-gray-900">gazelle</span> workspace
              </h1>
            </div>

            {/* Chat (messages + input in one frame) */}
            <div className="bg-white rounded-2xl shadow-[0_1px_3px_rgba(0,0,0,0.05)] flex flex-col overflow-hidden">
              <div className="p-4 pb-3.5 shrink-0 flex items-start gap-2.5 border-b-[3.5px] border-gray-100">
                <IconMessages className="w-6 h-6 mt-0.5 shrink-0 text-gray-700" stroke={2} />
                <div>
                  <h3 className="font-display text-xl leading-tight tracking-tight text-gray-900">Chat</h3>
                </div>
              </div>
              <div className="h-[clamp(320px,56vh,600px)] min-h-0">
                <Chat
                  messages={messages}
                  onSendMessage={handleSendMessage}
                  inputValue={inputValue}
                  setInputValue={setInputValue}
                  isLoading={isLoading}
                  onAcceptModification={handleAcceptModification}
                  onDenyModification={handleDenyModification}
                  showActionsInline={false}
                  showInput={true}
                  inputPlaceholder="Reply to Gazelle..."
                />
              </div>
            </div>

            {/* Transition row */}
            <div className="flex items-center justify-between gap-3 px-1 shrink-0">
              <button
                onClick={skipToWorkspace}
                className="text-xs font-medium text-gray-400 hover:text-gray-600 transition-colors"
              >
                Skip to workspace →
              </button>
              {onboardStep === 'done' && (
                <div className="flex items-center gap-3">
                  {openCountdown !== null && (
                    <span className="text-xs font-medium text-gray-400">
                      Opening in {openCountdown}s…
                    </span>
                  )}
                  <button
                    onClick={openWorkspace}
                    className="bg-gray-900 text-white rounded-xl px-5 py-2.5 text-sm font-semibold hover:bg-gray-800 transition-colors"
                  >
                    Open workspace →
                  </button>
                </div>
              )}
            </div>
          </div>
          </div>
        </div>
      ) : (
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Header */}
        <header className="flex items-center justify-between gap-3 px-4 sm:px-6 h-14 shrink-0">
          <h1 className="text-lg sm:text-2xl font-medium text-gray-900 whitespace-nowrap">
            the <span className="font-display font-normal align-baseline text-gray-900">gazelle</span> workspace
          </h1>
          <button
            onClick={handleShare}
            title="Share — export this matrix as a JSON file"
            className="bg-white rounded-xl shadow-[0_1px_3px_rgba(0,0,0,0.05)] px-3.5 py-2 flex items-center gap-1.5 text-gray-700 hover:bg-gray-50 transition-colors"
          >
            <IconShare3 className="w-4 h-4" stroke={1.75} />
            <span className="text-sm font-medium hidden sm:inline">Share</span>
          </button>
          {/* <div className="flex items-center gap-2">
            <button
              onClick={handleExportData}
              className="bg-white rounded-xl shadow-[0_1px_3px_rgba(0,0,0,0.05)] px-3 py-2 flex items-center gap-1.5 text-gray-600 hover:bg-gray-50 transition-colors"
              title="Export all chat data as JSON"
            >
              <IconDownload className="w-4 h-4" stroke={1.5} />
              <span className="text-xs sm:text-sm font-medium hidden sm:inline">Export</span>
            </button>
            <button
              onClick={handleImportData}
              disabled={isPending}
              className="bg-white rounded-xl shadow-[0_1px_3px_rgba(0,0,0,0.05)] px-3 py-2 flex items-center gap-1.5 text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-50"
              title="Import chat data from JSON"
            >
              <IconUpload className="w-4 h-4" stroke={1.5} />
              <span className="text-xs sm:text-sm font-medium hidden sm:inline">Import</span>
            </button>
          </div> */}
        </header>

        {/* Columns */}
        <div
          ref={columnsRef}
          className="flex-1 flex flex-row min-h-0 overflow-hidden px-3 sm:px-4 lg:px-6 pb-3 sm:pb-4 lg:pb-6"
        >
          {/* Left column - Topic + Chat + Ask + Quick Actions */}
          <div
            style={{ width: leftWidth }}
            className="flex flex-col gap-2.5 min-h-0 overflow-hidden shrink-0"
          >
            {/* Topic */}
            <div className="bg-white rounded-xl shadow-[0_1px_3px_rgba(0,0,0,0.05)] shrink-0 flex flex-col overflow-hidden">
              <div className="p-4 pb-3.5 shrink-0 flex items-start gap-2.5 border-b-[3.5px] border-gray-100">
                <IconNotes className="w-6 h-6 mt-0.5 shrink-0 text-gray-700" stroke={2} />
                <h3 className="font-display text-xl leading-tight tracking-tight text-gray-900 flex-1 mt-0.5">Topic</h3>                
              </div>
              <div className="p-4 pt-3">
                <AutoTextarea
                  ref={topicRef}
                  value={content.title}
                  onChange={(v) => setContent({ ...content, title: v })}
                  onKeyDown={(e) => { if (e.key === 'Enter') e.preventDefault(); }}
                  placeholder="Question (e.g. What mechanics matter for a matchmaking algorithm?)"
                  className="w-full overflow-hidden text-sm font-normal text-gray-800 leading-snug bg-gray-50 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-gray-300 placeholder:text-gray-400"
                />
              </div>
            </div>

            {/* Chat (messages + input in one frame) */}
            <div className="bg-white rounded-xl shadow-[0_1px_3px_rgba(0,0,0,0.05)] flex-1 flex flex-col min-h-0 overflow-hidden">
              <div className="p-4 pb-3.5 shrink-0 flex items-start gap-2.5 border-b-[3.5px] border-gray-100">
                <IconMessages className="w-6 h-6 mt-0.5 shrink-0 text-gray-700" stroke={2} />
                <div>
                  <h3 className="font-display text-xl leading-tight tracking-tight text-gray-900">Chat</h3>
                </div>
              </div>
              <div className="flex-1 min-h-0 overflow-hidden">
                <Chat
                  messages={messages}
                  onSendMessage={handleSendMessage}
                  inputValue={inputValue}
                  setInputValue={setInputValue}
                  isLoading={isLoading}
                  onAcceptImprovement={handleAcceptImprovement}
                  onDenyImprovement={handleDenyImprovement}
                  onAcceptModification={handleAcceptModification}
                  onDenyModification={handleDenyModification}
                  showActionsInline={false}
                  showInput={true}
                  inputPlaceholder="Chat here..."
                  aboveInput={(
                    <div className="flex flex-wrap gap-1.5 mb-4 justify-between">
                      <button
                        onClick={() => handleSendMessage('Review my GACIOD framework')}
                        disabled={isLoading}
                        title="Review"
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#1F2937] text-white text-sm font-medium hover:bg-[#F3F4F6] hover:text-black transition-colors disabled:opacity-50 shadow-[0_1px_2px_rgba(0,0,0,0.06)]"
                      >
                        <IconChecklist className="w-3.5 h-3.5" stroke={1.75} />
                        Review
                      </button>
                      <button
                        onClick={() => handleSendMessage('Critique my GACIOD framework')}
                        disabled={isLoading}
                        title="Critique — Gazelle hunts for gaps, conflicts, and unclear or missing items across your framework."
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#1F2937] text-white text-sm font-medium hover:bg-[#F3F4F6] hover:text-black transition-colors disabled:opacity-50 shadow-[0_1px_2px_rgba(0,0,0,0.06)]"
                      >
                        <IconZoomQuestion className="w-3.5 h-3.5" stroke={1.75} />
                        Critique
                      </button>
                      <button
                        onClick={() => handleSendMessage('Suggest improvements for my GACIOD framework')}
                        disabled={isLoading}
                        title="Suggest — Gazelle proposes concrete edits to strengthen existing items, which you can accept or deny."
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#1F2937] text-white text-sm font-medium hover:bg-[#F3F4F6] hover:text-black transition-colors disabled:opacity-50 shadow-[0_1px_2px_rgba(0,0,0,0.06)]"
                      >
                        <IconSparkles className="w-3.5 h-3.5" stroke={1.75} />
                        Suggest
                      </button>
                    </div>
                  )}
                />
              </div>
            </div>
          </div>

          {/* Resize handle */}
          <div
            onMouseDown={startResize}
            onDoubleClick={() => setLeftWidth(LEFT_WIDTH_DEFAULT)}
            className="w-1.5 mx-1.5 shrink-0 cursor-col-resize rounded-full bg-transparent hover:bg-gray-300 transition-colors"
            role="separator"
            aria-orientation="vertical"
            title="Drag to resize (double-click to reset)"
          />

          {/* Right canvas - GACIOD grid */}
          <div className="flex-1 grid grid-cols-2 grid-rows-3 gap-3 sm:gap-4 min-h-0 min-w-0 overflow-hidden">
            {CARDS.map((c) => (
              <GACIODCard
                key={c.key}
                title={c.title}
                prefix={c.prefix}
                color={c.color}
                icon={c.icon}
                subtitle={c.subtitle}
                singular={c.singular}
                plural={c.plural}
                content={content[c.key]}
                archivedContent={content[ARCHIVED_KEY[c.key]] as string}
                onUpdate={(value) => updateContent(c.key, value)}
                onArchive={(index) => moveItem(c.key, index, 'archive')}
                onUnarchive={(index) => moveItem(c.key, index, 'unarchive')}
                highlightedIndices={highlightedIndices[c.key]}
              />
            ))}
          </div>
        </div>
      </div>
      )}
    </div>
  );
}
