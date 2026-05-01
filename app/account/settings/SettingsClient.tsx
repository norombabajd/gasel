'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { authClient } from '@/lib/auth/client';
import ChatSidebar from '@/components/ChatSidebar';
import { ChatSession, GACIODContent } from '@/lib/chatStorage';
import { Message } from '@/components/Chat';
import { deleteSession as deleteDbSession } from '@/app/actions';

function emptyContent(): GACIODContent {
  return { title: '', goals: '', assumptions: '', constraints: '', ideas: '', opinions: '', decisions: '' };
}

function toSession(row: any): ChatSession {
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

interface SettingsClientProps {
  initialSessions: any[];
}

export default function SettingsClient({ initialSessions }: SettingsClientProps) {
  const { data: sessionData, isPending } = authClient.useSession();
  const user = sessionData?.user;
  const router = useRouter();

  const [sessions, setSessions] = useState<ChatSession[]>(
    () => initialSessions.map(toSession),
  );
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (user?.name) setName(user.name);
  }, [user?.name]);

  const handleUpdateName = async () => {
    if (!name.trim() || name === user?.name) return;
    setSaving(true);
    try {
      await authClient.updateUser({ name: name.trim() });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch {
      // handle error silently
    } finally {
      setSaving(false);
    }
  };

  const handleSignOut = async () => {
    await authClient.signOut();
    router.push('/auth/sign-in');
  };

  const handleDeleteSession = async (id: string) => {
    setSessions((prev) => prev.filter((s) => s.id !== id));
    await deleteDbSession(id);
  };

  if (isPending) {
    return (
      <div className="min-h-screen bg-[#E8EDF2] flex items-center justify-center">
        <div className="text-gray-400 text-sm">Loading...</div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-[#E8EDF2] flex flex-row overflow-hidden">
      {/* Chat sidebar */}
      <ChatSidebar
        sessions={sessions}
        activeSessionId=""
        onNewChat={() => router.push('/')}
        onSelectSession={() => router.push('/')}
        onDeleteSession={handleDeleteSession}
        isOpen={sidebarOpen}
        onToggle={() => setSidebarOpen(!sidebarOpen)}
        onOpenSettings={() => {}}
      />

      {/* Settings content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Settings header */}
        <div className="h-12 sm:h-14 flex items-center px-6 flex-shrink-0">
          <h1 className="text-sm sm:text-base font-bold text-black-500 whitespace-nowrap">
            Gasel
          </h1>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto">
          <div className="w-full max-w-2xl mx-auto py-4 px-6">
            {/* Profile section */}
            <section className="mb-10">
              <h2 className="text-sm font-semibold text-gray-900 mb-3">Profile</h2>
              <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-200">
                <div className="p-4 flex items-center justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <label className="text-xs text-gray-500 block mb-1">Full name</label>
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      onBlur={handleUpdateName}
                      onKeyDown={(e) => { if (e.key === 'Enter') handleUpdateName(); }}
                      className="w-full text-sm text-gray-900 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-gray-300 focus:border-transparent"
                    />
                  </div>
                  {saving && <span className="text-xs text-gray-400">Saving...</span>}
                  {saved && <span className="text-xs text-green-600">Saved</span>}
                </div>
                <div className="p-4">
                  <label className="text-xs text-gray-500 block mb-1">Email</label>
                  <div className="text-sm text-gray-900 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
                    {user?.email || '-'}
                  </div>
                </div>
              </div>
            </section>

            {/* Security section */}
            <section className="mb-10">
              <h2 className="text-sm font-semibold text-gray-900 mb-3">Security</h2>
              <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-200">
                <div className="p-4 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-900">Password & Active sessions</p>
                    <p className="text-xs text-gray-500 mt-0.5">Change your account password and manage active sessions.</p>
                  </div>
                  <button
                    onClick={() => router.push('/account/security')}
                    className="text-sm text-gray-600 hover:text-gray-900 bg-gray-100 hover:bg-gray-200 px-3 py-1.5 rounded-lg transition-colors"
                  >
                    Change
                  </button>
                </div>
                
              </div>
            </section>

            {/* Account section */}
            <section className="mb-10">
              <h2 className="text-sm font-semibold text-gray-900 mb-3">Account</h2>
              <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-200">
                <div className="p-4 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-900">Sign out</p>
                    <p className="text-xs text-gray-500 mt-0.5">Sign out of your account on this device</p>
                  </div>
                  <button
                    onClick={handleSignOut}
                    className="text-sm text-red-600 hover:text-red-700 bg-red-50 hover:bg-red-100 px-3 py-1.5 rounded-lg transition-colors"
                  >
                    Sign out
                  </button>
                </div>
              </div>
            </section>
            
            {/* About section */}
            <section className="mb-10">
              <h2 className="text-sm font-semibold text-gray-900 mb-3">About</h2>
              <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-200">
                <div className="p-4">
                  <p className="text-sm font-medium text-gray-900">Created by</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    John Daniel Norombaba &mdash;{' '}
                    <a href="mailto:jnoromba@uci.edu" className="text-blue-600 hover:underline">
                      jnoromba@uci.edu
                    </a>
                  </p>
                </div>
                <div className="p-4">
                  <p className="text-sm font-medium text-gray-900">Disclaimer</p>
                  <p className="text-xs text-gray-500 leading-relaxed">
                    This is a research project developed at the University of California, Irvine. It is intended for academic and research purposes only.
                  </p>
                </div>
                <div className="p-4">
                  <p className="text-sm font-medium text-gray-900">Model</p>
                  <p className="text-xs text-gray-500 leading-relaxed">
                    gpt-5-nano-2025-08-07
                  </p>
                </div>
              </div>
            </section>

          </div>
        </div>
      </div>
    </div>
  );
}
