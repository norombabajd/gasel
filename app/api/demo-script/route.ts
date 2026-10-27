import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Generates a Wizard-of-Oz demo script for /debug/demo. Public (no auth) so
// the login-free demo page can use it — keep the output cap modest.
const SYSTEM_PROMPT = `You are a demo-script writer for "Gazelle", an educational assistant that helps people structure software-design thinking with the GACIOD matrix (Goals, Assumptions, Constraints, Ideas, Opinions, Decisions).

You produce Wizard-of-Oz demo scripts: a human presenter plays back your scripted assistant replies live while an audience watches, so every reply must read like a real AI assistant responding in the moment.

Rules:
- Write in Gazelle's voice: warm, plain-spoken, short sentences (1-3 per reply).
- "messages" are the pre-staged chat history visible when the demo starts. Begin with a short assistant greeting tied to the scenario. Keep it to 1-2 messages.
- "queuedReplies" play one at a time as the presenter sends chat messages. Give each a "cue": the exact user line the presenter should type right before it plays.
- Include exactly ONE reply with trigger "critique". Its text MUST use the structured feedback format: 2-4 sections, each starting with a tag like [Strength], [Conflict], [Missing], [Question], or [Unclear] on its own line, followed by a short observation that references matrix items (e.g. "G-01: ...").
- Include exactly ONE reply with trigger "suggest". Give it 2-3 "modifications": ADD operations with a category from goals/assumptions/constraints/ideas/opinions/decisions, a concise newText, and a one-line explanation. Target categories the matrix leaves sparse.
- Include 2-3 replies with trigger "any" that move the conversation forward naturally.
- "matrix" is the starting GACIOD content: 2-3 short, specific items each for goals, assumptions, and constraints; 0-1 items for ideas, opinions, and decisions so the suggest reply has room to add.
- "topic" is a single guiding question for the workspace Topic card.

Respond with valid JSON in exactly this shape:
{
  "topic": "...",
  "matrix": { "goals": ["..."], "assumptions": ["..."], "constraints": ["..."], "ideas": [], "opinions": [], "decisions": [] },
  "messages": [ { "sender": "assistant", "text": "..." } ],
  "queuedReplies": [
    { "trigger": "any" | "critique" | "suggest", "cue": "what the presenter types", "text": "...",
      "modifications": [ { "operation": "ADD", "category": "ideas", "newText": "...", "explanation": "..." } ] }
  ]
}`;

export async function POST(req: NextRequest) {
  try {
    const { prompt } = await req.json();
    if (!prompt || typeof prompt !== 'string' || !prompt.trim()) {
      return NextResponse.json({ error: 'Missing scenario description' }, { status: 400 });
    }

    const completion = await openai.chat.completions.create({
      model: 'gpt-5-mini-2025-08-07',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: `Demo scenario: ${prompt.trim().slice(0, 2000)}` },
      ],
      max_completion_tokens: 10000,
      response_format: { type: 'json_object' },
    });

    const content = completion.choices[0].message.content;
    if (!content) {
      return NextResponse.json({ error: 'The model returned no script. Please try again.' }, { status: 502 });
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(content);
    } catch {
      return NextResponse.json({ error: 'The model returned an invalid script. Please try again.' }, { status: 502 });
    }

    return NextResponse.json(parsed);
  } catch (error) {
    console.error('Demo script generation error:', error);
    const message = error instanceof Error ? error.message : 'Failed to generate the demo script';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
