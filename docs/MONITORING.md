# Monitoring Gazelle chats with Judgment Labs

Every reply Gazelle gives (onboarding and workspace) is recorded as one trace in
[Judgment Labs](https://judgmentlabs.ai). Four judges grade each trace:

| Judge | Type | What it answers |
| --- | --- | --- |
| `gazelle-asks-instead-of-tells` | Pass / Fail | Did Gazelle guide with questions, or hand over answers the student didn't ask for? Explicit "fill in / improve" requests count as Pass. |
| `gazelle-gaciod-focus` | Category | Which GACIOD category the reply pushed the student toward (Goals … Decisions, Multiple, None). |
| `gazelle-ai-initiated` | Pass / Fail | Did Gazelle open the conversation itself? |
| `gazelle-student-depth` | Category | Are the student's own messages Deep, Moderate, Shallow, or Too early to tell? |

Traces are grouped by **session** (one Gazelle chat) and **customer user**
(one student), both pseudonymized, so you can filter to one student or one chat.

## Before turning this on with real students

Monitoring sends redacted chat text to a third party. Check that your IRB
protocol and consent form cover this. What leaves the server:

- Student and session IDs are replaced with salted HMAC pseudonyms
  (`student_3f9a…`). Only someone with `JUDGMENT_ID_SALT` can map them back.
- The student's name and email, and any email addresses or phone numbers in the
  chat, are replaced with `[STUDENT]`, `[EMAIL]`, etc.
- Everything else students type (project topic, matrix items, messages) is sent
  as-is. That can still include identifying details.

Monitoring stays **off** until all three of `JUDGMENT_API_KEY`,
`JUDGMENT_ORG_ID` and `JUDGMENT_ID_SALT` are set. If Judgment is unreachable,
chats keep working.

## Setup

1. Create a Judgment account and a project named `gazelle`. The SDK won't create
   the project for you.
2. Add to `.env.local` (and to Vercel's environment variables):

   ```bash
   JUDGMENT_API_KEY=...
   JUDGMENT_ORG_ID=...
   JUDGMENT_ID_SALT=$(openssl rand -hex 32)   # generate once, store safely, never change
   # optional
   JUDGMENT_PROJECT_NAME=gazelle
   JUDGMENT_ENVIRONMENT=pilot-fall-2026       # defaults to VERCEL_ENV / NODE_ENV
   ```

   Changing the salt later changes every pseudonym, so keep it fixed for a study.
3. Create the judges (once):

   ```bash
   npx tsx --env-file=.env.local scripts/create-judgment-judges.ts
   ```

4. In Judgment, open each judge and set it to **Continuous** so it grades new
   traces automatically.
5. Have a conversation in Gazelle, then open **Logs → Traces** in Judgment and
   check the `gazelle_chat_turn` trace and its judge results.

## Using it for research

- **Validate the judges first.** Hand-code a sample of turns with the same rubric
  and use Judgment's judge alignment to compare. Report agreement before
  relying on judge labels in a paper.
- Trace attributes you can filter or query on: `gazelle.phase`,
  `gazelle.onboarding_step`, `gazelle.turn_index`, `gazelle.ai_initiated`,
  `gazelle.mode`.
- Judge prompts live in `scripts/create-judgment-judges.ts`. To change one after
  creation, edit it in the Judgment UI (which versions it) or delete and re-run.

## Where the code is

- `lib/judgment.ts`: tracer setup, pseudonymization, redaction, `traceChatTurn()`
- `app/api/chat/route.ts`: wraps each turn in `traceChatTurn()`
- `app/HomeClient.tsx`: sends the active `sessionId` with each chat request
