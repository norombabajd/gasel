'use client';

import { useState, useMemo } from 'react';
import GACIODCard, { formatForAI } from '@/components/GACIODCard';
import Chat, { Message, Improvement, Modification } from '@/components/Chat';

interface GACIODContent {
  title: string;
  goals: string;
  assumptions: string;
  constraints: string;
  ideas: string;
  opinions: string;
  decisions: string;
}

export default function Home() {
  const [content, setContent] = useState<GACIODContent>({
    title: '',
    goals: '',
    assumptions: '',
    constraints: '',
    ideas: '',
    opinions: '',
    decisions: '',
  });

  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isGeneratingSample, setIsGeneratingSample] = useState(false);
  const [showDebugMenu, setShowDebugMenu] = useState(false);
  const [context, setContext] = useState('');
  const [showSidebar, setShowSidebar] = useState(true);

  const updateContent = (key: keyof GACIODContent, value: string) => {
    setContent({ ...content, [key]: value });
  };

  // Strip label prefixes like "G-01: " from text the AI may have included
  const stripLabel = (text: string): string => {
    return text.replace(/^[GACIOD]-\d{2}:\s*/, '').trim();
  };

  const handleAcceptImprovement = (improvement: Improvement) => {
    const category = improvement.category.toLowerCase() as keyof GACIODContent;
    const originalTextClean = stripLabel(improvement.originalText);
    const newTextClean = stripLabel(improvement.newText);

    if (content[category]) {
      const items = parseItems(content[category]);
      const matchIndex = items.findIndex(item =>
        item === originalTextClean ||
        item.trim() === originalTextClean.trim() ||
        item.includes(originalTextClean) ||
        originalTextClean.includes(item)
      );

      if (matchIndex !== -1) {
        const newItems = [...items];
        newItems[matchIndex] = newTextClean;
        setContent({
          ...content,
          [category]: newItems.join('\n'),
        });
      } else {
        console.warn('[Accept Improvement] Could not find matching item:', {
          category,
          originalText: improvement.originalText,
          originalTextClean,
          items,
        });
      }
    }

    // Remove the accepted improvement from the message
    setMessages(prev =>
      prev.map(msg => {
        if (msg.improvements) {
          const newImprovements = msg.improvements.filter(
            imp => !(imp.category === improvement.category && imp.originalText === improvement.originalText)
          );
          return {
            ...msg,
            improvements: newImprovements.length > 0 ? newImprovements : undefined,
          };
        }
        return msg;
      })
    );
  };

  const handleDenyImprovement = (messageId: string, improvementIndex: number) => {
    setMessages(prev =>
      prev.map(msg => {
        if (msg.id === messageId && msg.improvements) {
          const newImprovements = msg.improvements.filter((_, idx) => idx !== improvementIndex);
          return {
            ...msg,
            improvements: newImprovements.length > 0 ? newImprovements : undefined,
          };
        }
        return msg;
      })
    );
  };

  // Helper function to parse items from content
  const parseItems = (contentStr: string): string[] => {
    if (!contentStr.trim()) return [];
    return contentStr.split('\n').filter(line => line.trim() !== '');
  };

  // Helper function to resolve label to category and index
  const resolveLabelToIndex = (label: string): { category: keyof GACIODContent; index: number } | null => {
    const match = label.match(/^([GACIOD])-(\d{2})$/);
    if (!match) return null;

    const [, prefix, numStr] = match;
    const index = parseInt(numStr, 10) - 1; // Convert to 0-based index

    const categoryMap: Record<string, keyof GACIODContent> = {
      'G': 'goals',
      'A': 'assumptions',
      'C': 'constraints',
      'I': 'ideas',
      'O': 'opinions',
      'D': 'decisions',
    };

    const category = categoryMap[prefix];
    if (!category) return null;

    const items = parseItems(content[category]);
    if (index < 0 || index >= items.length) return null;

    return { category, index };
  };

  const handleAcceptModification = (modification: Modification) => {
    const category = modification.category as keyof GACIODContent;

    // Special handling for title — it's a single string, not a list
    if (category === 'title') {
      switch (modification.operation) {
        case 'ADD':
        case 'UPDATE':
          if (modification.newText) {
            setContent({ ...content, title: modification.newText });
          }
          break;
        case 'DELETE':
          setContent({ ...content, title: '' });
          break;
      }

      // Remove the accepted modification from the message
      setMessages(prev =>
        prev.map(msg => {
          if (msg.modifications) {
            const newModifications = msg.modifications.filter(
              mod => !(mod.operation === modification.operation &&
                       mod.category === modification.category &&
                       mod.newText === modification.newText)
            );
            return {
              ...msg,
              modifications: newModifications.length > 0 ? newModifications : undefined,
            };
          }
          return msg;
        })
      );
      return;
    }

    const items = parseItems(content[category]);
    let newItems: string[];

    switch (modification.operation) {
      case 'ADD':
        if (modification.newText) {
          newItems = [...items, modification.newText];
        } else {
          return; // Invalid ADD without newText
        }
        break;

      case 'UPDATE':
        if (modification.label && modification.newText) {
          const resolved = resolveLabelToIndex(modification.label);
          if (resolved && resolved.category === category) {
            newItems = [...items];
            newItems[resolved.index] = modification.newText;
          } else {
            console.warn('Could not resolve label for UPDATE:', modification.label);
            return;
          }
        } else {
          return; // Invalid UPDATE
        }
        break;

      case 'DELETE':
        if (modification.label) {
          const resolved = resolveLabelToIndex(modification.label);
          if (resolved && resolved.category === category) {
            newItems = items.filter((_, idx) => idx !== resolved.index);
          } else {
            console.warn('Could not resolve label for DELETE:', modification.label);
            return;
          }
        } else {
          return; // Invalid DELETE
        }
        break;

      default:
        return;
    }

    setContent({
      ...content,
      [category]: newItems.join('\n'),
    });

    // Remove the accepted modification from the message
    setMessages(prev =>
      prev.map(msg => {
        if (msg.modifications) {
          const newModifications = msg.modifications.filter(
            mod => !(mod.label === modification.label &&
                     mod.operation === modification.operation &&
                     mod.category === modification.category)
          );
          return {
            ...msg,
            modifications: newModifications.length > 0 ? newModifications : undefined,
          };
        }
        return msg;
      })
    );
  };

  const handleDenyModification = (messageId: string, modificationIndex: number) => {
    setMessages(prev =>
      prev.map(msg => {
        if (msg.id === messageId && msg.modifications) {
          const newModifications = msg.modifications.filter((_, idx) => idx !== modificationIndex);
          return {
            ...msg,
            modifications: newModifications.length > 0 ? newModifications : undefined,
          };
        }
        return msg;
      })
    );
  };

  const handleGenerateSample = async () => {
    setIsGeneratingSample(true);
    try {
      const response = await fetch('/api/generate-sample', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Failed to generate sample data');
      }

      const data = await response.json();
      setContent(data);
    } catch (error) {
      console.error('Error generating sample:', error);
      alert('Failed to generate sample data. Please make sure your OpenAI API key is set.');
    } finally {
      setIsGeneratingSample(false);
    }
  };

  const handleSendMessage = async (text: string) => {
    // Add user message
    const newMessage: Message = {
      id: Date.now().toString(),
      text: text,
      sender: 'user',
      timestamp: Date.now(),
    };
    setMessages(prev => [...prev, newMessage]);
    setIsLoading(true);

    try {
      // Format GACIOD content with labels for AI
      const formattedGACIOD = formatForAI({
        goals: content.goals,
        assumptions: content.assumptions,
        constraints: content.constraints,
        ideas: content.ideas,
        opinions: content.opinions,
        decisions: content.decisions,
      });

      // Call the unified API — the AI decides the response mode
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: [...messages, newMessage],
          gacIODContext: content,
          formattedGACIOD,
          additionalContext: context,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to get response from ChatGPT');
      }

      const data = await response.json();

      // Log the full ChatGPT response for debugging
      console.log('[ChatGPT Response]', data);

      // Check for API error response
      if (data.error) {
        throw new Error(data.error);
      }

      // Auto-apply ADD modifications when the matrix is empty or sparse
      let remainingModifications = data.modifications?.length > 0 ? data.modifications : undefined;
      if (remainingModifications) {
        const gaciodCategories: (keyof GACIODContent)[] = ['goals', 'assumptions', 'constraints', 'ideas', 'opinions', 'decisions'];
        const totalItems = gaciodCategories.reduce((sum, cat) => sum + parseItems(content[cat]).length, 0);
        const isSparse = totalItems <= 3;
        const updatedContent = { ...content };
        let didAutoApply = false;

        // Always auto-apply title ADD when the title is blank
        const titleAddMods = remainingModifications.filter(
          (m: Modification) => m.category === 'title' && m.operation === 'ADD' && m.newText && !content.title.trim()
        );
        if (titleAddMods.length > 0) {
          updatedContent.title = titleAddMods[0].newText!;
          didAutoApply = true;
          // Remove applied title mods from remaining
          remainingModifications = remainingModifications.filter(
            (m: Modification) => !(m.category === 'title' && m.operation === 'ADD' && m.newText && !content.title.trim())
          );
        }

        if (isSparse) {
          const addMods = remainingModifications.filter(
            (m: Modification) => m.operation === 'ADD' && m.newText && m.category !== 'title'
          );
          const nonAddMods = remainingModifications.filter(
            (m: Modification) => !(m.operation === 'ADD' && m.newText && m.category !== 'title')
          );

          if (addMods.length > 0) {
            for (const mod of addMods) {
              const category = mod.category as keyof GACIODContent;
              const existingItems = parseItems(updatedContent[category]);
              updatedContent[category] = [...existingItems, mod.newText].join('\n');
            }
            didAutoApply = true;
          }

          remainingModifications = nonAddMods.length > 0 ? nonAddMods : undefined;
        }

        if (didAutoApply) {
          setContent(updatedContent);
        }

        if (remainingModifications && remainingModifications.length === 0) {
          remainingModifications = undefined;
        }
      }

      // Build the display text: message + formatted feedback for structured modes
      let displayText = data.message || '';
      const hasFeedback = data.feedback && data.feedback.length > 0;
      if (hasFeedback) {
        // Format feedback items for display
        const feedbackText = data.feedback.map((item: any) => {
          const typeLabel = item.type ? item.type.charAt(0).toUpperCase() + item.type.slice(1) : 'Feedback';
          let text = `[${typeLabel}]\n`;
          if (item.quote) {
            text += `> "${item.quote}"\n`;
          }
          text += item.message || '';
          return text;
        }).join('\n\n');

        if (data.summary) {
          displayText = feedbackText + `\n\n---\n\n**Summary**\n${data.summary}`;
        } else {
          displayText = feedbackText;
        }
      }

      // Add assistant message
      const improvements = data.improvements?.length > 0 ? data.improvements : undefined;

      const assistantMessage: Message = {
        id: `${Date.now()}-assistant`,
        text: displayText || 'No response received',
        sender: 'assistant',
        timestamp: Date.now(),
        isStructured: hasFeedback,
        improvements,
        modifications: remainingModifications,
      };
      setMessages(prev => [...prev, assistantMessage]);
    } catch (error: any) {
      console.error('Error calling API:', error);
      let errorText = 'Sorry, I encountered an error. Please make sure your OpenAI API key is set in the environment variables.';

      if (error?.message?.includes('429') || error?.message?.includes('quota') || error?.message?.includes('rate')) {
        errorText = 'API rate limit exceeded. Please wait a moment and try again.';
      } else if (error?.message?.includes('401') || error?.message?.includes('API key')) {
        errorText = 'Invalid API key. Please check your OpenAI API key in the environment variables.';
      }

      const errorMessage: Message = {
        id: `${Date.now()}-error`,
        text: errorText,
        sender: 'system',
        timestamp: Date.now(),
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  // Compute highlighted indices per category from pending improvements and modifications
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
      // Highlight items targeted by pending improvements
      if (msg.improvements) {
        for (const imp of msg.improvements) {
          const category = imp.category.toLowerCase();
          if (category in highlights && content[category as keyof GACIODContent]) {
            const items = parseItems(content[category as keyof GACIODContent]);
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

      // Highlight items targeted by pending modifications
      if (msg.modifications) {
        for (const mod of msg.modifications) {
          const category = mod.category;
          if (category in highlights) {
            if (mod.label) {
              const resolved = resolveLabelToIndex(mod.label);
              if (resolved && resolved.category === category) {
                highlights[category].add(resolved.index);
              }
            }
            // For ADD operations, highlight the "next" position (visual indicator at the end)
            // We skip this since the item doesn't exist yet
          }
        }
      }
    }

    // Convert Sets to arrays
    const result: Record<string, number[]> = {};
    for (const [key, set] of Object.entries(highlights)) {
      result[key] = Array.from(set);
    }
    return result;
  }, [messages, content]);

  return (
    <div className="h-screen bg-[#E8EDF2] flex flex-col overflow-hidden">
      {/* Header */}
      <header className="h-12 sm:h-14 bg-white border-b border-gray-200 flex items-center px-4 sm:px-6 flex-shrink-0">
        <h1 className="text-base sm:text-lg font-semibold text-gray-800">Gasel</h1>

        {/* Toggle sidebar button - visible on smaller screens */}
        <button
          onClick={() => setShowSidebar(!showSidebar)}
          className="ml-auto mr-2 lg:hidden p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          aria-label={showSidebar ? 'Hide sidebar' : 'Show sidebar'}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            stroke="currentColor"
            className="w-5 h-5"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z"
            />
          </svg>
        </button>

        {/* Debug Menu */}
        <div className={`${showSidebar ? '' : 'ml-auto'} lg:ml-auto relative`}>
          <button
            onClick={() => setShowDebugMenu(!showDebugMenu)}
            className="px-2 sm:px-3 py-1.5 bg-gray-100 text-gray-600 text-xs font-medium rounded-lg hover:bg-gray-200 transition-colors flex items-center gap-1 sm:gap-2"
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
                d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
              />
            </svg>
            <span className="hidden sm:inline">Settings</span>
          </button>

          {showDebugMenu && (
            <div className="absolute right-0 mt-2 w-64 bg-white border border-gray-200 rounded-lg shadow-lg p-3 z-10">
              <div>
                <button
                  onClick={() => {
                    handleGenerateSample();
                    setShowDebugMenu(false);
                  }}
                  disabled={isGeneratingSample}
                  className="w-full px-3 py-2 bg-blue-600 text-white text-xs font-medium rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {isGeneratingSample ? (
                    <>
                      <svg
                        className="animate-spin h-3 w-3"
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
                      Generating...
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
                      Generate Sample
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      </header>

      {/* Main content */}
      <div className="flex-1 flex flex-col lg:flex-row p-3 sm:p-4 lg:p-6 gap-3 sm:gap-4 lg:gap-6 min-h-0 overflow-hidden">
        {/* Left side - GACIOD cards */}
        <div className="flex-1 flex flex-col gap-3 sm:gap-4 lg:gap-6 min-w-0 min-h-0 overflow-hidden">
          {/* Topic/Question input */}
          <div className="bg-white rounded-xl shadow-[0_1px_3px_rgba(0,0,0,0.05)] p-1 flex-shrink-0">
            <input
              type="text"
              value={content.title}
              onChange={(e) => setContent({ ...content, title: e.target.value })}
              placeholder="Question or Topic (e.g. What are some mechanics we need to consider for a matchmaking algorithm?)"
              className="w-full px-3 sm:px-4 py-2 sm:py-3 text-sm font-normal text-gray-800 bg-transparent focus:outline-none placeholder:text-gray-400 placeholder:font-normal"
            />
          </div>

          {/* GACIOD Grid */}
          <div className="flex-1 grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 gap-2 sm:gap-3 lg:gap-4 min-h-0 overflow-auto">
            {/* Top row */}
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

            {/* Bottom row */}
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

        {/* Right side - Context and Chat */}
        <div
          className={`${
            showSidebar ? 'flex' : 'hidden'
          } lg:flex w-full lg:w-72 xl:w-80 flex-col gap-3 sm:gap-4 flex-shrink-0 min-h-0 overflow-hidden max-h-[50vh] lg:max-h-none`}
        >
          {/* Context card */}
          <div className="bg-white rounded-xl shadow-[0_1px_3px_rgba(0,0,0,0.05)] p-3 sm:p-4 flex-shrink-0">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold text-gray-800">Context</h3>
            </div>
            <p className="text-xs font-normal text-gray-400 hidden sm:block">
              Adding context can provide more useful insights from the assistant.
            </p>
            <textarea
              value={context}
              onChange={(e) => setContext(e.target.value)}
              placeholder="Add additional context..."
              className="w-full mt-2 sm:mt-3 px-3 py-2 text-sm font-normal text-gray-700 bg-gray-50 rounded-lg resize-none focus:outline-none focus:ring-1 focus:ring-gray-300 h-16 sm:h-20"
            />
          </div>

          {/* Chat card */}
          <div className="bg-white rounded-xl shadow-[0_1px_3px_rgba(0,0,0,0.05)] flex-1 flex flex-col min-h-0 overflow-hidden">
            <div className="p-3 sm:p-4 border-b border-gray-100 flex-shrink-0">
              <h3 className="text-sm font-semibold text-gray-800">Chat</h3>
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
              />
            </div>
          </div>

          {/* Actions card */}
          <div className="bg-white rounded-xl shadow-[0_1px_3px_rgba(0,0,0,0.05)] p-3 sm:p-4 flex-shrink-0">
            <div className="grid grid-cols-3 gap-2 sm:gap-3">
              <button
                onClick={() => {
                  handleSendMessage('Review my GACIOD framework');
                }}
                disabled={isLoading}
                className="bg-gray-50 hover:bg-gray-100 rounded-lg p-2 sm:p-3 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex flex-col items-center justify-center gap-1 sm:gap-2"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={1.5}
                  stroke="currentColor"
                  className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z"
                  />
                </svg>
                <p className="text-[10px] sm:text-xs font-medium text-gray-600">Review</p>
              </button>
              <button
                onClick={() => {
                  handleSendMessage('Find gaps in my GACIOD framework');
                }}
                disabled={isLoading}
                className="bg-gray-50 hover:bg-gray-100 rounded-lg p-2 sm:p-3 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex flex-col items-center justify-center gap-1 sm:gap-2"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={1.5}
                  stroke="currentColor"
                  className="w-4 h-4 sm:w-5 sm:h-5 text-orange-600"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607zM10.5 7.5v6m3-3h-6"
                  />
                </svg>
                <p className="text-[10px] sm:text-xs font-medium text-gray-600">Find Gaps</p>
              </button>
              <button
                onClick={() => {
                  handleSendMessage('Suggest improvements for my GACIOD framework');
                }}
                disabled={isLoading}
                className="bg-gray-50 hover:bg-gray-100 rounded-lg p-2 sm:p-3 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex flex-col items-center justify-center gap-1 sm:gap-2"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={1.5}
                  stroke="currentColor"
                  className="w-4 h-4 sm:w-5 sm:h-5 text-green-600"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z"
                  />
                </svg>
                <p className="text-[10px] sm:text-xs font-medium text-gray-600">Improve</p>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
