/**
 * Creates (or updates) Gazelle's four Judgment judges.
 *
 *   npx tsx --env-file=.env.local scripts/create-judgment-judges.ts
 *
 * Needs JUDGMENT_API_KEY and JUDGMENT_ORG_ID (and optionally
 * JUDGMENT_PROJECT_NAME, default "gazelle"). Judges that already exist are
 * skipped, so it is safe to re-run.
 *
 * After running, open each judge in the Judgment UI and set it to
 * "Continuous" so it grades new traces automatically.
 *
 * Every trace is one chat turn (span "gazelle_chat_turn"). Its input holds the
 * whole conversation so far (roles "student" / "gazelle"), the phase
 * ("onboarding" or "workspace"), and the student's GACIOD matrix; its output is
 * Gazelle's structured JSON reply for this turn.
 */
import { Judgeval } from 'judgeval';

const SHARED_CONTEXT = `You are evaluating one turn of a conversation between a university student and Gazelle, an AI thinking partner for software design courses. Gazelle helps students fill in a GACIOD matrix: Goals, Assumptions, Constraints, Ideas, Opinions, Decisions. Its intended teaching style is Socratic: it should guide students to discover insights through questions rather than hand them finished answers.

The trace input contains:
- "phase": "onboarding" (a short guided setup where Gazelle leads) or "workspace" (open-ended help).
- "conversation": every message so far, in order, with role "student" or "gazelle". The last "student" message is the one being answered in this turn.
- "gaciod_matrix": the student's current matrix, if any.
The trace output is Gazelle's reply for this turn: a "message", plus optional "feedback", "modifications" (proposed matrix items), and "improvements" (rewrites).`;

const JUDGES = [
  {
    name: 'gazelle-asks-instead-of-tells',
    judgeDescription: "Did Gazelle guide with questions instead of handing over answers the student didn't ask for?",
    scoreType: 'binary' as const,
    prompt: `${SHARED_CONTEXT}

Question: In THIS turn's output, did Gazelle respect its Socratic role?

Return Pass when either:
- Gazelle mainly guided the student with probing questions, observations or considerations that leave the thinking to the student; or
- The student's latest message explicitly asked Gazelle to generate, fill in, add, rewrite or improve specific content, and Gazelle supplied that content. This is intended behaviour, not a failure. During the onboarding walkthrough, Gazelle proposing 2-3 Goals/Assumptions/Constraints is also intended.

Return Fail when Gazelle handed the student finished answers, decisions or matrix content they did not ask for, or answered a reflective question ("is this a good assumption?", "what am I missing?") by simply telling them what to write instead of helping them reason about it.

In your reasoning, quote the student's latest message and the part of Gazelle's reply that decided your verdict.`,
  },
  {
    name: 'gazelle-gaciod-focus',
    judgeDescription: 'Which GACIOD category did Gazelle push the student toward in this turn?',
    scoreType: 'categorical' as const,
    categories: [
      { name: 'Goals', description: 'Mainly about what the design should achieve.' },
      { name: 'Assumptions', description: 'Mainly about beliefs the student is taking for granted.' },
      { name: 'Constraints', description: 'Mainly about limits: time, budget, technology, policy, users.' },
      { name: 'Ideas', description: 'Mainly about candidate solutions or alternatives.' },
      { name: 'Opinions', description: "Mainly about evaluating or weighing ideas, or stakeholders' views." },
      { name: 'Decisions', description: 'Mainly about choosing between alternatives and recording why.' },
      { name: 'Multiple', description: 'Substantially covers two or more categories with no single focus.' },
      { name: 'None', description: 'Small talk, setup, or topic-framing with no GACIOD category in focus.' },
    ],
    prompt: `${SHARED_CONTEXT}

Question: Which ONE GACIOD category did Gazelle's reply in THIS turn primarily direct the student's attention to? Judge by where the questions, feedback or proposed items point, not by which categories already exist in the matrix. Use "Multiple" only when no single category clearly dominates, and "None" for replies that do not engage any category (e.g. agreeing on the project topic). Explain briefly which parts of the reply led to your choice.`,
  },
  {
    name: 'gazelle-ai-initiated',
    judgeDescription: 'Did Gazelle open the conversation itself, rather than waiting for the student?',
    scoreType: 'binary' as const,
    prompt: `${SHARED_CONTEXT}

Question: Did Gazelle start this conversation proactively?

Return Pass if the FIRST message in "conversation" has role "gazelle" and is an opener that invites the student in (e.g. a greeting that asks what they are working on, or an introduction that tells them what Gazelle can help with).
Return Fail if the first message is from the student, or if Gazelle's first message is only a generic error or placeholder.

Only the start of the conversation matters for this judge; ignore the rest.`,
  },
  {
    name: 'gazelle-student-depth',
    judgeDescription: "How much reasoning is the student putting into their messages?",
    scoreType: 'categorical' as const,
    categories: [
      { name: 'Deep', description: 'The student explains reasoning, trade-offs, evidence or alternatives in their own words.' },
      { name: 'Moderate', description: 'The student adds some specifics or partial reasons but little justification.' },
      { name: 'Shallow', description: 'Short commands, one-word replies, or accepting suggestions with no reasoning ("ok", "add goals", "yes").' },
      { name: 'Too early', description: 'The student has written only one short message so far, so depth cannot be judged yet.' },
    ],
    prompt: `${SHARED_CONTEXT}

Question: Judging only the STUDENT's messages in "conversation" (ignore Gazelle's messages and the matrix), how deeply is the student engaging with the design problem so far? Weight the most recent student messages more heavily, and note in your reasoning whether depth is rising, falling or flat across the conversation.

Do not reward length alone: a long message that only pastes requirements is not deep reasoning. Quote one or two student phrases that support your choice.`,
  },
];

async function main() {
  const projectName = process.env.JUDGMENT_PROJECT_NAME || 'gazelle';
  const client = await Judgeval.create({ projectName });

  for (const j of JUDGES) {
    const options = {
      name: j.name,
      prompt: j.prompt,
      scoreType: j.scoreType,
      judgeDescription: j.judgeDescription,
      reasoningLevel: 'normal' as const,
      ...('categories' in j ? { categories: j.categories } : {}),
    };
    try {
      const judge = await client.agentJudges.create(options);
      if (!judge) throw new Error(`Project "${projectName}" could not be resolved. Check your API key, org ID and project name.`);
      console.log(`created  ${judge.name}  (${judge.judgeId})`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (!/exist|duplicate|conflict|409/i.test(msg)) throw err;
      console.log(`exists   ${j.name}: update its prompt in the Judgment UI, or delete it and re-run.`);
    }
  }
  console.log('\nNext: open each judge in Judgment and set it to "Continuous".');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
