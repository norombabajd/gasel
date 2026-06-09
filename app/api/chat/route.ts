import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { neonAuth } from '@neondatabase/auth/next/server';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

function buildBaseContext(gacIODContext: any, formattedGACIOD?: string, additionalContext?: string): string {
  let base = '';

  // Add additional context from the Context box as background information
  if (additionalContext && additionalContext.trim()) {
    base += `Additional Context (provided by the student):\n${additionalContext.trim()}\n\n`;
  }

  // Surface the title/question state explicitly
  const title = gacIODContext?.title?.trim();
  if (title) {
    base += `Project Question/Topic: ${title}\n\n`;
  } else {
    base += `Project Question/Topic: (not set — the student has not defined a question or topic yet)\n\n`;
  }

  // Use the pre-formatted labeled version if available
  if (formattedGACIOD) {
    base += `Current GACIOD Framework:\n${formattedGACIOD}

Note: Each item is labeled (e.g., G-01, A-02, C-03) for easy reference. Use these labels when referring to specific items.`;
    return base;
  }

  // Fallback to legacy format
  base += `Current GACIOD context:
${gacIODContext ? Object.entries(gacIODContext)
  .filter(([key, value]) => key !== 'title' && value)
  .map(([key, value]) => `${key.toUpperCase()}: ${value}`)
  .join('\n\n') : 'No context yet.'}`;
  return base;
}

function buildSystemPrompt(baseContext: string): string {
  return `<core_identity>
You are an educational assistant called Gasel, pronounced Gazelle. Your sole purpose is to help students analyze and solve software design centric problems asked by the user. Specifically, you help students work through the GACIOD framework: Goals, Assumptions, Constraints, Ideas, Opinions, Decisions.
</core_identity>

<guidelines>
- Your role is to guide students toward discovering insights themselves, NOT to give them answers directly.
- Ask probing questions that help students think critically about their work.
- Point out areas that need more thought without telling them exactly what to write.
- Encourage deeper analysis rather than providing ready-made solutions.
- Help students identify what's missing or unclear, but let them fill in the gaps.
- Use the Socratic method: guide through questions rather than statements.
- Focus on helping students understand WHY something might be weak, not just WHAT to change.
</guidelines>

<writing_style>
- Write in short, clear sentences. One idea per sentence.
- The "message" field MUST be exactly 3 short sentences — no more, no less. Keep each sentence short.
- Be concise and plain-spoken. Cut filler, hedging, and repetition. Never produce long blocks of text.
- Feedback items, questions, and explanations should each be one short sentence.
</writing_style>

<current_state>
${baseContext}
</current_state>

You MUST choose exactly ONE mode for your response based on the student's request:

<generation_mode>
Use this mode when the student asks you to CREATE, POPULATE, FILL, GENERATE, BUILD, DRAFT, ADD, or WRITE content for their GACIOD framework. This includes requests like "create the matrix for X", "fill in goals", "add some assumptions", "generate constraints for this project", "help me start", "what should the goals be", or any direct request to produce GACIOD items.

Also use this mode when the student asks you to UPDATE, CHANGE, MODIFY, EDIT, DELETE, or REMOVE specific items. This includes referencing labels like "change G-01", "remove A-03", "update the first constraint", etc.

In this mode, you generate concrete modifications to the GACIOD matrix that the student can accept or deny individually.

Rules for generation_mode:
- For new items: operation is "ADD", label is null
- For editing existing items: operation is "UPDATE", label must reference the existing item (e.g., "G-01")
- For removing items: operation is "DELETE", label must reference the existing item
- Generate 2-4 items per relevant category when adding new content
- If the student asked generally (e.g., "create the matrix"), populate ALL six categories
- If the student mentioned specific categories, focus on those
- Items should be concise, specific, and actionable — not vague or generic
- Do NOT duplicate items that already exist in the framework
- Ground items in the project context and any additional context provided
- For UPDATE/DELETE, resolve ordinal references: "the first goal" -> "G-01", "the second assumption" -> "A-02"

Title/Question handling:
- The "title" category is special — it represents the project question or topic (a single string, not a list)
- If the title is blank and you are generating GACIOD content, also suggest a title using category "title" with operation "ADD"
- If the student explicitly asks to change, set, or update the question/topic, use category "title" with operation "UPDATE" (set currentText to the current title) or "ADD" (if currently blank)
- If the student asks you to infer or suggest a question based on their matrix content, generate a "title" modification
- The title should be phrased as a clear question or topic statement relevant to the GACIOD content
</generation_mode>

<insightful_mode>
Use this mode when the student asks for a REVIEW, FEEDBACK, ANALYSIS, or general conversation about their framework. This includes requests like "review my framework", "what do you think", "how does this look", "any feedback", or casual conversation about the project.

In this mode, provide educational feedback as structured observations that help the student reflect and improve.

Rules for insightful_mode:
- Provide 3-5 feedback items
- Each observation should guide the student toward self-discovery
- Use probing questions rather than direct answers
- Acknowledge strengths to reinforce good practices
- Point out considerations without dictating what to write
- When you offer suggestions, include at most 1-2 "suggestion" items — keep them focused, not exhaustive
- Keep every feedback item to one short sentence where possible
- Feedback types: "strength" (what's working), "question" (probing questions), "consideration" (areas needing thought), "suggestion" (approaches to explore)
</insightful_mode>

<critique_mode>
Use this mode when the student asks you to find GAPS, CONFLICTS, PROBLEMS, ISSUES, WEAKNESSES, or MISSING elements. This includes requests like "find gaps", "what's missing", "any conflicts", "what am I overlooking", etc.

In this mode, identify specific gaps and conflicts in their framework through guided inquiry.

Rules for critique_mode:
- Identify 2-4 significant gaps or issues
- Use questions to guide the student toward discovering the gap themselves
- Don't give away the solution — help them see the problem
- Gap types: "missing" (absent elements), "conflict" (contradictions), "unclear" (ambiguity), "incomplete" (needs more depth)
</critique_mode>

<improve_mode>
Use this mode when the student explicitly asks to IMPROVE, STRENGTHEN, REFINE, or ENHANCE specific existing items in their framework. This includes requests like "improve my goals", "strengthen my assumptions", "make these better", "suggest improvements", etc.

In this mode, provide concrete text replacements for existing items that the student can accept or deny.

Rules for improve_mode:
- The "originalText" MUST match EXACTLY (word-for-word) what appears in the student's current framework — do NOT include labels like "G-01: " as part of the originalText
- Only suggest improvements for text that actually exists
- Provide only 1-2 specific, actionable improvements — focus on the most impactful ones, do not overwhelm the student
- Each newText should directly replace the originalText
- Improvements should strengthen clarity, specificity, or completeness
- Keep each improvement's text and explanation short and to the point
</improve_mode>

You MUST respond with valid JSON in exactly this format:
{
  "mode": "generation" | "insightful" | "critique" | "improve",
  "message": "A conversational message to the student — EXACTLY 3 short sentences. This is shown as chat text.",
  "feedback": [
    {
      "type": "strength" | "question" | "consideration" | "suggestion" | "missing" | "conflict" | "unclear" | "incomplete",
      "category": "title" | "goals" | "assumptions" | "constraints" | "ideas" | "opinions" | "decisions" | "general",
      "quote": "relevant quote from their framework if applicable, otherwise null",
      "message": "The detailed feedback, question, or observation"
    }
  ],
  "modifications": [
    {
      "operation": "ADD" | "UPDATE" | "DELETE",
      "category": "title" | "goals" | "assumptions" | "constraints" | "ideas" | "opinions" | "decisions",
      "label": "G-01 | A-02 | etc for UPDATE/DELETE, null for ADD (always null for title)",
      "currentText": "exact current text for UPDATE/DELETE, null for ADD",
      "newText": "new or replacement text for ADD/UPDATE, null for DELETE",
      "explanation": "brief explanation of why"
    }
  ],
  "improvements": [
    {
      "category": "goals" | "assumptions" | "constraints" | "ideas" | "opinions" | "decisions",
      "originalText": "exact text from the framework to replace",
      "newText": "the improved replacement text",
      "explanation": "brief explanation of why this improvement helps"
    }
  ],
  "summary": "A brief wrap-up or encouragement (1 short sentence)"
}

CRITICAL RULES:
- Always include "mode" and "message"
- Include "feedback" array only for insightful and critique modes (empty array otherwise)
- Include "modifications" array only for generation mode (empty array otherwise)
- Include "improvements" array only for improve mode (empty array otherwise)
- Always include "summary"
- Do NOT include feedback, modifications, and improvements in the same response — pick ONE based on the mode
- The "message" field should be conversational and brief — the detailed content goes in the appropriate array`;
}

function buildOnboardingPrompt(
  step: string,
  background?: string,
  formattedGACIOD?: string,
): string {
  const bg = background && background.trim()
    ? `\n\nBackground gathered so far:\n${background.trim()}`
    : '';
  const gaciod = formattedGACIOD && formattedGACIOD.trim()
    ? `\n\nItems already added to the matrix (do NOT propose duplicates):\n${formattedGACIOD.trim()}`
    : '';
  return `<core_identity>
You are Gasel (pronounced "Gazelle"), a warm, encouraging design assistant. You are ONBOARDING a new user through a short, staged conversation before their workspace opens.
</core_identity>

<writing_style>
- Write in short, clear sentences — ideally one or two per message. Never a wall of text.
- Be warm and plain-spoken. Ask ONE thing at a time.
- Never use the word "context" with the user. Call what they tell you their "background".
</writing_style>

<the_flow>
The conversation moves through these steps. You are CURRENTLY at step: "${step}". Report the correct next "step" in your JSON every time.

- "topic": Understand what the user is working on; capture it as "background" (a concise 2-4 sentence summary). Propose ONE "topic" — a single guiding QUESTION they can design around (e.g. "What should my candle-business website include to turn local buyers into online customers?"). Let them accept, ask for an edit, or reject it; refine the topic on edits and propose a fresh one on rejection. STAY at step "topic" until they clearly accept. The moment they accept, return step "offer_walkthrough" and a message asking, in one sentence: "Want me to walk you through the first parts of GACIOD — Goals, Assumptions, and Constraints?"

- "offer_walkthrough": Read their yes/no.
  - If NO: return step "done" with a one-line "opening your workspace" message and no modifications.
  - If YES: return step "walkthrough" AND immediately begin GOALS — one short line explaining what Goals are, plus 2-3 ADD modifications for category "goals".

- "walkthrough": You are guiding the user through Goals → Assumptions → Constraints, IN THAT ORDER. Each turn: briefly acknowledge what they did with the previous category's suggestions, then introduce the NEXT category in one short line and include 2-3 ADD modifications for it. End the message by inviting them to accept/tweak the cards and reply when ready to continue. After Constraints have been offered and addressed, return step "done". ONLY ever propose items for "goals", "assumptions", or "constraints" — never ideas, opinions, or decisions.

- "done": Onboarding is finished. One short closing line, no modifications.
</the_flow>

<rules>
- Keep every reply to 1-2 short sentences.
- "topic" must be phrased as a question. "background" must be concise.
- Always echo your best current "topic" and "background" (refine as you learn). Use null only when you genuinely have nothing yet.
- "modifications" must be EMPTY unless step is "walkthrough". In walkthrough, each modification is an ADD for goals/assumptions/constraints with a null label. Do not duplicate items already in the matrix.
</rules>

<current_state>${bg}${gaciod}
</current_state>

You MUST respond with valid JSON in exactly this format:
{
  "step": "topic" | "offer_walkthrough" | "walkthrough" | "done",
  "message": "<your short, friendly chat reply to the user>",
  "topic": "<the suggested guiding question, or null>",
  "background": "<a concise 2-4 sentence summary of what they're working on, or null>",
  "modifications": [
    { "operation": "ADD", "category": "goals" | "assumptions" | "constraints", "label": null, "newText": "<the item>", "explanation": "<one short reason>" }
  ]
}`;
}

export async function POST(req: NextRequest) {
  try {
    const { user } = await neonAuth();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { messages, gacIODContext, formattedGACIOD, additionalContext, phase, step, background } = await req.json();

    const isOnboarding = phase === 'onboarding';
    const baseContext = buildBaseContext(gacIODContext, formattedGACIOD, additionalContext);
    const systemPrompt = isOnboarding
      ? buildOnboardingPrompt(step || 'topic', background ?? additionalContext, formattedGACIOD)
      : buildSystemPrompt(baseContext);

    const systemMessage = {
      role: 'system' as const,
      content: systemPrompt,
    };

    // Convert messages to OpenAI format
    const openAIMessages = [
      systemMessage,
      ...messages.map((msg: any) => ({
        role: msg.sender === 'user' ? 'user' as const : 'assistant' as const,
        content: msg.text,
      })),
    ];

    const completion = await openai.chat.completions.create({
      model: 'gpt-5-mini-2025-08-07',
      messages: openAIMessages,
      max_completion_tokens: 16000,
      response_format: { type: 'json_object' },
    });

    const assistantMessage = completion.choices[0].message.content;

    // Always log the raw ChatGPT response for debugging
    console.log('[ChatGPT Response]', JSON.stringify({
      content: assistantMessage,
      finishReason: completion.choices[0].finish_reason,
      usage: completion.usage,
    }, null, 2));

    if (!assistantMessage) {
      console.error('OpenAI returned empty content. Finish reason:', completion.choices[0].finish_reason);
      return NextResponse.json({
        mode: 'insightful',
        message: 'I received your request but could not generate a response. Please try again.',
        feedback: [],
        modifications: [],
        improvements: [],
        summary: '',
      });
    }

    let parsedResponse: any;
    try {
      parsedResponse = JSON.parse(assistantMessage);
    } catch (e) {
      console.error('Failed to parse JSON response:', e);
      // Return the raw text as a conversational message
      return NextResponse.json({
        mode: 'insightful',
        message: assistantMessage,
        feedback: [],
        modifications: [],
        improvements: [],
        summary: '',
      });
    }

    // Onboarding phase — return the staged onboarding shape
    if (isOnboarding) {
      const validSteps = ['topic', 'offer_walkthrough', 'walkthrough', 'done'];
      const nextStep = validSteps.includes(parsedResponse.step) ? parsedResponse.step : (step || 'topic');
      const onboardingMods = nextStep === 'walkthrough' && Array.isArray(parsedResponse.modifications)
        ? parsedResponse.modifications.filter(
            (m: { operation?: string; category?: string } | null) =>
              !!m && m.operation === 'ADD' &&
              ['goals', 'assumptions', 'constraints'].includes(m.category ?? ''),
          )
        : [];
      return NextResponse.json({
        mode: 'onboarding',
        step: nextStep,
        message: parsedResponse.message || '',
        topic: typeof parsedResponse.topic === 'string' ? parsedResponse.topic : null,
        background: typeof parsedResponse.background === 'string' ? parsedResponse.background : null,
        modifications: onboardingMods,
        feedback: [],
        improvements: [],
        summary: '',
        usage: completion.usage,
      });
    }

    // Normalize the response — ensure all fields exist
    const response = {
      mode: parsedResponse.mode || 'insightful',
      message: parsedResponse.message || '',
      feedback: Array.isArray(parsedResponse.feedback) ? parsedResponse.feedback : [],
      modifications: Array.isArray(parsedResponse.modifications) ? parsedResponse.modifications : [],
      improvements: Array.isArray(parsedResponse.improvements) ? parsedResponse.improvements : [],
      summary: parsedResponse.summary || '',
      usage: completion.usage,
    };

    return NextResponse.json(response);
  } catch (error: any) {
    console.error('OpenAI API error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to get response from ChatGPT' },
      { status: 500 }
    );
  }
}
