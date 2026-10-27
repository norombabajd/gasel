import Link from 'next/link';
import {
  IconMessages,
  IconWand,
  IconChevronRight,
} from '@tabler/icons-react';

export const dynamic = 'force-dynamic';

const PAGES = [
  {
    href: '/debug/messages',
    icon: IconMessages,
    title: 'Messages',
    description:
      'Component gallery — every chat UI element rendered with sample data: message bubbles, feedback cards, improvement and modification cards, GACIOD cards, sidebar, and input states.',
  },
  {
    href: '/debug/demo',
    icon: IconWand,
    title: 'Demo',
    description:
      'Wizard-of-Oz demo workspace — build scripted chats for marketing and demos. Compose messages, attach modification cards, and queue assistant replies that play back as people type.',
  },
];

export default function DebugMenuPage() {
  return (
    <div className="min-h-screen bg-[#E8EDF2]">
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <h1 className="font-display text-2xl tracking-tight text-gray-900">Debug</h1>
        <p className="text-sm text-gray-500 mt-1">
          Internal pages for development, testing, and demos. No login required.
        </p>
      </div>

      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10 space-y-4">
        {PAGES.map(({ href, icon: Icon, title, description }) => (
          <Link
            key={href}
            href={href}
            className="group flex items-start gap-4 bg-white rounded-2xl shadow-[0_1px_3px_rgba(0,0,0,0.05)] border border-gray-200 p-5 hover:border-gray-300 hover:shadow-[0_2px_8px_rgba(0,0,0,0.08)] transition-all"
          >
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gray-900 text-white">
              <Icon className="w-5.5 h-5.5" stroke={1.75} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-1.5">
                <span className="font-display text-lg text-gray-900">{title}</span>
                <span className="text-xs text-gray-400 font-mono">{href}</span>
              </span>
              <span className="block text-sm text-gray-500 mt-1 leading-relaxed">{description}</span>
            </span>
            <IconChevronRight
              className="w-5 h-5 mt-3 shrink-0 text-gray-300 group-hover:text-gray-500 group-hover:translate-x-0.5 transition-all"
              stroke={2}
            />
          </Link>
        ))}
      </div>
    </div>
  );
}
