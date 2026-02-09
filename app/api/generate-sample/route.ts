import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(req: NextRequest) {
  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-5-nano-2025-08-07',
      messages: [
        {
          role: 'system',
          content: `Generate a sample GACIOD framework for a project. Return ONLY a JSON object with the following structure (no markdown, no code blocks):
{
  "title": "project name",
  "goals": "list of goals (each on new line)",
  "assumptions": "list of assumptions (each on new line)",
  "constraints": "list of constraints (each on new line)",
  "ideas": "list of ideas (each on new line)",
  "opinions": "list of opinions (each on new line)",
  "decisions": "list of decisions (each on new line)"
}

Make it interesting and realistic. Use 3-5 items per category.`,
        },
        {
          role: 'user',
          content: 'Generate a sample GACIOD framework for a project of your choice, as if you were an instructor for a software design class.',
        },
      ],
      max_completion_tokens: 5000,
    });

    const content = completion.choices[0].message.content;

    // Try to parse the JSON response
    let jsonMatch = content?.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('Failed to extract JSON from response');
    }

    const sampleData = JSON.parse(jsonMatch[0]);

    return NextResponse.json(sampleData);
  } catch (error: any) {
    console.error('OpenAI API error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to generate sample data' },
      { status: 500 }
    );
  }
}
