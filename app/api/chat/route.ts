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
- Provide 2-4 specific, actionable improvements
- Each newText should directly replace the originalText
- Improvements should strengthen clarity, specificity, or completeness
</improve_mode>

You MUST respond with valid JSON in exactly this format:
{
  "mode": "generation" | "insightful" | "critique" | "improve",
  "message": "A brief conversational message to the student (1-3 sentences). This is shown as chat text.",
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
  "summary": "A brief wrap-up or encouragement (1-2 sentences)"
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

export async function POST(req: NextRequest) {
  try {
    const { user } = await neonAuth();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { messages, gacIODContext, formattedGACIOD, additionalContext } = await req.json();

    const baseContext = buildBaseContext(gacIODContext, formattedGACIOD, additionalContext);
    const systemPrompt = buildSystemPrompt(baseContext);

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
