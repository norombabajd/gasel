import { AuthView } from '@neondatabase/auth/react';

export const dynamicParams = false;

export default async function AuthPage({
  params,
}: {
  params: Promise<{ path: string }>;
}) {
  const { path } = await params;
  return (
    <main className="min-h-screen flex items-center justify-center bg-[#E8EDF2] p-4 md:p-6">
      <AuthView path={path} />
    </main>
  );
}
