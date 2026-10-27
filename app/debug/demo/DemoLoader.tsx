'use client';

import dynamic from 'next/dynamic';

// The demo stores its dummy chats in localStorage, so it must never render on
// the server — load it client-only.
const DemoClient = dynamic(() => import('./DemoClient'), {
  ssr: false,
  loading: () => <div className="h-screen bg-[#E8EDF2]" />,
});

export default function DemoLoader() {
  return <DemoClient />;
}
