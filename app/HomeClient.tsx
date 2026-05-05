'use client';

import { useState, useMemo, useEffect, useCallback, useTransition } from 'react';
import GACIODCard, { formatForAI } from '@/components/GACIODCard';
import Chat, { Message, Improvement, Modification } from '@/components/Chat';
import SuggestionsTimeline from '@/components/SuggestionsTimeline';
import ChatSidebar from '@/components/ChatSidebar';
import { authClient } from '@/lib/auth/client';
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
}

export interface ClientSession {
  id: string;
  title: string;
  content: GACIODContent;
  context: string;
  messages: Message[];
  createdAt: number;
  updatedAt: number;
}

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

/** Convert DB session rows (from buildClientSession in actions.ts) to client format */
function toClientSession(row: any): ClientSession {
  return {
    id: row.id,
    title: row.title ?? 'New Chat',
    content: (row.content as GACIODContent) ?? emptyContent(),
    context: row.context ?? '',
    messages: (row.messages as Message[]) ?? [],
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

  const [sessions, setSessions] = useState<ClientSession[]>(
    () => initialSessions.map(toClientSession),
  );
  const [activeSessionId, setActiveSessionId] = useState<string>(
    () => sessions[0]?.id ?? '',
  );
  const [showLanding, setShowLanding] = useState(true);
  const [landingQuestion, setLandingQuestion] = useState('');
  const [landingContext, setLandingContext] = useState('');
  const [chatSidebarOpen, setChatSidebarOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

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
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isGeneratingSample, setIsGeneratingSample] = useState(false);
  const [showDebugMenu, setShowDebugMenu] = useState(false);
  const [context, setContext] = useState(activeSession?.context ?? '');
  const [showSidebar, setShowSidebar] = useState(true);
  const [activeRightTab, setActiveRightTab] = useState<'chat' | 'suggestions' | 'context'>('chat');

  // Handle "Get Started" from landing page — creates session in DB with question/context
  const handleGetStarted = () => {
    const question = landingQuestion.trim();
    const ctx = landingContext.trim();
    if (!question) return;

    startTransition(async () => {
      const newRow = await createDbSession();
      const cs = toClientSession(newRow);
      // Set the question as the title and context
      cs.content.title = question;
      cs.title = question.slice(0, 50);
      cs.context = ctx;

      // Persist to DB immediately
      await updateDbSession(cs.id, {
        title: cs.title,
        content: { ...cs.content } as unknown as Record<string, string>,
        context: ctx,
        messages: [],
      });

      setSessions((prev) => [cs, ...prev]);
      setActiveSessionId(cs.id);
      setContent(cs.content);
      setMessages([]);
      setContext(ctx);
      setShowLanding(false);
      setLandingQuestion('');
      setLandingContext('');
    });
  };

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

  // Persist to DB on content/messages/context change (debounced)
  useEffect(() => {
    if (!activeSessionId || showLanding) return;
    const timeout = setTimeout(() => {
      const title = deriveTitle(messages, content);
      startTransition(async () => {
        await updateDbSession(activeSessionId, {
          title,
          content: content as unknown as Record<string, string>,
          context,
          messages: messages as unknown[],
        });
      });
      // Update local sessions state
      setSessions((prev) =>
        prev.map((s) =>
          s.id === activeSessionId
            ? { ...s, title, content, context, messages, updatedAt: Date.now() }
            : s,
        ),
      );
    }, 500);
    return () => clearTimeout(timeout);
  }, [content, messages, context, activeSessionId, showLanding, deriveTitle]);

  const handleNewChat = () => {
    setShowLanding(true);
    setLandingQuestion('');
    setLandingContext('');
    setChatSidebarOpen(false);
  };

  const handleSelectSession = (id: string) => {
    if (id === activeSessionId && !showLanding) {
      setChatSidebarOpen(false);
      return;
    }
    const session = sessions.find((s) => s.id === id);
    if (!session) return;
    setActiveSessionId(id);
    setContent(session.content);
    setMessages(session.messages);
    setContext(session.context);
    setInputValue('');
    setShowLanding(false);
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
      }
    }
    setInputValue('');
  };

  const updateContent = (key: keyof GACIODContent, value: string) => {
    setContent({ ...content, [key]: value });
  };

  const stripLabel = (text: string): string => {
    return text.replace(/^[GACIOD]-\d{2}:\s*/, '').trim();
  };

  const parseItems = (contentStr: string): string[] => {
    if (!contentStr.trim()) return [];
    return contentStr.split('\n').filter((line) => line.trim() !== '');
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
      if (category === 'title') {
        switch (modification.operation) {
          case 'ADD':
          case 'UPDATE':
            if (modification.newText) {
              return { ...prev, title: modification.newText };
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
          if (modification.newText) {
            newItems = [...items, modification.newText];
          }
          break;
        case 'UPDATE':
          if (modification.label && modification.newText) {
            // Resolve label against the current (up-to-date) content
            const match = modification.label.match(/^([GACIOD])-(\d{2})$/);
            if (match) {
              const index = parseInt(match[2], 10) - 1;
              if (index >= 0 && index < items.length) {
                newItems = [...items];
                newItems[index] = modification.newText;
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
            setShowLanding(false);
          }
        });
      } catch (error) {
        console.error('Error importing data:', error);
        alert('Failed to import data. Please check the file format.');
      }
    };
    input.click();
  };

  const handleSendMessage = async (text: string) => {
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

  // Derive first name for greeting
  const firstName = userName.split(' ')[0] || '';

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

      {showLanding ? (
        <div className="flex-1 flex flex-col items-center justify-center min-w-0 overflow-hidden px-4">
          <div className="w-full max-w-2xl flex flex-col items-center">
            {/* Greeting */}
            <h1 className="text-2xl sm:text-3xl font-semibold text-gray-800 mb-8 sm:mb-10">
              <span className="mr-1.5">&#128075;</span> Hello, {firstName || 'there'}.
            </h1>

            {/* Question input row */}
            <div className="w-full flex items-center gap-3 mb-4">
              <div className="flex-1 bg-white rounded-full shadow-[0_1px_3px_rgba(0,0,0,0.05)] px-5 py-3">
                <input
                  type="text"
                  value={landingQuestion}
                  onChange={(e) => setLandingQuestion(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleGetStarted();
                    }
                  }}
                  placeholder="Question or Topic (e.g. What are some mechanics we need to consider for a matchmaking algorithm?)"
                  className="w-full text-sm font-normal text-gray-800 bg-transparent focus:outline-none placeholder:text-gray-400"
                />
              </div>
              <button
                onClick={handleGetStarted}
                disabled={!landingQuestion.trim() || isPending}
                className="bg-white hover:bg-gray-50 rounded-full shadow-[0_1px_3px_rgba(0,0,0,0.05)] px-6 py-3 text-sm font-semibold text-gray-800 transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex-shrink-0"
              >
                Get Started
              </button>
            </div>

            {/* Context section */}
            <div className="w-full bg-white rounded-xl shadow-[0_1px_3px_rgba(0,0,0,0.05)] p-5">
              <h3 className="text-sm font-semibold text-gray-800 mb-1">Context</h3>
              <p className="text-xs font-normal text-gray-400 mb-3">
                Adding context can provide more useful insights from the assistant.
              </p>
              <textarea
                value={landingContext}
                onChange={(e) => setLandingContext(e.target.value)}
                placeholder="Add additional context..."
                className="w-full px-3 py-2.5 text-sm font-normal text-gray-700 bg-gray-50 rounded-lg resize-none focus:outline-none focus:ring-1 focus:ring-gray-300 h-24 sm:h-28"
              />
            </div>
          </div>
        </div>
      ) : (
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <div className="flex-1 flex flex-col lg:flex-row p-3 sm:p-4 lg:p-6 gap-3 sm:gap-4 lg:gap-6 min-h-0 overflow-hidden">
          {/* Left side - GACIOD cards */}
          <div className="flex-1 flex flex-col gap-3 sm:gap-4 lg:gap-6 min-w-0 min-h-0 overflow-hidden">
            {/* Title row */}
            <div className="flex items-stretch gap-2 sm:gap-3 flex-shrink-0">
              <div className="bg-white rounded-xl shadow-[0_1px_3px_rgba(0,0,0,0.05)] px-3 sm:px-4 flex items-center flex-shrink-0">
                <h1 className="text-sm sm:text-base font-bold text-black-500 whitespace-nowrap">
                  Gasel
                </h1>
              </div>
              <div className="flex-1 bg-white rounded-xl shadow-[0_1px_3px_rgba(0,0,0,0.05)] flex items-center px-3 sm:px-4">
                <input
                  type="text"
                  value={content.title}
                  onChange={(e) =>
                    setContent({ ...content, title: e.target.value })
                  }
                  placeholder="Question (e.g. What are some mechanics we need to consider for a matchmaking algorithm?)"
                  className="w-full py-2.5 text-sm font-normal text-gray-800 bg-transparent focus:outline-none placeholder:text-gray-400 placeholder:font-normal"
                />
              </div>
              <button
                onClick={handleExportData}
                className="bg-white rounded-xl shadow-[0_1px_3px_rgba(0,0,0,0.05)] px-3 sm:px-4 flex items-center gap-2 text-gray-600 hover:bg-gray-50 transition-colors flex-shrink-0"
                title="Export all chat data as JSON"
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
                    d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3"
                  />
                </svg>
                <span className="text-xs sm:text-sm font-medium hidden sm:inline">
                  Export
                </span>
              </button>
              <button
                onClick={handleImportData}
                disabled={isPending}
                className="bg-white rounded-xl shadow-[0_1px_3px_rgba(0,0,0,0.05)] px-3 sm:px-4 flex items-center gap-2 text-gray-600 hover:bg-gray-50 transition-colors flex-shrink-0 disabled:opacity-50"
                title="Import chat data from JSON"
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
                    d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5"
                  />
                </svg>
                <span className="text-xs sm:text-sm font-medium hidden sm:inline">
                  Import
                </span>
              </button>
              <button
                onClick={() => setShowSidebar(!showSidebar)}
                className="lg:hidden bg-white rounded-xl shadow-[0_1px_3px_rgba(0,0,0,0.05)] px-3 flex items-center text-gray-500 hover:bg-gray-50 transition-colors flex-shrink-0"
                aria-label={showSidebar ? 'Hide sidebar' : 'Show sidebar'}
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
                    d="M8.625 12a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0zm0 0H8.25m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0zm0 0H12m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 0 1-2.555-.337A5.972 5.972 0 0 1 5.41 20.97a5.969 5.969 0 0 1-.474-.065 4.48 4.48 0 0 0 .978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z"
                  />
                </svg>
              </button>
            </div>

            {/* GACIOD Grid */}
            <div className="flex-1 grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 grid-rows-3 lg:grid-rows-2 gap-2 sm:gap-3 lg:gap-4 min-h-0 overflow-hidden">
              <GACIODCard
                title="Goals"
                content={content.goals}
                onUpdate={(value) => updateContent('goals', value)}
                highlightedIndices={highlightedIndices.goals}
              />
              <GACIODCard
                title="Assumptions"
                content={content.assumptions}
                onUpdate={(value) => updateContent('assumptions', value)}
                highlightedIndices={highlightedIndices.assumptions}
              />
              <GACIODCard
                title="Constraints"
                content={content.constraints}
                onUpdate={(value) => updateContent('constraints', value)}
                highlightedIndices={highlightedIndices.constraints}
              />
              <GACIODCard
                title="Ideas"
                content={content.ideas}
                onUpdate={(value) => updateContent('ideas', value)}
                highlightedIndices={highlightedIndices.ideas}
              />
              <GACIODCard
                title="Opinions"
                content={content.opinions}
                onUpdate={(value) => updateContent('opinions', value)}
                highlightedIndices={highlightedIndices.opinions}
              />
              <GACIODCard
                title="Decisions"
                content={content.decisions}
                onUpdate={(value) => updateContent('decisions', value)}
                highlightedIndices={highlightedIndices.decisions}
              />
            </div>
          </div>

          {/* Right side - Tabbed panel */}
          <div
            className={`${
              showSidebar ? 'flex' : 'hidden'
            } lg:flex w-full lg:w-72 xl:w-80 flex-col gap-3 sm:gap-4 flex-shrink-0 min-h-0 overflow-hidden max-h-[50vh] lg:max-h-none`}
          >
            {/* Chat / Suggestions / Context card */}
            <div className="bg-white rounded-xl shadow-[0_1px_3px_rgba(0,0,0,0.05)] flex-1 flex flex-col min-h-0 overflow-hidden">
              <div className="flex border-b border-gray-100 flex-shrink-0">
                <button
                  onClick={() => setActiveRightTab('context')}
                  className={`flex-1 px-2 py-2.5 text-sm font-semibold transition-colors ${
                    activeRightTab === 'context'
                      ? 'text-gray-800 border-b-2 border-gray-800'
                      : 'text-gray-400 hover:text-gray-600'
                  }`}
                >
                  Context
                </button>
                <button
                  onClick={() => setActiveRightTab('chat')}
                  className={`flex-1 px-2 py-2.5 text-sm font-semibold transition-colors ${
                    activeRightTab === 'chat'
                      ? 'text-gray-800 border-b-2 border-gray-800'
                      : 'text-gray-400 hover:text-gray-600'
                  }`}
                >
                  Chat
                </button>
                <button
                  onClick={() => setActiveRightTab('suggestions')}
                  className={`flex-1 px-2 py-2.5 text-sm font-semibold transition-colors ${
                    activeRightTab === 'suggestions'
                      ? 'text-gray-800 border-b-2 border-gray-800'
                      : 'text-gray-400 hover:text-gray-600'
                  }`}
                >
                  Suggestions
                </button>
              </div>
              <div className="flex-1 min-h-0 overflow-hidden">
                {activeRightTab === 'chat' && (
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
                    showActionsInline={true}
                  />
                )}
                {activeRightTab === 'suggestions' && (
                  <SuggestionsTimeline messages={messages} />
                )}
                {activeRightTab === 'context' && (
                  <div className="h-full flex flex-col p-3 sm:p-4">
                    <p className="text-xs font-normal text-gray-400 mb-3">
                      Adding context can provide more useful insights from the
                      assistant.
                    </p>
                    <textarea
                      value={context}
                      onChange={(e) => setContext(e.target.value)}
                      placeholder="Add additional context..."
                      className="flex-1 w-full px-3 py-2 text-sm font-normal text-gray-700 bg-gray-50 rounded-lg resize-none focus:outline-none focus:ring-1 focus:ring-gray-300"
                    />
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
      )}
    </div>
  );
}
