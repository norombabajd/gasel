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
      <div className="w-full max-w-sm flex flex-col items-center gap-6">
        {/* Gazelle branding */}
        <div className="flex flex-col items-center text-center gap-3">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gray-900 text-white shadow-[0_1px_3px_rgba(0,0,0,0.12)]">
            <span className="font-display text-2xl leading-none italic">g</span>
          </span>
          <div>
            <h1 className="text-2xl font-medium text-gray-900 whitespace-nowrap">
              the <span className="font-display font-normal">gazelle</span> workspace
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              Turn an idea into a plan with the GACIOD framework.
            </p>
          </div>
        </div>

        <div className="w-full">
          <AuthView path={path} />
        </div>

        {/* No-account reassurance */}
        <p className="text-center text-xs text-gray-400 px-2 leading-relaxed">
          No account yet? No problem — enter your email and we&apos;ll create one
          automatically when you sign in.
        </p>
      </div>
    </main>
  );
}
