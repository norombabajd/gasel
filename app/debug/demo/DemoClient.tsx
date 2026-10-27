'use client';

import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import Link from 'next/link';
import Chat, { Message, Modification, ModificationOperation } from '@/components/Chat';
import ChatSidebar from '@/components/ChatSidebar';
import GACIODCard from '@/components/GACIODCard';
import AutoTextarea from '@/components/AutoTextarea';
import type { ChatSession, GACIODContent } from '@/lib/chatStorage';
import {
  IconTarget,
  IconHelpCircle,
  IconLock,
  IconBulb,
  IconMessageCircle,
  IconFlagCheck,
  IconZoomQuestion,
  IconSparkles,
  IconMessages,
  IconNotes,
  IconWand,
  IconX,
  IconTrash,
  IconPencil,
  IconPlus,
  IconArrowLeft,
  IconArrowBackUp,
  IconChevronUp,
  IconChevronDown,
  IconRefresh,
  IconShare3,
  IconPlayerTrackNext,
  type TablerIcon,
} from '@tabler/icons-react';

// ---------------------------------------------------------------------------
// Types & storage
// ---------------------------------------------------------------------------

/** When a scripted reply plays: on the next chat message, or on a quick action. */
type ReplyTrigger = 'any' | 'critique' | 'suggest';

/** A scripted assistant reply staged by the presenter. */
interface QueuedReply {
  id: string;
  text: string;
  trigger: ReplyTrigger;
  modifications?: Modification[];
  topicSuggestion?: string;
  /** The user line the presenter should type right before this reply plays. */
  cue?: string;
}

// Loosely-typed shape returned by /api/demo-script — normalized before use.
interface GeneratedModification {
  operation?: string;
  category?: string;
  label?: string;
  currentText?: string;
  newText?: string;
  explanation?: string;
}

interface GeneratedScript {
  topic?: string;
  matrix?: Partial<Record<string, string[]>>;
  messages?: { sender?: string; text?: string }[];
  queuedReplies?: { trigger?: string; cue?: string; text?: string; modifications?: GeneratedModification[] }[];
}

interface DemoSession extends ChatSession {
  queuedReplies: QueuedReply[];
  /** false = the session shows the chat-first onboarding layout. */
  onboarded: boolean;
}

const STORAGE_KEY = 'gasel-demo-sessions';
const ACTIVE_KEY = 'gasel-demo-active';
const LEFT_WIDTH_KEY = 'gasel-demo-left-width';
const THINKING_DELAY_MS = 1600;

// Same column bounds as the real workspace (see HomeClient).
const LEFT_WIDTH_DEFAULT = 440;
const LEFT_WIDTH_MIN = 340;
const LEFT_WIDTH_MAX = 720;

const TRIGGER_LABELS: Record<ReplyTrigger, string> = {
  any: 'Next message',
  critique: 'Critique click',
  suggest: 'Suggest click',
};

function uid(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function emptyContent(): GACIODContent {
  return { title: '', goals: '', assumptions: '', constraints: '', ideas: '', opinions: '', decisions: '' };
}

/** New demo chats start in onboarding, exactly like the real app. */
function newDemoSession(): DemoSession {
  return {
    id: uid(),
    title: 'New Demo Chat',
    messages: [
      {
        id: uid(),
        text: "Hi — I'm Gazelle. Let's turn an idea into a plan. What are you working on?",
        sender: 'assistant',
        timestamp: Date.now(),
      },
    ],
    content: emptyContent(),
    context: '',
    queuedReplies: [],
    onboarded: false,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

/** A pre-built example so the Wizard-of-Oz flow is demoable immediately. */
function seedSession(): DemoSession {
  const session = newDemoSession();
  session.onboarded = true;
  session.content = {
    title: 'What mechanics matter for a fair matchmaking algorithm?',
    goals: 'Fair matchmaking for all players\nKeep queue times under 60 seconds',
    assumptions: 'Players prefer competitive matches\nSkill can be measured numerically',
    constraints: 'Server infrastructure limits\nAnti-cheat requirements',
    ideas: '',
    opinions: '',
    decisions: '',
  };
  session.messages = [
    {
      id: uid(),
      text: "Hi! I'm Gazelle. I've set up your matrix for the matchmaking project — ask me anything, or use the quick actions below.",
      sender: 'assistant',
      timestamp: Date.now(),
    },
  ];
  session.queuedReplies = [
    {
      id: uid(),
      trigger: 'any',
      text: "Good thinking. Fairness usually comes down to two levers: how you measure skill, and how long you're willing to wait for a close match. Want me to take a critical pass over your matrix?",
    },
    {
      id: uid(),
      trigger: 'critique',
      text: [
        '[Strength]\n> "Keep queue times under 60 seconds"\nThis is a clear, measurable constraint that will anchor your design.',
        '[Conflict]\nG-01: Fair matchmaking for all players\nG-02: Keep queue times under 60 seconds\nStrict fairness and fast queues pull against each other — which one wins under load?',
        '[Missing]\nThere is no decision yet about what happens when no fair match exists within the time limit.',
      ].join('\n\n'),
    },
    {
      id: uid(),
      trigger: 'suggest',
      text: 'Your Ideas card is empty — here are two approaches worth capturing.',
      modifications: [
        {
          operation: 'ADD',
          category: 'ideas',
          newText: 'Use Glicko-2 ratings to model skill uncertainty',
          explanation: 'Handles new players better than classic Elo.',
        },
        {
          operation: 'ADD',
          category: 'ideas',
          newText: 'Widen the skill band gradually as queue time grows',
          explanation: 'Balances fairness against your 60-second queue goal.',
        },
      ],
    },
  ];
  return session;
}

function loadDemoSessions(): DemoSession[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as DemoSession[];
    return parsed.map((s) => ({
      ...s,
      onboarded: s.onboarded ?? true,
      queuedReplies: (s.queuedReplies ?? []).map((q) => ({ ...q, trigger: q.trigger ?? 'any' })),
    }));
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// Matrix helpers (mirrors the main workspace behavior)
// ---------------------------------------------------------------------------

const CARDS: {
  key: keyof Omit<GACIODContent, 'title'>;
  title: string;
  prefix: string;
  color: 'green' | 'yellow' | 'red' | 'violet' | 'orange' | 'blue';
  icon: TablerIcon;
  subtitle: string;
  singular: string;
  plural: string;
}[] = [
  { key: 'goals', title: 'Goals', prefix: 'G', color: 'green', icon: IconTarget, subtitle: 'What are the outcomes you are designing towards?', singular: 'goal', plural: 'goals' },
  { key: 'assumptions', title: 'Assumptions', prefix: 'A', color: 'yellow', icon: IconHelpCircle, subtitle: 'What are you treating as true without full evidence?', singular: 'assumption', plural: 'assumptions' },
  { key: 'constraints', title: 'Constraints', prefix: 'C', color: 'red', icon: IconLock, subtitle: 'What limits our solution space?', singular: 'constraint', plural: 'constraints' },
  { key: 'ideas', title: 'Ideas', prefix: 'I', color: 'violet', icon: IconBulb, subtitle: 'What approaches are worth exploring?', singular: 'idea', plural: 'ideas' },
  { key: 'opinions', title: 'Opinions', prefix: 'O', color: 'orange', icon: IconMessageCircle, subtitle: "What do we think, but can't prove?", singular: 'opinion', plural: 'opinions' },
  { key: 'decisions', title: 'Decision + Rationale', prefix: 'D', color: 'blue', icon: IconFlagCheck, subtitle: 'What have we committed to and why?', singular: 'decision', plural: 'decisions' },
];

const MOD_CATEGORIES: Modification['category'][] = [
  'title', 'goals', 'assumptions', 'constraints', 'ideas', 'opinions', 'decisions',
];

function stripLabel(text: string): string {
  return text.replace(/^[GACIOD]-\d{2}:\s*/, '').trim();
}

function parseItems(contentStr: string): string[] {
  if (!contentStr.trim()) return [];
  return contentStr.split('\n').filter((line) => line.trim() !== '').map(stripLabel);
}

function applyModificationToContent(content: GACIODContent, modification: Modification): GACIODContent {
  const newText = modification.newText ? stripLabel(modification.newText) : '';

  if (modification.category === 'title') {
    switch (modification.operation) {
      case 'ADD':
      case 'UPDATE':
        return newText ? { ...content, title: newText } : content;
      case 'DELETE':
        return { ...content, title: '' };
    }
  }

  const category = modification.category as keyof Omit<GACIODContent, 'title'>;
  const items = parseItems(content[category]);
  let newItems: string[] | null = null;

  switch (modification.operation) {
    case 'ADD':
      if (newText) newItems = [...items, newText];
      break;
    case 'UPDATE':
      if (modification.label && newText) {
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
    return { ...content, [category]: newItems.join('\n') };
  }
  return content;
}

/** Feedback-tag detection — replies written in the structured format render as cards. */
const FEEDBACK_TAG_RE = /\[(Suggestion|Concern|Strength|Question|Consideration|Missing|Conflict|Unclear|Incomplete)\]/;

function isStructuredText(text: string): boolean {
  return FEEDBACK_TAG_RE.test(text);
}

/** Keep only well-formed modifications from a generated script. */
function normalizeGeneratedMods(mods?: GeneratedModification[]): Modification[] {
  const validOps = ['ADD', 'UPDATE', 'DELETE'];
  return (mods ?? [])
    .filter(
      (m) =>
        !!m &&
        validOps.includes(m.operation ?? '') &&
        (MOD_CATEGORIES as string[]).includes(m.category ?? '') &&
        (m.operation === 'DELETE' || (m.newText ?? '').trim() !== ''),
    )
    .map((m) => ({
      operation: m.operation as ModificationOperation,
      category: m.category as Modification['category'],
      label: m.label?.trim() || undefined,
      currentText: m.currentText?.trim() || undefined,
      newText: m.operation === 'DELETE' ? undefined : m.newText!.trim(),
      explanation: (m.explanation ?? '').trim() || 'Suggested for this demo.',
    }));
}

// Lightweight confetti burst, same look as the real Share (see HomeClient).
function fireConfetti() {
  if (typeof document === 'undefined') return;
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;

  const colors = ['#22C55E', '#E8B84B', '#E07070', '#AB6FD4', '#E8834A', '#4A8FD4'];
  const container = document.createElement('div');
  container.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:9999;overflow:hidden;';
  document.body.appendChild(container);

  for (let i = 0; i < 130; i++) {
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
    const anim = piece.animate(
      [
        { transform: 'translate(0, 0) rotate(0deg)', opacity: 1 },
        { transform: `translate(${xDrift}px, 105vh) rotate(${rotate}deg)`, opacity: 1, offset: 0.85 },
        { transform: `translate(${xDrift}px, 110vh) rotate(${rotate}deg)`, opacity: 0 },
      ],
      { duration: 2200 + Math.random() * 1600, delay: Math.random() * 350, easing: 'cubic-bezier(0.2, 0.6, 0.4, 1)', fill: 'forwards' },
    );
    anim.onfinish = () => piece.remove();
  }

  setTimeout(() => container.remove(), 5000);
}

// ---------------------------------------------------------------------------
// Demo client
// ---------------------------------------------------------------------------

export default function DemoClient() {
  // This component is loaded with ssr:false, so localStorage is safe to read
  // in lazy state initializers.
  const [sessions, setSessions] = useState<DemoSession[]>(() => {
    const loaded = loadDemoSessions();
    return loaded.length > 0 ? loaded : [seedSession()];
  });
  const [activeId, setActiveId] = useState<string>(
    () => localStorage.getItem(ACTIVE_KEY) ?? '',
  );
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [builderOpen, setBuilderOpen] = useState(false);
  const [shareMenuOpen, setShareMenuOpen] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const replyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [leftWidth, setLeftWidth] = useState<number>(() => {
    const saved = Number(localStorage.getItem(LEFT_WIDTH_KEY));
    return saved >= LEFT_WIDTH_MIN && saved <= LEFT_WIDTH_MAX ? saved : LEFT_WIDTH_DEFAULT;
  });
  const columnsRef = useRef<HTMLDivElement>(null);
  const isResizing = useRef(false);

  useEffect(() => {
    localStorage.setItem(LEFT_WIDTH_KEY, String(leftWidth));
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

  // The persisted active id may not match a session (e.g. first visit) — fall
  // back to the first session.
  const effectiveActiveId = sessions.some((s) => s.id === activeId)
    ? activeId
    : sessions[0]?.id ?? '';

  // Persist on change.
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
    localStorage.setItem(ACTIVE_KEY, effectiveActiveId);
  }, [sessions, effectiveActiveId]);

  useEffect(() => () => {
    if (replyTimer.current) clearTimeout(replyTimer.current);
  }, []);

  const activeSession = useMemo(
    () => sessions.find((s) => s.id === effectiveActiveId),
    [sessions, effectiveActiveId],
  );

  const updateSession = useCallback((id: string, updater: (s: DemoSession) => DemoSession) => {
    setSessions((prev) => prev.map((s) => (s.id === id ? { ...updater(s), updatedAt: Date.now() } : s)));
  }, []);

  const updateActive = useCallback(
    (updater: (s: DemoSession) => DemoSession) => updateSession(effectiveActiveId, updater),
    [effectiveActiveId, updateSession],
  );

  // --- Session management -------------------------------------------------

  const handleNewChat = () => {
    const session = newDemoSession();
    setSessions((prev) => [session, ...prev]);
    setActiveId(session.id);
    setSidebarOpen(false);
  };

  const handleSelectSession = (id: string) => {
    setActiveId(id);
    setSidebarOpen(false);
  };

  const handleDeleteSession = (id: string) => {
    setSessions((prev) => {
      const remaining = prev.filter((s) => s.id !== id);
      if (remaining.length === 0) {
        const fresh = newDemoSession();
        setActiveId(fresh.id);
        return [fresh];
      }
      if (id === effectiveActiveId) setActiveId(remaining[0].id);
      return remaining;
    });
  };

  // --- Wizard-of-Oz chat flow ----------------------------------------------

  const appendMessage = useCallback((sessionId: string, message: Message) => {
    updateSession(sessionId, (s) => ({ ...s, messages: [...s.messages, message] }));
  }, [updateSession]);

  /**
   * Append the user message, then play the matching scripted reply: quick
   * actions prefer replies staged for their trigger, then fall back to the
   * next "any" reply.
   */
  const handleSend = (text: string, source: ReplyTrigger = 'any') => {
    const sessionId = effectiveActiveId;
    appendMessage(sessionId, { id: uid(), text, sender: 'user', timestamp: Date.now() });

    const session = sessions.find((s) => s.id === sessionId);
    if (!session) return;
    let reply = source !== 'any'
      ? session.queuedReplies.find((q) => q.trigger === source)
      : undefined;
    reply = reply ?? session.queuedReplies.find((q) => q.trigger === 'any');
    if (!reply) return;

    const replyId = reply.id;
    const played = reply;
    setIsLoading(true);
    replyTimer.current = setTimeout(() => {
      updateSession(sessionId, (s) => ({
        ...s,
        queuedReplies: s.queuedReplies.filter((q) => q.id !== replyId),
        messages: [
          ...s.messages,
          {
            id: uid(),
            text: played.text,
            sender: 'assistant',
            timestamp: Date.now(),
            isStructured: isStructuredText(played.text) || undefined,
            modifications: played.modifications?.length ? played.modifications : undefined,
            topicSuggestion: played.topicSuggestion,
          },
        ],
      }));
      setIsLoading(false);
    }, THINKING_DELAY_MS);
  };

  // --- Onboarding transitions ----------------------------------------------

  const openWorkspace = () => {
    updateActive((s) => ({
      ...s,
      onboarded: true,
      messages: [
        ...s.messages,
        {
          id: uid(),
          text: 'Your workspace is open. The GACIOD matrix gives you six cards to structure your thinking — Goals, Assumptions, Constraints, Ideas, Opinions, and Decisions. Fill them in yourself, or ask me anytime to populate a section, critique your matrix, find gaps, or suggest improvements.',
          sender: 'assistant',
          timestamp: Date.now(),
        },
      ],
    }));
  };

  const skipToWorkspace = () => {
    updateActive((s) => ({ ...s, onboarded: true }));
  };

  const backToOnboarding = () => {
    updateActive((s) => ({ ...s, onboarded: false }));
    setShareMenuOpen(false);
  };

  // --- Presenter (share menu) actions ---------------------------------------

  const shareWorkspace = () => {
    appendMessage(effectiveActiveId, {
      id: uid(),
      text: 'Workspace shared.',
      sender: 'system',
      timestamp: Date.now(),
    });
    fireConfetti();
    setShareMenuOpen(false);
  };

  const resetDemo = () => {
    if (!window.confirm('Reset all demo chats? This deletes every staged conversation.')) return;
    if (replyTimer.current) clearTimeout(replyTimer.current);
    setIsLoading(false);
    const fresh = seedSession();
    setSessions([fresh]);
    setActiveId(fresh.id);
    setShareMenuOpen(false);
    setBuilderOpen(false);
  };

  // --- Modification card actions (work against the demo matrix) ------------

  const handleAcceptModification = (modification: Modification) => {
    updateActive((s) => ({
      ...s,
      content: applyModificationToContent(s.content, modification),
      messages: s.messages.map((msg) => {
        if (!msg.modifications) return msg;
        let found = false;
        return {
          ...msg,
          modifications: msg.modifications.map((mod) => {
            if (found) return mod;
            const isMatch =
              mod.operation === modification.operation &&
              mod.category === modification.category &&
              mod.newText === modification.newText &&
              mod.label === modification.label;
            if (isMatch && (mod.status ?? 'pending') === 'pending') {
              found = true;
              return { ...mod, status: 'accepted' as const };
            }
            return mod;
          }),
        };
      }),
    }));
  };

  const setModificationStatus = (
    messageId: string,
    index: number,
    patch: Partial<Modification>,
  ) => {
    updateActive((s) => ({
      ...s,
      messages: s.messages.map((msg) =>
        msg.id === messageId && msg.modifications
          ? {
              ...msg,
              modifications: msg.modifications.map((mod, idx) =>
                idx === index ? { ...mod, ...patch } : mod,
              ),
            }
          : msg,
      ),
    }));
  };

  const handleDenyModification = (messageId: string, index: number) => {
    setModificationStatus(messageId, index, { status: 'denied' });
  };

  const handleReviseModification = (messageId: string, index: number, newText: string) => {
    const mod = activeSession?.messages.find((m) => m.id === messageId)?.modifications?.[index];
    if (!mod || !newText.trim()) return;
    updateActive((s) => ({
      ...s,
      content: applyModificationToContent(s.content, { ...mod, newText }),
    }));
    setModificationStatus(messageId, index, { newText, status: 'accepted' });
  };

  // --- Builder actions ------------------------------------------------------

  const handleBuilderAddMessage = (message: Message) => {
    appendMessage(effectiveActiveId, message);
  };

  const handleQueueReply = (reply: QueuedReply) => {
    updateActive((s) => ({ ...s, queuedReplies: [...s.queuedReplies, reply] }));
  };

  const handleRemoveQueued = (id: string) => {
    updateActive((s) => ({ ...s, queuedReplies: s.queuedReplies.filter((q) => q.id !== id) }));
  };

  const handleDeleteMessage = (id: string) => {
    updateActive((s) => ({ ...s, messages: s.messages.filter((m) => m.id !== id) }));
  };

  // Swap an item with its neighbor; no-op at the list boundaries.
  const moveItem = <T extends { id: string }>(items: T[], id: string, direction: -1 | 1): T[] => {
    const idx = items.findIndex((item) => item.id === id);
    const target = idx + direction;
    if (idx === -1 || target < 0 || target >= items.length) return items;
    const next = [...items];
    [next[idx], next[target]] = [next[target], next[idx]];
    return next;
  };

  const handleMoveMessage = (id: string, direction: -1 | 1) => {
    updateActive((s) => ({ ...s, messages: moveItem(s.messages, id, direction) }));
  };

  const handleMoveQueued = (id: string, direction: -1 | 1) => {
    updateActive((s) => ({ ...s, queuedReplies: moveItem(s.queuedReplies, id, direction) }));
  };

  const handleClearChat = () => {
    updateActive((s) => ({ ...s, messages: [] }));
  };

  const handleUpdateMessage = (id: string, text: string) => {
    updateActive((s) => ({
      ...s,
      messages: s.messages.map((m) =>
        m.id === id
          ? {
              ...m,
              text,
              isStructured: (m.sender === 'assistant' && isStructuredText(text)) || undefined,
            }
          : m,
      ),
    }));
  };

  const handleUpdateQueued = (id: string, patch: { text: string; cue?: string }) => {
    updateActive((s) => ({
      ...s,
      queuedReplies: s.queuedReplies.map((q) =>
        q.id === id ? { ...q, text: patch.text, cue: patch.cue?.trim() || undefined } : q,
      ),
    }));
  };

  /** Load an AI-generated script into the active session (replaces its content). */
  const applyGeneratedScript = (script: GeneratedScript): boolean => {
    const session = sessions.find((s) => s.id === effectiveActiveId);
    const hasContent = !!session && (session.messages.length > 0 || session.queuedReplies.length > 0);
    if (hasContent && !window.confirm('Replace this chat’s current messages, queued replies, and matrix with the generated script?')) {
      return false;
    }

    // The model sometimes bakes "G-01: " label prefixes into items — strip them.
    const joinItems = (arr?: string[]) =>
      (arr ?? []).filter((x) => typeof x === 'string' && x.trim()).map((x) => stripLabel(x)).join('\n');
    const validSenders: Message['sender'][] = ['user', 'assistant', 'system'];
    const validTriggers: ReplyTrigger[] = ['any', 'critique', 'suggest'];

    updateActive((s) => ({
      ...s,
      onboarded: true,
      content: {
        title: (script.topic ?? '').trim(),
        goals: joinItems(script.matrix?.goals),
        assumptions: joinItems(script.matrix?.assumptions),
        constraints: joinItems(script.matrix?.constraints),
        ideas: joinItems(script.matrix?.ideas),
        opinions: joinItems(script.matrix?.opinions),
        decisions: joinItems(script.matrix?.decisions),
      },
      messages: (script.messages ?? [])
        .filter((m) => !!m && (m.text ?? '').trim() !== '')
        .map((m) => {
          const sender = validSenders.includes(m.sender as Message['sender'])
            ? (m.sender as Message['sender'])
            : 'assistant';
          return {
            id: uid(),
            text: m.text!.trim(),
            sender,
            timestamp: Date.now(),
            isStructured: (sender === 'assistant' && isStructuredText(m.text!)) || undefined,
          };
        }),
      queuedReplies: (script.queuedReplies ?? [])
        .filter((q) => !!q && (q.text ?? '').trim() !== '')
        .map((q) => ({
          id: uid(),
          text: q.text!.trim(),
          trigger: validTriggers.includes(q.trigger as ReplyTrigger) ? (q.trigger as ReplyTrigger) : 'any',
          cue: q.cue?.trim() || undefined,
          modifications: (() => {
            const mods = normalizeGeneratedMods(q.modifications);
            return mods.length > 0 ? mods : undefined;
          })(),
        })),
    }));
    return true;
  };

  if (!activeSession) {
    return <div className="h-screen bg-[#E8EDF2]" />;
  }

  const content = activeSession.content;

  return (
    <div className="h-screen bg-[#E8EDF2] flex flex-row overflow-hidden">
      <ChatSidebar
        sessions={sessions}
        activeSessionId={effectiveActiveId}
        onNewChat={handleNewChat}
        onSelectSession={handleSelectSession}
        onDeleteSession={handleDeleteSession}
        isOpen={sidebarOpen}
        onToggle={() => setSidebarOpen(!sidebarOpen)}
        onOpenSettings={() => {}}
      />

      {!activeSession.onboarded ? (
        /* ------------------------- Onboarding view ------------------------- */
        <div className="flex-1 min-w-0 overflow-y-auto px-4 py-6">
          <div className="min-h-full flex flex-col items-center justify-center">
            <div className="w-full max-w-2xl flex flex-col gap-3 sm:gap-4">
              {/* Header */}
              <div className="bg-white rounded-2xl shadow-[0_1px_3px_rgba(0,0,0,0.05)] px-6 py-5 shrink-0">
                <h1 className="text-lg sm:text-2xl font-medium text-gray-900 whitespace-nowrap">
                  the <span className="font-display font-normal align-baseline text-gray-900">gazelle</span> workspace
                </h1>
              </div>

              {/* Chat (the chat icon opens the demo builder) */}
              <div className="bg-white rounded-2xl shadow-[0_1px_3px_rgba(0,0,0,0.05)] flex flex-col overflow-hidden">
                <div className="p-4 pb-3.5 shrink-0 flex items-center gap-2.5 border-b-[3.5px] border-gray-100">
                  <button
                    onClick={() => setBuilderOpen(true)}
                    title="Open the demo builder"
                    className="shrink-0 rounded-lg p-1 -m-1 text-gray-700 hover:bg-amber-50 hover:text-amber-700 transition-colors"
                  >
                    <IconMessages className="w-6 h-6" stroke={2} />
                  </button>
                  <h3 className="font-display text-xl leading-tight tracking-tight text-gray-900">Chat</h3>
                </div>
                <div className="h-[clamp(320px,56vh,600px)] min-h-0">
                  <Chat
                    messages={activeSession.messages}
                    onSendMessage={(text) => handleSend(text)}
                    inputValue={inputValue}
                    setInputValue={setInputValue}
                    isLoading={isLoading}
                    onAcceptModification={handleAcceptModification}
                    onDenyModification={handleDenyModification}
                    onReviseModification={handleReviseModification}
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
                <button
                  onClick={openWorkspace}
                  className="bg-gray-900 text-white rounded-xl px-5 py-2.5 text-sm font-semibold hover:bg-gray-800 transition-colors"
                >
                  Open workspace →
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* ------------------------- Workspace view -------------------------- */
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          {/* Header */}
          <header className="flex items-center justify-between gap-3 px-4 sm:px-6 h-14 shrink-0">
            <h1 className="text-lg sm:text-2xl font-medium text-gray-900 whitespace-nowrap">
              the <span className="font-display font-normal align-baseline text-gray-900">gazelle</span> workspace
            </h1>

            {/* Share button — looks like the real one, opens the presenter menu */}
            <div className="relative">
              <button
                onClick={() => setShareMenuOpen((o) => !o)}
                title="Share"
                className="bg-white rounded-xl shadow-[0_1px_3px_rgba(0,0,0,0.05)] px-3.5 py-2 flex items-center gap-1.5 text-gray-700 hover:bg-gray-50 transition-colors"
              >
                <IconShare3 className="w-4 h-4" stroke={1.75} />
                <span className="text-sm font-medium hidden sm:inline">Share</span>
              </button>

              {shareMenuOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShareMenuOpen(false)} />
                  <div className="absolute right-0 top-full mt-1.5 w-60 bg-white rounded-xl shadow-lg border border-gray-200 py-1 z-50">
                    <button
                      onClick={shareWorkspace}
                      className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                    >
                      <IconShare3 className="w-4 h-4 shrink-0" stroke={1.75} />
                      Share workspace
                    </button>
                    <button
                      onClick={() => { setBuilderOpen(true); setShareMenuOpen(false); }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                    >
                      <IconWand className="w-4 h-4 shrink-0" stroke={1.75} />
                      Open demo builder
                    </button>
                    <button
                      onClick={backToOnboarding}
                      className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                    >
                      <IconArrowBackUp className="w-4 h-4 shrink-0" stroke={1.75} />
                      Back to onboarding
                    </button>
                    <div className="my-1 border-t border-gray-100" />
                    <button
                      onClick={resetDemo}
                      className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
                    >
                      <IconRefresh className="w-4 h-4 shrink-0" stroke={1.75} />
                      Reset demo data
                    </button>
                    <Link
                      href="/debug"
                      className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                    >
                      <IconArrowLeft className="w-4 h-4 shrink-0" stroke={1.75} />
                      Debug menu
                    </Link>
                  </div>
                </>
              )}
            </div>
          </header>

          {/* Columns */}
          <div
            ref={columnsRef}
            className="flex-1 flex flex-row min-h-0 overflow-hidden px-3 sm:px-4 lg:px-6 pb-3 sm:pb-4 lg:pb-6"
          >
            {/* Left column - Topic + Chat */}
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
                    value={content.title}
                    onChange={(v) => updateActive((s) => ({ ...s, content: { ...s.content, title: v } }))}
                    onKeyDown={(e) => { if (e.key === 'Enter') e.preventDefault(); }}
                    placeholder="Question (e.g. What mechanics matter for a matchmaking algorithm?)"
                    className="w-full overflow-hidden text-sm font-normal text-gray-800 leading-snug bg-gray-50 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-gray-300 placeholder:text-gray-400"
                  />
                </div>
              </div>

              {/* Chat (the chat icon opens the demo builder) */}
              <div className="bg-white rounded-xl shadow-[0_1px_3px_rgba(0,0,0,0.05)] flex-1 flex flex-col min-h-0 overflow-hidden">
                <div className="p-4 pb-3.5 shrink-0 flex items-center gap-2.5 border-b-[3.5px] border-gray-100">
                  <button
                    onClick={() => setBuilderOpen(true)}
                    title="Open the demo builder"
                    className="shrink-0 rounded-lg p-1 -m-1 text-gray-700 hover:bg-amber-50 hover:text-amber-700 transition-colors"
                  >
                    <IconMessages className="w-6 h-6" stroke={2} />
                  </button>
                  <h3 className="font-display text-xl leading-tight tracking-tight text-gray-900 flex-1">Chat</h3>
                </div>
                <div className="flex-1 min-h-0 overflow-hidden">
                  <Chat
                    messages={activeSession.messages}
                    onSendMessage={(text) => handleSend(text)}
                    inputValue={inputValue}
                    setInputValue={setInputValue}
                    isLoading={isLoading}
                    onAcceptModification={handleAcceptModification}
                    onDenyModification={handleDenyModification}
                    onReviseModification={handleReviseModification}
                    showInput={true}
                    inputPlaceholder="Chat here..."
                    aboveInput={(
                      <div className="flex gap-1.5 mb-4">
                        <button
                          onClick={() => handleSend('Critique my GACIOD matrix', 'critique')}
                          disabled={isLoading}
                          title="Critique — Gazelle hunts for gaps, conflicts, and unclear or missing items across your matrix."
                          className="flex-1 inline-flex items-center justify-center gap-1 px-2.5 py-1 rounded-full bg-[#1F2937] text-white text-sm font-medium hover:bg-[#F3F4F6] hover:text-black transition-colors disabled:opacity-50 shadow-[0_1px_2px_rgba(0,0,0,0.06)]"
                        >
                          <IconZoomQuestion className="w-3.5 h-3.5" stroke={1.75} />
                          Critique
                        </button>
                        <button
                          onClick={() => handleSend('Suggest improvements for my GACIOD matrix', 'suggest')}
                          disabled={isLoading}
                          title="Suggest — Gazelle proposes concrete edits to strengthen existing items, which you can accept, revise, or deny."
                          className="flex-1 inline-flex items-center justify-center gap-1 px-2.5 py-1 rounded-full bg-[#1F2937] text-white text-sm font-medium hover:bg-[#F3F4F6] hover:text-black transition-colors disabled:opacity-50 shadow-[0_1px_2px_rgba(0,0,0,0.06)]"
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
                  onUpdate={(value) => updateActive((s) => ({ ...s, content: { ...s.content, [c.key]: value } }))}
                  highlightedIndices={[]}
                />
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Demo builder slide-over */}
      {builderOpen && (
        <DemoBuilder
          session={activeSession}
          onClose={() => setBuilderOpen(false)}
          onAddMessage={handleBuilderAddMessage}
          onQueueReply={handleQueueReply}
          onRemoveQueued={handleRemoveQueued}
          onMoveQueued={handleMoveQueued}
          onUpdateQueued={handleUpdateQueued}
          onDeleteMessage={handleDeleteMessage}
          onMoveMessage={handleMoveMessage}
          onUpdateMessage={handleUpdateMessage}
          onClearChat={handleClearChat}
          onApplyScript={applyGeneratedScript}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Builder panel
// ---------------------------------------------------------------------------

const SENDERS: { value: Message['sender']; label: string }[] = [
  { value: 'user', label: 'User' },
  { value: 'assistant', label: 'Gazelle' },
  { value: 'system', label: 'System' },
];

const CRITIQUE_TEMPLATE = [
  '[Strength]\n> "A clear, measurable item from the matrix"\nWhy this is working well.',
  '[Conflict]\nG-01: First conflicting item\nC-01: Second conflicting item\nA probing question about the tension between them?',
  '[Missing]\nWhat important element has no item yet?',
].join('\n\n');

function emptyModDraft() {
  return {
    operation: 'ADD' as ModificationOperation,
    category: 'goals' as Modification['category'],
    label: '',
    currentText: '',
    newText: '',
    explanation: '',
  };
}

/** Up/down arrows for reordering list items; arrows disable at the ends. */
function MoveButtons({
  onMove,
  isFirst,
  isLast,
}: {
  onMove: (direction: -1 | 1) => void;
  isFirst: boolean;
  isLast: boolean;
}) {
  return (
    <div className="shrink-0 flex flex-col -my-0.5">
      <button
        onClick={() => onMove(-1)}
        disabled={isFirst}
        className="p-0.5 text-gray-400 hover:text-gray-700 disabled:opacity-25 disabled:hover:text-gray-400 transition-colors"
        aria-label="Move up"
      >
        <IconChevronUp className="w-3.5 h-3.5" stroke={2} />
      </button>
      <button
        onClick={() => onMove(1)}
        disabled={isLast}
        className="p-0.5 text-gray-400 hover:text-gray-700 disabled:opacity-25 disabled:hover:text-gray-400 transition-colors"
        aria-label="Move down"
      >
        <IconChevronDown className="w-3.5 h-3.5" stroke={2} />
      </button>
    </div>
  );
}

function DemoBuilder({
  session,
  onClose,
  onAddMessage,
  onQueueReply,
  onRemoveQueued,
  onMoveQueued,
  onUpdateQueued,
  onDeleteMessage,
  onMoveMessage,
  onUpdateMessage,
  onClearChat,
  onApplyScript,
}: {
  session: DemoSession;
  onClose: () => void;
  onAddMessage: (message: Message) => void;
  onQueueReply: (reply: QueuedReply) => void;
  onRemoveQueued: (id: string) => void;
  onMoveQueued: (id: string, direction: -1 | 1) => void;
  onUpdateQueued: (id: string, patch: { text: string; cue?: string }) => void;
  onDeleteMessage: (id: string) => void;
  onMoveMessage: (id: string, direction: -1 | 1) => void;
  onUpdateMessage: (id: string, text: string) => void;
  onClearChat: () => void;
  onApplyScript: (script: GeneratedScript) => boolean;
}) {
  const [sender, setSender] = useState<Message['sender']>('assistant');
  const [text, setText] = useState('');
  const [trigger, setTrigger] = useState<ReplyTrigger>('any');
  const [mods, setMods] = useState<Modification[]>([]);
  const [showModForm, setShowModForm] = useState(false);
  const [modDraft, setModDraft] = useState(emptyModDraft());
  const [showTopicForm, setShowTopicForm] = useState(false);
  const [topicSuggestion, setTopicSuggestion] = useState('');

  // AI generation state
  const [genPrompt, setGenPrompt] = useState('');
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);

  // In-place editing state (one item at a time)
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editingQueuedId, setEditingQueuedId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const [editCue, setEditCue] = useState('');

  const generate = async () => {
    if (!genPrompt.trim() || generating) return;
    setGenerating(true);
    setGenError(null);
    try {
      const res = await fetch('/api/demo-script', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: genPrompt.trim() }),
      });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || 'Generation failed');
      const applied = onApplyScript(data as GeneratedScript);
      if (applied) setGenPrompt('');
    } catch (e) {
      setGenError(e instanceof Error ? e.message : 'Generation failed. Please try again.');
    } finally {
      setGenerating(false);
    }
  };

  const startEditMessage = (id: string, currentText: string) => {
    setEditingQueuedId(null);
    setEditingMessageId(id);
    setEditText(currentText);
  };

  const startEditQueued = (id: string, currentText: string, currentCue?: string) => {
    setEditingMessageId(null);
    setEditingQueuedId(id);
    setEditText(currentText);
    setEditCue(currentCue ?? '');
  };

  const isAssistant = sender === 'assistant';
  const canSubmit = text.trim().length > 0 || (isAssistant && mods.length > 0);

  const modDraftValid = (() => {
    const { operation, category, label, newText } = modDraft;
    const needsLabel = category !== 'title' && (operation === 'UPDATE' || operation === 'DELETE');
    if (needsLabel && !/^[GACIOD]-\d{2}$/.test(label.trim())) return false;
    if (operation !== 'DELETE' && !newText.trim()) return false;
    return true;
  })();

  const attachMod = () => {
    if (!modDraftValid) return;
    const { operation, category, label, currentText, newText, explanation } = modDraft;
    setMods((prev) => [
      ...prev,
      {
        operation,
        category,
        label: category !== 'title' && label.trim() ? label.trim() : undefined,
        currentText: currentText.trim() || undefined,
        newText: operation === 'DELETE' ? undefined : newText.trim(),
        explanation: explanation.trim() || 'Suggested for this demo.',
      },
    ]);
    setModDraft(emptyModDraft());
    setShowModForm(false);
  };

  const resetComposer = () => {
    setText('');
    setMods([]);
    setShowModForm(false);
    setModDraft(emptyModDraft());
    setShowTopicForm(false);
    setTopicSuggestion('');
  };

  const addNow = () => {
    if (!canSubmit) return;
    onAddMessage({
      id: uid(),
      text: text.trim(),
      sender,
      timestamp: Date.now(),
      isStructured: (isAssistant && isStructuredText(text)) || undefined,
      modifications: isAssistant && mods.length > 0 ? mods : undefined,
      topicSuggestion: isAssistant && topicSuggestion.trim() ? topicSuggestion.trim() : undefined,
    });
    resetComposer();
  };

  const queue = () => {
    if (!canSubmit || !isAssistant) return;
    onQueueReply({
      id: uid(),
      text: text.trim(),
      trigger,
      modifications: mods.length > 0 ? mods : undefined,
      topicSuggestion: topicSuggestion.trim() || undefined,
    });
    resetComposer();
  };

  const inputClass =
    'w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-sm font-normal bg-gray-50 focus:outline-none focus:ring-1 focus:ring-gray-300';
  const labelClass = 'block text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1';

  return (
    <>
      {/* Overlay */}
      <div className="fixed inset-0 bg-black/20 z-40" onClick={onClose} />

      {/* Panel */}
      <div className="fixed inset-y-0 right-0 w-full max-w-md bg-white shadow-2xl z-50 flex flex-col">
        <div className="p-4 border-b-[3.5px] border-gray-100 flex items-center gap-2.5 shrink-0">
          <IconWand className="w-6 h-6 text-amber-600" stroke={2} />
          <div className="flex-1 min-w-0">
            <h3 className="font-display text-xl leading-tight tracking-tight text-gray-900">Demo builder</h3>
            <p className="text-xs text-gray-500 mt-0.5">
              Stage this chat for marketing — add messages directly or queue replies that play when someone types or clicks a quick action.
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition-colors" aria-label="Close builder">
            <IconX className="w-5 h-5" stroke={2} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          {/* Generate with AI */}
          <section>
            <h4 className="font-display text-sm text-gray-800 mb-1">Generate with AI</h4>
            <p className="text-xs text-gray-500 mb-2">
              Describe the scenario and Gazelle drafts the whole script — opening chat, queued replies with
              presenter cues, Critique and Suggest responses, and a starting matrix. Edit everything below afterwards.
            </p>
            <textarea
              value={genPrompt}
              onChange={(e) => setGenPrompt(e.target.value)}
              rows={3}
              disabled={generating}
              placeholder="e.g. A student designing a campus food-delivery app — showcase the critique and suggest features"
              className={`${inputClass} resize-none disabled:opacity-60`}
            />
            <button
              onClick={generate}
              disabled={!genPrompt.trim() || generating}
              className="mt-2 w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-gray-900 text-white text-xs font-medium hover:bg-gray-800 transition-colors disabled:opacity-50"
            >
              <IconSparkles className="w-3.5 h-3.5" stroke={2} />
              {generating ? 'Generating script…' : 'Generate conversation'}
            </button>
            {genError && (
              <p className="mt-1.5 text-xs text-red-600">{genError}</p>
            )}
          </section>

          {/* Compose */}
          <section>
            <h4 className="font-display text-sm text-gray-800 mb-2">Compose message</h4>
            <div className="flex gap-1 mb-2">
              {SENDERS.map(({ value, label }) => (
                <button
                  key={value}
                  onClick={() => setSender(value)}
                  className={`flex-1 px-2 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    sender === value
                      ? 'bg-gray-900 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={3}
              placeholder={isAssistant ? 'What Gazelle says (markdown and [Strength]/[Conflict]/… feedback tags supported)...' : 'Message text...'}
              className={`${inputClass} resize-none`}
            />
            {isAssistant && (
              <button
                onClick={() => setText(CRITIQUE_TEMPLATE)}
                className="mt-1 text-[11px] font-medium text-gray-400 hover:text-gray-600 transition-colors"
              >
                Insert critique template (renders as feedback cards)
              </button>
            )}

            {/* Attached modification cards */}
            {isAssistant && mods.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {mods.map((m, i) => (
                  <span key={i} className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 text-[11px] font-medium">
                    {m.operation} {m.category}{m.label ? ` (${m.label})` : ''}
                    <button onClick={() => setMods((prev) => prev.filter((_, idx) => idx !== i))} aria-label="Remove card">
                      <IconX className="w-3 h-3" stroke={2.5} />
                    </button>
                  </span>
                ))}
              </div>
            )}

            {/* Topic suggestion (onboarding card) */}
            {isAssistant && (
              showTopicForm ? (
                <div className="mt-2 border border-emerald-200 rounded-xl p-3 bg-emerald-50/40">
                  <label className={labelClass}>Suggested topic (onboarding card)</label>
                  <input
                    value={topicSuggestion}
                    onChange={(e) => setTopicSuggestion(e.target.value)}
                    placeholder="What should my candle-business website include?"
                    className={inputClass}
                  />
                  <button
                    onClick={() => { setShowTopicForm(false); setTopicSuggestion(''); }}
                    className="mt-1.5 text-[11px] font-medium text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    Remove topic card
                  </button>
                </div>
              ) : (
                <div>
                  <button
                    onClick={() => setShowTopicForm(true)}
                    className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-emerald-600 hover:text-emerald-800 transition-colors"
                  >
                    <IconPlus className="w-3.5 h-3.5" stroke={2} />
                    Attach a topic suggestion (onboarding)
                  </button>
                </div>
              )
            )}

            {/* Modification card form */}
            {isAssistant && (
              showModForm ? (
                <div className="mt-2 border border-gray-200 rounded-xl p-3 space-y-2 bg-gray-50/60">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className={labelClass}>Operation</label>
                      <select
                        value={modDraft.operation}
                        onChange={(e) => setModDraft({ ...modDraft, operation: e.target.value as ModificationOperation })}
                        className={inputClass}
                      >
                        <option value="ADD">ADD</option>
                        <option value="UPDATE">UPDATE</option>
                        <option value="DELETE">DELETE</option>
                      </select>
                    </div>
                    <div>
                      <label className={labelClass}>Category</label>
                      <select
                        value={modDraft.category}
                        onChange={(e) => setModDraft({ ...modDraft, category: e.target.value as Modification['category'] })}
                        className={inputClass}
                      >
                        {MOD_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>
                  </div>
                  {modDraft.category !== 'title' && modDraft.operation !== 'ADD' && (
                    <div>
                      <label className={labelClass}>Item label (e.g. G-01)</label>
                      <input
                        value={modDraft.label}
                        onChange={(e) => setModDraft({ ...modDraft, label: e.target.value })}
                        placeholder="G-01"
                        className={inputClass}
                      />
                    </div>
                  )}
                  {modDraft.operation !== 'ADD' && (
                    <div>
                      <label className={labelClass}>Current text</label>
                      <input
                        value={modDraft.currentText}
                        onChange={(e) => setModDraft({ ...modDraft, currentText: e.target.value })}
                        placeholder="Shown as the item being changed/removed"
                        className={inputClass}
                      />
                    </div>
                  )}
                  {modDraft.operation !== 'DELETE' && (
                    <div>
                      <label className={labelClass}>New text</label>
                      <input
                        value={modDraft.newText}
                        onChange={(e) => setModDraft({ ...modDraft, newText: e.target.value })}
                        placeholder="The proposed item text"
                        className={inputClass}
                      />
                    </div>
                  )}
                  <div>
                    <label className={labelClass}>Explanation</label>
                    <input
                      value={modDraft.explanation}
                      onChange={(e) => setModDraft({ ...modDraft, explanation: e.target.value })}
                      placeholder="One short reason"
                      className={inputClass}
                    />
                  </div>
                  <div className="flex gap-2 pt-1">
                    <button
                      onClick={attachMod}
                      disabled={!modDraftValid}
                      className="flex-1 px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-medium hover:bg-indigo-700 transition-colors disabled:opacity-50"
                    >
                      Attach card
                    </button>
                    <button
                      onClick={() => { setShowModForm(false); setModDraft(emptyModDraft()); }}
                      className="flex-1 px-3 py-1.5 rounded-lg bg-gray-100 text-gray-700 text-xs font-medium border border-gray-200 hover:bg-gray-200 transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setShowModForm(true)}
                  className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-indigo-600 hover:text-indigo-800 transition-colors"
                >
                  <IconPlus className="w-3.5 h-3.5" stroke={2} />
                  Attach a modification card
                </button>
              )
            )}

            {/* Trigger (queue only) */}
            {isAssistant && (
              <div className="mt-3">
                <label className={labelClass}>Play when (for queued replies)</label>
                <div className="flex gap-1">
                  {(Object.keys(TRIGGER_LABELS) as ReplyTrigger[]).map((t) => (
                    <button
                      key={t}
                      onClick={() => setTrigger(t)}
                      className={`flex-1 px-2 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                        trigger === t
                          ? 'bg-amber-500 text-white'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      {TRIGGER_LABELS[t]}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="flex gap-2 mt-3">
              <button
                onClick={addNow}
                disabled={!canSubmit}
                className="flex-1 px-3 py-2 rounded-lg bg-gray-900 text-white text-xs font-medium hover:bg-gray-800 transition-colors disabled:opacity-50"
              >
                Add to chat now
              </button>
              {isAssistant && (
                <button
                  onClick={queue}
                  disabled={!canSubmit}
                  title="Plays automatically when its trigger fires"
                  className="flex-1 inline-flex items-center justify-center gap-1 px-3 py-2 rounded-lg bg-amber-500 text-white text-xs font-medium hover:bg-amber-600 transition-colors disabled:opacity-50"
                >
                  <IconPlayerTrackNext className="w-3.5 h-3.5" stroke={2} />
                  Queue as reply
                </button>
              )}
            </div>
          </section>

          {/* Queued replies */}
          <section>
            <h4 className="font-display text-sm text-gray-800 mb-1">Queued replies</h4>
            <p className="text-xs text-gray-500 mb-2">
              &ldquo;Next message&rdquo; replies play in order as messages are sent. &ldquo;Critique click&rdquo; and
              &ldquo;Suggest click&rdquo; replies play when that quick action is pressed (falling back to the next
              &ldquo;Next message&rdquo; reply if none is staged).
            </p>
            {session.queuedReplies.length === 0 ? (
              <p className="text-xs text-gray-400 italic">Nothing queued.</p>
            ) : (
              <ol className="space-y-1.5">
                {session.queuedReplies.map((q, i) => (
                  <li key={q.id} className="flex items-start gap-2 border border-gray-200 rounded-lg px-2.5 py-2 bg-gray-50/60">
                    <span className="shrink-0 w-5 h-5 rounded-full bg-amber-100 text-amber-700 text-[11px] font-semibold flex items-center justify-center mt-0.5">
                      {i + 1}
                    </span>
                    {editingQueuedId === q.id ? (
                      <div className="flex-1 min-w-0">
                        <label className={labelClass}>Reply text</label>
                        <textarea
                          value={editText}
                          onChange={(e) => setEditText(e.target.value)}
                          rows={4}
                          autoFocus
                          className={`${inputClass} resize-none`}
                        />
                        <label className={`${labelClass} mt-2`}>Cue — what the presenter types first (optional)</label>
                        <input
                          value={editCue}
                          onChange={(e) => setEditCue(e.target.value)}
                          className={inputClass}
                        />
                        <div className="flex gap-2 mt-2">
                          <button
                            onClick={() => {
                              onUpdateQueued(q.id, { text: editText.trim(), cue: editCue });
                              setEditingQueuedId(null);
                            }}
                            disabled={!editText.trim()}
                            className="flex-1 px-3 py-1.5 rounded-lg bg-gray-900 text-white text-xs font-medium hover:bg-gray-800 transition-colors disabled:opacity-50"
                          >
                            Save
                          </button>
                          <button
                            onClick={() => setEditingQueuedId(null)}
                            className="flex-1 px-3 py-1.5 rounded-lg bg-gray-100 text-gray-700 text-xs font-medium border border-gray-200 hover:bg-gray-200 transition-colors"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="flex-1 min-w-0">
                          {q.cue && (
                            <p className="text-[11px] text-gray-400 italic mb-0.5">Cue: &ldquo;{q.cue}&rdquo;</p>
                          )}
                          <p className="text-xs text-gray-700 line-clamp-2">{q.text}</p>
                          <div className="flex flex-wrap items-center gap-1.5 mt-1">
                            <span className={`inline-flex px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide ${
                              q.trigger === 'any' ? 'bg-gray-200 text-gray-600' : 'bg-amber-100 text-amber-700'
                            }`}>
                              {TRIGGER_LABELS[q.trigger]}
                            </span>
                            {q.modifications && q.modifications.length > 0 && (
                              <span className="text-[11px] text-indigo-600">
                                {q.modifications.length} card{q.modifications.length === 1 ? '' : 's'}
                              </span>
                            )}
                            {q.topicSuggestion && (
                              <span className="text-[11px] text-emerald-600">topic card</span>
                            )}
                          </div>
                        </div>
                        <button
                          onClick={() => startEditQueued(q.id, q.text, q.cue)}
                          className="shrink-0 p-1 text-gray-400 hover:text-gray-700 transition-colors"
                          aria-label="Edit queued reply"
                        >
                          <IconPencil className="w-3.5 h-3.5" stroke={1.75} />
                        </button>
                        <MoveButtons
                          onMove={(direction) => onMoveQueued(q.id, direction)}
                          isFirst={i === 0}
                          isLast={i === session.queuedReplies.length - 1}
                        />
                        <button
                          onClick={() => onRemoveQueued(q.id)}
                          className="shrink-0 p-1 text-gray-400 hover:text-red-500 transition-colors"
                          aria-label="Remove queued reply"
                        >
                          <IconTrash className="w-3.5 h-3.5" stroke={1.75} />
                        </button>
                      </>
                    )}
                  </li>
                ))}
              </ol>
            )}
          </section>

          {/* Messages */}
          <section>
            <div className="flex items-center justify-between mb-2">
              <h4 className="font-display text-sm text-gray-800">Messages in this chat</h4>
              {session.messages.length > 0 && (
                <button
                  onClick={onClearChat}
                  className="text-xs font-medium text-red-500 hover:text-red-700 transition-colors"
                >
                  Clear chat
                </button>
              )}
            </div>
            {session.messages.length === 0 ? (
              <p className="text-xs text-gray-400 italic">No messages yet.</p>
            ) : (
              <ul className="space-y-1.5">
                {session.messages.map((m, i) => (
                  <li key={m.id} className="flex items-start gap-2 border border-gray-200 rounded-lg px-2.5 py-2">
                    <span
                      className={`shrink-0 px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide mt-0.5 ${
                        m.sender === 'user'
                          ? 'bg-gray-900 text-white'
                          : m.sender === 'assistant'
                          ? 'bg-emerald-100 text-emerald-700'
                          : 'bg-gray-100 text-gray-500'
                      }`}
                    >
                      {m.sender === 'assistant' ? 'gazelle' : m.sender}
                    </span>
                    {editingMessageId === m.id ? (
                      <div className="flex-1 min-w-0">
                        <textarea
                          value={editText}
                          onChange={(e) => setEditText(e.target.value)}
                          rows={4}
                          autoFocus
                          className={`${inputClass} resize-none`}
                        />
                        <div className="flex gap-2 mt-2">
                          <button
                            onClick={() => {
                              onUpdateMessage(m.id, editText.trim());
                              setEditingMessageId(null);
                            }}
                            disabled={!editText.trim() && !m.modifications?.length}
                            className="flex-1 px-3 py-1.5 rounded-lg bg-gray-900 text-white text-xs font-medium hover:bg-gray-800 transition-colors disabled:opacity-50"
                          >
                            Save
                          </button>
                          <button
                            onClick={() => setEditingMessageId(null)}
                            className="flex-1 px-3 py-1.5 rounded-lg bg-gray-100 text-gray-700 text-xs font-medium border border-gray-200 hover:bg-gray-200 transition-colors"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <p className="flex-1 min-w-0 text-xs text-gray-700 line-clamp-2">
                          {m.text || <span className="italic text-gray-400">(cards only)</span>}
                        </p>
                        <button
                          onClick={() => startEditMessage(m.id, m.text)}
                          className="shrink-0 p-1 text-gray-400 hover:text-gray-700 transition-colors"
                          aria-label="Edit message"
                        >
                          <IconPencil className="w-3.5 h-3.5" stroke={1.75} />
                        </button>
                        <MoveButtons
                          onMove={(direction) => onMoveMessage(m.id, direction)}
                          isFirst={i === 0}
                          isLast={i === session.messages.length - 1}
                        />
                        <button
                          onClick={() => onDeleteMessage(m.id)}
                          className="shrink-0 p-1 text-gray-400 hover:text-red-500 transition-colors"
                          aria-label="Delete message"
                        >
                          <IconTrash className="w-3.5 h-3.5" stroke={1.75} />
                        </button>
                      </>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </>
  );
}
