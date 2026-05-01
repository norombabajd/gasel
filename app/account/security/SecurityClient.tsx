'use client';

import { useRouter } from 'next/navigation';
import { SecuritySettingsCards } from '@neondatabase/auth/react';

export default function SecurityClient() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-[#E8EDF2] flex flex-col">
      {/* Top bar */}
      <div className="h-14 border-b border-gray-200 bg-white flex items-center px-6 flex-shrink-0">
        <button
          onClick={() => router.push('/account/settings')}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors"
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
          </svg>
          <span className="text-sm font-medium">Settings</span>
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto py-8 px-6">
          <h1 className="text-lg font-semibold text-gray-900 mb-6">Security</h1>
          <SecuritySettingsCards />
        </div>
      </div>
    </div>
  );
}
