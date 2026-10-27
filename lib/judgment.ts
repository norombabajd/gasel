/**
 * Judgment Labs monitoring for Gazelle's AI chat.
 *
 * Every /api/chat turn is recorded as one trace so that judges configured in
 * Judgment (see scripts/create-judgment-judges.ts) can grade the conversation.
 *
 * Privacy:
 * - Monitoring is OFF unless JUDGMENT_API_KEY, JUDGMENT_ORG_ID and
 *   JUDGMENT_ID_SALT are all set. With any of them missing, nothing is sent.
 * - Student and session IDs are replaced with salted HMAC pseudonyms. Keep the
 *   salt private: with it (and the DB) you can re-link pseudonyms to students
 *   for research analysis; without it, Judgment cannot.
 * - The student's name and email, plus any email addresses and phone numbers
 *   in chat text, are replaced with placeholders before leaving the server.
 *   Free text can still contain other identifying details students type, so
 *   confirm your IRB protocol covers this before enabling it in a real course.
 */
import { createHmac } from 'node:crypto';

type JudgevalModule = typeof import('judgeval');

export const CHAT_MODEL = 'gpt-5-mini-2025-08-07';

const MONITORING_ENABLED = Boolean(
  process.env.JUDGMENT_API_KEY &&
    process.env.JUDGMENT_ORG_ID &&
    process.env.JUDGMENT_ID_SALT,
);

let initPromise: Promise<JudgevalModule | null> | null = null;

function getJudgeval(): Promise<JudgevalModule | null> {
  if (!MONITORING_ENABLED) return Promise.resolve(null);
  if (!initPromise) {
    initPromise = (async () => {
      try {
        const mod = await import('judgeval');
        await mod.Tracer.init({
          projectName: process.env.JUDGMENT_PROJECT_NAME || 'gazelle',
          environment:
            process.env.JUDGMENT_ENVIRONMENT ||
            process.env.VERCEL_ENV ||
            process.env.NODE_ENV ||
            'development',
        });
        return mod;
      } catch (err) {
        console.error('[judgment] Tracer init failed; monitoring disabled for this process.', err);
        return null;
      }
    })();
  }
  return initPromise;
}

/** Stable, non-reversible (without the salt) ID like `student_3f9a0c2b7d1e4a65`. */
export function pseudonymize(kind: 'student' | 'session', rawId: string): string {
  const salt = process.env.JUDGMENT_ID_SALT || '';
  const digest = createHmac('sha256', salt).update(`${kind}:${rawId}`).digest('hex');
  return `${kind}_${digest.slice(0, 16)}`;
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Build a redactor that strips the student's own name/email and common contact details. */
export function makeRedactor(student: { name?: string | null; email?: string | null }) {
  const nameParts = (student.name || '')
    .split(/\s+/)
    .map((p) => p.trim())
    .filter((p) => p.length >= 2);
  const fullName = (student.name || '').trim();
  const patterns: RegExp[] = [];
  if (fullName.includes(' ')) patterns.push(new RegExp(`\\b${escapeRegExp(fullName)}\\b`, 'gi'));
  for (const part of nameParts) patterns.push(new RegExp(`\\b${escapeRegExp(part)}\\b`, 'gi'));
  const email = (student.email || '').trim();

  return (text: unknown): string => {
    if (typeof text !== 'string') return '';
    let out = text;
    if (email) out = out.split(email).join('[STUDENT_EMAIL]');
    out = out.replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[EMAIL]');
    out = out.replace(/(?:\+?\d{1,2}[\s.-]?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}\b/g, '[PHONE]');
    for (const re of patterns) out = out.replace(re, '[STUDENT]');
    return out;
  };
}

export interface ChatTurnMeta {
  student: { id: string; name?: string | null; email?: string | null };
  /** Gazelle chat session id (from the client); falls back to the student id. */
  sessionId?: string | null;
  phase: 'onboarding' | 'workspace';
  onboardingStep?: string | null;
  messages: Array<{ sender?: string; text?: string }>;
  topic?: string | null;
  formattedGACIOD?: string | null;
}

export interface ChatTurnResult {
  status: number;
  body: Record<string, unknown>;
}

/**
 * Run one chat turn inside a Judgment trace. If monitoring is disabled or the
 * SDK fails, `run` still executes normally — tracing never breaks the chat.
 */
export async function traceChatTurn(
  meta: ChatTurnMeta,
  run: () => Promise<ChatTurnResult>,
): Promise<ChatTurnResult> {
  const jv = await getJudgeval();
  if (!jv) return run();

  const { Tracer } = jv;
  const redact = makeRedactor(meta.student);

  const traced = Tracer.observe(
    async (): Promise<ChatTurnResult> => {
      try {
        const studentPseudo = pseudonymize('student', meta.student.id);
        const sessionPseudo = pseudonymize('session', meta.sessionId || `nosession:${meta.student.id}`);
        Tracer.setCustomerUserId(studentPseudo);
        Tracer.setSessionId(sessionPseudo);

        const conversation = meta.messages
          .filter((m) => m && (m.sender === 'user' || m.sender === 'assistant'))
          .map((m) => ({
            role: m.sender === 'user' ? 'student' : 'gazelle',
            text: redact(m.text),
          }));
        const studentTurns = conversation.filter((m) => m.role === 'student').length;

        Tracer.setAttributes({
          'gazelle.phase': meta.phase,
          'gazelle.onboarding_step': meta.onboardingStep || '',
          'gazelle.turn_index': studentTurns,
          'gazelle.ai_initiated': conversation[0]?.role === 'gazelle',
        });
        Tracer.setInput({
          phase: meta.phase,
          onboarding_step: meta.onboardingStep || null,
          topic: meta.topic ? redact(meta.topic) : null,
          gaciod_matrix: meta.formattedGACIOD ? redact(meta.formattedGACIOD) : null,
          conversation,
        });
      } catch (err) {
        console.error('[judgment] Failed to annotate trace:', err);
      }

      const result = await run();

      try {
        const b = result.body as Record<string, unknown>;
        const usage = b.usage as { prompt_tokens?: number; completion_tokens?: number } | undefined;
        Tracer.setAttributes({
          'gazelle.mode': String(b.mode ?? ''),
          'gazelle.status': result.status,
        });
        Tracer.recordLLMMetadata({
          provider: 'openai',
          model: CHAT_MODEL,
          non_cached_input_tokens: usage?.prompt_tokens ?? null,
          output_tokens: usage?.completion_tokens ?? null,
        });
        const { usage: _omit, ...rest } = b;
        void _omit;
        Tracer.setOutput(JSON.parse(redact(JSON.stringify(rest))));
      } catch (err) {
        console.error('[judgment] Failed to record trace output:', err);
      }
      return result;
    },
    { spanType: 'agent', spanName: 'gazelle_chat_turn', recordInput: false, recordOutput: false },
  );

  try {
    return await traced();
  } finally {
    flushInBackground(Tracer);
  }
}

/** Serverless functions can freeze after responding, so flush after the response is sent. */
function flushInBackground(Tracer: JudgevalModule['Tracer']) {
  const flush = () =>
    Tracer.forceFlush().catch((err: unknown) => console.error('[judgment] flush failed:', err));
  import('next/server')
    .then(({ after }) => after(flush))
    .catch(() => void flush());
}
