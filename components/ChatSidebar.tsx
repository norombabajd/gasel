'use client';

import { useState, useRef, useEffect } from 'react';
import { ChatSession, deriveTitle } from '@/lib/chatStorage';
import { authClient } from '@/lib/auth/client';
import { useRouter } from 'next/navigation';
import { IconMenu2, IconMessagePlus } from '@tabler/icons-react';

interface ChatSidebarProps {
  sessions: ChatSession[];
  activeSessionId: string;
  onNewChat: () => void;
  onSelectSession: (id: string) => void;
  onDeleteSession: (id: string) => void;
  isOpen: boolean;
  onToggle: () => void;
  onOpenSettings: () => void;
}

export default function ChatSidebar({
  sessions,
  activeSessionId,
  onNewChat,
  onSelectSession,
  onDeleteSession,
  isOpen,
  onToggle,
  onOpenSettings,
}: ChatSidebarProps) {
  const { data: sessionData } = authClient.useSession();
  const user = sessionData?.user;
  const router = useRouter();
  const [showUserMenu, setShowUserMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowUserMenu(false);
      }
    };
    if (showUserMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showUserMenu]);

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const handleSignOut = async () => {
    await authClient.signOut();
    router.refresh();
  };

  return (
    <div className="h-full flex flex-row flex-shrink-0">
      {/* Icon rail - always visible */}
      <div className="w-16 bg-gray-50 border-r border-gray-200 flex flex-col items-stretch py-3 px-2 gap-2 flex-shrink-0">
        {/* Hamburger toggle */}
        <button
          onClick={onToggle}
          className="flex flex-col items-center gap-1 py-2 rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors"
          aria-label={isOpen ? 'Close chat list' : 'Open chat list'}
        >
          <IconMenu2 className="w-5 h-5" stroke={2} />
          <span className="font-display text-[11px] leading-none">Menu</span>
        </button>

        {/* New chat */}
        <button
          onClick={onNewChat}
          className="flex flex-col items-center gap-1 py-2 rounded-lg bg-gray-900 text-white hover:bg-gray-800 transition-colors"
          aria-label="New chat"
        >
          <IconMessagePlus className="w-5 h-5" stroke={2} />
          <span className="font-display text-[11px] leading-none text-center">New<br />Chat</span>
        </button>

        <div className="flex-1" />
      </div>

      {/* Expandable chat list panel */}
      <div
        className={`h-full bg-white border-r border-gray-200 flex flex-col transition-[width] duration-200 overflow-hidden ${
          isOpen ? 'w-56' : 'w-0 border-r-0'
        }`}
      >
        {/* Panel header */}
        <div className="h-12 sm:h-14 flex items-center px-4 border-b border-gray-200 flex-shrink-0 min-w-[14rem]">
          <span className="text-sm font-semibold text-gray-800">Chats</span>
        </div>

        {/* Sessions list */}
        <div className="flex-1 overflow-y-auto px-2 py-2 min-w-[14rem]">
          {sessions.length === 0 ? (
            <p className="text-xs text-gray-400 text-center mt-4">No chats yet</p>
          ) : (
            <div className="space-y-0.5">
              {sessions.map((session) => {
                const isActive = session.id === activeSessionId;
                const title = deriveTitle(session);
                return (
                  <div
                    key={session.id}
                    className={`group flex items-center rounded-lg cursor-pointer transition-colors ${
                      isActive
                        ? 'bg-gray-100'
                        : 'hover:bg-gray-50'
                    }`}
                  >
                    <button
                      onClick={() => onSelectSession(session.id)}
                      className="flex-1 min-w-0 px-3 py-2 text-left"
                    >
                      <p className={`text-sm truncate ${isActive ? 'font-medium text-gray-900' : 'font-normal text-gray-700'}`}>
                        {title}
                      </p>
                      <p className="text-[10px] text-gray-400 mt-0.5">
                        {formatDate(session.updatedAt)}
                      </p>
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteSession(session.id);
                      }}
                      className="p-1.5 mr-1 text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all flex-shrink-0"
                      aria-label="Delete chat"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-3.5 h-3.5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                      </svg>
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* User profile section at bottom of panel */}
        {user && (
          <div className="relative border-t border-gray-200 min-w-[14rem] flex-shrink-0" ref={menuRef}>
            <button
              onClick={() => setShowUserMenu(!showUserMenu)}
              className="w-full flex items-center gap-2.5 px-3 py-2.5 hover:bg-gray-50 transition-colors"
            >
              <div className="flex-1 min-w-0 text-left">
                <p className="text-sm font-medium text-gray-900 truncate">
                  {user.name || 'User'}
                </p>
                <p className="text-[11px] text-gray-500 truncate">
                  {user.email}
                </p>
              </div>
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4 text-gray-400 shrink-0">
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H8.25m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H12m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0h-.375M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
              </svg>
            </button>

            {/* User dropdown menu */}
            {showUserMenu && (
              <div className="absolute bottom-full left-0 right-0 mb-1 mx-2 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-50">
                <button
                  onClick={() => {
                    setShowUserMenu(false);
                    router.push('/account/settings');
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 0 1 0 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 0 1-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 0 1-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 0 1 0-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 0 1-.26-1.43l1.297-2.247a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0z" />
                  </svg>
                  Settings
                </button>
                <button
                  onClick={() => {
                    setShowUserMenu(false);
                    handleSignOut();
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0 0 13.5 3h-6a2.25 2.25 0 0 0-2.25 2.25v13.5A2.25 2.25 0 0 0 7.5 21h6a2.25 2.25 0 0 0 2.25-2.25V15m3 0 3-3m0 0-3-3m3 3H9" />
                  </svg>
                  Log out
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
