'use client';

import Chat, { Message, Improvement, Modification } from '@/components/Chat';
import SuggestionsTimeline from '@/components/SuggestionsTimeline';
import GACIODCard from '@/components/GACIODCard';
import ChatSidebar from '@/components/ChatSidebar';
import { useState } from 'react';
import {
  IconTarget,
  IconHelpCircle,
  IconLock,
  IconBulb,
  IconMessageCircle,
  IconFlagCheck,
  IconChecklist,
  IconZoomQuestion,
  IconSparkles,
  IconCheck,
  IconX,
  IconPointFilled,
  IconAlertTriangle,
  IconAlertCircle,
  IconSearch,
  IconQuestionMark,
  IconPencil,
  IconPlus,
  IconTrash,
  type TablerIcon,
} from '@tabler/icons-react';

// ---------------------------------------------------------------------------
// Sample data for showcasing every UI element
// ---------------------------------------------------------------------------

const sampleMessages: Message[] = [
  {
    id: 'user-1',
    text: 'Review my GACIOD framework',
    sender: 'user',
    timestamp: Date.now() - 300_000,
  },
  {
    id: 'assistant-structured',
    text: [
      '[Suggestion]\n> "Match players with similar skill"\nConsider specifying what metric defines "similar" — are you using Elo, MMR, win-rate, or something else?',
      '[Strength]\n> "Keep queue times under 60 seconds"\nThis is a clear, measurable constraint that will anchor your design nicely.',
      '[Concern]\nG-01: Fair matchmaking for all players\nC-01: Low latency queue times\nThese two goals could conflict under high-load scenarios. How will you prioritise?',
      '[Question]\nHave you considered how smurfing or alt-accounts affect your fairness model?',
      '[Consideration]\nA-02: Players prefer competitive matches\nPlayers at extreme ends of the skill curve may not share this assumption.',
      '[Missing]\nThere is no decision about what happens when the queue times out without a match.',
      '[Conflict]\nO-01: Strict skill-based matching is best\nG-02: Fast queue times\nStrict matching and speed are inherently at odds — this needs a resolution strategy.',
      '[Unclear]\nI-01: Use ELO rating system\nIt is unclear whether you mean classic Elo, Glicko-2, or a custom variant.',
      '[Incomplete]\nD-01: Use region-based matchmaking\nThis decision lacks detail about cross-region fallback behaviour.',
    ].join('\n\n') + '\n\n---\n\n**Summary**\nYour framework has a strong foundation with measurable constraints. Key areas to address: define your skill metric, resolve the fairness-vs-speed tension, and flesh out decisions around edge cases.',
    sender: 'assistant',
    timestamp: Date.now() - 290_000,
    isStructured: true,
  },
  {
    id: 'system-1',
    text: 'Session restored from previous save.',
    sender: 'system',
    timestamp: Date.now() - 280_000,
  },
  {
    id: 'assistant-markdown',
    text: 'Here are some thoughts:\n\n- **Latency** is critical for competitive games\n- Consider a *tiered* approach to skill brackets\n- Use `MMR` rather than raw win/loss\n\n> Note: this is a blockquote rendered via markdown.\n\n| Approach | Pros | Cons |\n|----------|------|------|\n| Elo | Simple | Slow convergence |\n| Glicko-2 | Accounts for uncertainty | More complex |',
    sender: 'assistant',
    timestamp: Date.now() - 270_000,
  },
  {
    id: 'user-2',
    text: 'Suggest improvements for my GACIOD framework',
    sender: 'user',
    timestamp: Date.now() - 260_000,
  },
  {
    id: 'assistant-improvements',
    text: 'I found a few items that could be strengthened:',
    sender: 'assistant',
    timestamp: Date.now() - 250_000,
    improvements: [
      {
        category: 'Goals',
        originalText: 'Fair matchmaking for all players',
        newText: 'Ensure equitable match outcomes by pairing players within a 200-point MMR band',
        explanation: 'Making the goal measurable makes it easier to verify.',
        status: 'pending',
      },
      {
        category: 'Assumptions',
        originalText: 'Players prefer competitive matches',
        newText: 'The majority of ranked-queue players prefer evenly-matched competitive games over quick stomps',
        explanation: 'Narrowing the scope to ranked-queue players increases precision.',
        status: 'accepted',
      },
      {
        category: 'Constraints',
        originalText: 'Low latency queue times',
        newText: 'Average queue time must remain below 45 seconds during peak hours and below 90 seconds off-peak',
        explanation: 'Adding concrete numbers turns this into a testable constraint.',
        status: 'denied',
      },
    ],
  },
  {
    id: 'user-3',
    text: 'Generate items for my framework based on a matchmaking system',
    sender: 'user',
    timestamp: Date.now() - 240_000,
  },
  {
    id: 'assistant-modifications',
    text: "I'll populate your framework with relevant items:",
    sender: 'assistant',
    timestamp: Date.now() - 230_000,
    modifications: [
      {
        operation: 'ADD',
        category: 'goals',
        newText: 'Minimise skill disparity between teams to keep games competitive',
        explanation: 'A core goal for any matchmaking system.',
        status: 'pending',
      },
      {
        operation: 'UPDATE',
        category: 'assumptions',
        label: 'A-02',
        currentText: 'Players prefer competitive matches',
        newText: 'Ranked players strongly prefer competitive matches; casual players value speed',
        explanation: 'Differentiating player segments improves accuracy.',
        status: 'accepted',
      },
      {
        operation: 'DELETE',
        category: 'ideas',
        label: 'I-03',
        currentText: 'Use random matchmaking as fallback',
        explanation: 'Random matchmaking undermines the fairness goal and should be removed.',
        status: 'denied',
      },
      {
        operation: 'ADD',
        category: 'decisions',
        newText: 'Adopt Glicko-2 as the primary rating system',
        explanation: 'Glicko-2 handles rating uncertainty better than classic Elo.',
        status: 'pending',
      },
      {
        operation: 'UPDATE',
        category: 'constraints',
        label: 'C-01',
        currentText: 'Low latency queue times',
        newText: 'Queue times must average under 60 seconds at the 95th percentile',
        explanation: 'Quantifying the constraint with a percentile target.',
        status: 'pending',
      },
    ],
  },
  {
    id: 'assistant-quote',
    text: '"The best matchmaking systems balance fairness, speed, and player satisfaction." — Game Design Patterns',
    sender: 'assistant',
    timestamp: Date.now() - 220_000,
    isQuote: true,
  },
];

const sampleGACIOD = {
  goals: 'Fair matchmaking for all players\nKeep games competitive and fun\nMinimise queue times',
  assumptions: 'Players prefer competitive matches\nSkill can be measured numerically\nPlayer pool is large enough',
  constraints: 'Low latency queue times\nServer infrastructure limits\nAnti-cheat requirements',
  ideas: 'Use ELO rating system\nRegion-based matching\nUse random matchmaking as fallback',
  opinions: 'Strict skill-based matching is best\nCasual modes should be looser\nPremade groups need handicaps',
  decisions: 'Use region-based matchmaking\nImplement seasonal resets\nAllow cross-play opt-in',
};

const sampleSessions = [
  { id: '1', title: 'Matchmaking Algorithm Design', messages: sampleMessages, content: { title: 'Matchmaking Algorithm Design', ...sampleGACIOD }, context: '', createdAt: Date.now() - 86400000, updatedAt: Date.now() - 1000 },
  { id: '2', title: 'Authentication Flow Review', messages: [], content: { title: 'Authentication Flow Review', goals: '', assumptions: '', constraints: '', ideas: '', opinions: '', decisions: '' }, context: '', createdAt: Date.now() - 172800000, updatedAt: Date.now() - 86400000 },
  { id: '3', title: 'Database Schema Planning', messages: [], content: { title: 'Database Schema Planning', goals: '', assumptions: '', constraints: '', ideas: '', opinions: '', decisions: '' }, context: '', createdAt: Date.now() - 259200000, updatedAt: Date.now() - 172800000 },
];

// ---------------------------------------------------------------------------
// Debug page component
// ---------------------------------------------------------------------------

export default function DebugMessagesClient() {
  const [chatInput, setChatInput] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [gaciodContent, setGaciodContent] = useState(sampleGACIOD);

  return (
    <div className="min-h-screen bg-[#E8EDF2]">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <h1 className="font-display text-2xl tracking-tight text-gray-900">Debug: Chat UI/UX Elements</h1>
        <p className="text-sm text-gray-500 mt-1">
          All interactive chat components rendered with sample data. No API calls are made.
        </p>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-10">

        {/* ----------------------------------------------------------------- */}
        {/* Section: Chat Messages (full component) */}
        {/* ----------------------------------------------------------------- */}
        <section>
          <SectionHeader
            title="Chat Component"
            description="The full Chat component with all message types: user, assistant (plain + markdown), system, structured feedback, improvements, and modifications."
          />
          <div className="bg-white rounded-xl shadow-[0_1px_3px_rgba(0,0,0,0.05)] border border-gray-200 h-[700px] overflow-hidden">
            <Chat
              messages={sampleMessages}
              onSendMessage={(text) => console.log('[debug] send:', text)}
              inputValue={chatInput}
              setInputValue={setChatInput}
              isLoading={false}
              onAcceptImprovement={(imp) => console.log('[debug] accept improvement:', imp)}
              onDenyImprovement={(msgId, idx) => console.log('[debug] deny improvement:', msgId, idx)}
              onAcceptModification={(mod) => console.log('[debug] accept modification:', mod)}
              onDenyModification={(msgId, idx) => console.log('[debug] deny modification:', msgId, idx)}
              showActionsInline={true}
            />
          </div>
        </section>

        {/* ----------------------------------------------------------------- */}
        {/* Section: Loading State */}
        {/* ----------------------------------------------------------------- */}
        <section>
          <SectionHeader
            title="Chat — Loading State"
            description="The animated 'Thinking...' indicator shown while waiting for an AI response."
          />
          <div className="bg-white rounded-xl shadow-[0_1px_3px_rgba(0,0,0,0.05)] border border-gray-200 h-48 overflow-hidden">
            <Chat
              messages={[
                { id: 'u-loading', text: 'Find gaps in my GACIOD framework', sender: 'user', timestamp: Date.now() },
              ]}
              onSendMessage={() => {}}
              inputValue=""
              setInputValue={() => {}}
              isLoading={true}
              showActionsInline={false}
            />
          </div>
        </section>

        {/* ----------------------------------------------------------------- */}
        {/* Section: Empty State */}
        {/* ----------------------------------------------------------------- */}
        <section>
          <SectionHeader
            title="Chat — Empty State"
            description="Shown when no messages have been sent yet."
          />
          <div className="bg-white rounded-xl shadow-[0_1px_3px_rgba(0,0,0,0.05)] border border-gray-200 h-48 overflow-hidden">
            <Chat
              messages={[]}
              onSendMessage={() => {}}
              inputValue=""
              setInputValue={() => {}}
              isLoading={false}
              showActionsInline={true}
            />
          </div>
        </section>

        {/* ----------------------------------------------------------------- */}
        {/* Section: Structured Feedback Cards */}
        {/* ----------------------------------------------------------------- */}
        <section>
          <SectionHeader
            title="Structured Feedback Cards"
            description="All 9 feedback categories: Suggestion, Strength, Concern, Question, Consideration, Missing, Conflict, Unclear, Incomplete — each with distinct colour and icon."
          />
          <div className="bg-white rounded-xl shadow-[0_1px_3px_rgba(0,0,0,0.05)] border border-gray-200 p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {[
                { type: 'Suggestion', text: 'Consider adding rate limiting to your matchmaking API.', color: 'bg-blue-50 border-blue-200', textColor: 'text-blue-900', icon: '\u{1f4a1}' },
                { type: 'Strength', text: 'Your constraint on queue times is well-defined and measurable.', color: 'bg-emerald-50 border-emerald-200', textColor: 'text-emerald-900', icon: '\u2728' },
                { type: 'Concern', text: 'Skill-based matching may cause long queues in low-population regions.', color: 'bg-orange-50 border-orange-200', textColor: 'text-orange-900', icon: '\u26a0\ufe0f' },
                { type: 'Question', text: 'How will you handle players who disconnect mid-match?', color: 'bg-purple-50 border-purple-200', textColor: 'text-purple-900', icon: '\u2753' },
                { type: 'Consideration', text: 'Time-of-day effects on matchmaking pool size should be modelled.', color: 'bg-yellow-50 border-yellow-200', textColor: 'text-yellow-900', icon: '\u{1f914}' },
                { type: 'Missing', text: 'No decision exists for handling new players without rating history.', color: 'bg-red-50 border-red-200', textColor: 'text-red-900', icon: '\u{1f50d}' },
                { type: 'Conflict', text: 'Strict matching and fast queues are at odds — needs resolution.', color: 'bg-orange-50 border-orange-200', textColor: 'text-orange-900', icon: '\u26a0\ufe0f' },
                { type: 'Unclear', text: 'It is ambiguous whether "region" means continent or data-centre.', color: 'bg-gray-50 border-gray-300', textColor: 'text-gray-800', icon: '\u2754' },
                { type: 'Incomplete', text: 'The anti-cheat constraint lacks specifics on detection methods.', color: 'bg-red-50 border-red-200', textColor: 'text-red-900', icon: '\u{1f4dd}' },
              ].map(({ type, text, color, textColor }) => {
                const iconMap: Record<string, TablerIcon> = {
                  Suggestion: IconBulb,
                  Strength: IconSparkles,
                  Concern: IconAlertTriangle,
                  Question: IconHelpCircle,
                  Consideration: IconAlertCircle,
                  Missing: IconSearch,
                  Conflict: IconAlertTriangle,
                  Unclear: IconQuestionMark,
                  Incomplete: IconPencil,
                };
                const Icon = iconMap[type] ?? IconBulb;
                return (
                  <div key={type} className={`border rounded-xl p-3 ${color}`}>
                    <div className="flex items-center gap-1.5 mb-2">
                      <Icon className={`w-4 h-4 ${textColor}`} stroke={2} />
                      <span className={`font-display text-sm ${textColor}`}>{type}</span>
                    </div>
                    <p className="text-sm font-normal text-gray-900">{text}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* ----------------------------------------------------------------- */}
        {/* Section: Improvement Cards */}
        {/* ----------------------------------------------------------------- */}
        <section>
          <SectionHeader
            title="Improvement Cards"
            description="Before/after text improvements with Accept/Deny actions and all three status states (pending, accepted, denied)."
          />
          <div className="bg-white rounded-xl shadow-[0_1px_3px_rgba(0,0,0,0.05)] border border-gray-200 p-6 space-y-4">
            {/* Pending */}
            <div>
              <Badge label="Pending" color="bg-amber-100 text-amber-700" />
              <div className="mt-2 p-3 bg-white border border-gray-200 rounded-xl shadow-[0_1px_3px_rgba(0,0,0,0.05)]">
                <div className="mb-3">
                  <div className="flex items-center gap-1.5 mb-1">
                    <IconSparkles className="w-4 h-4 text-emerald-600 shrink-0" stroke={2} />
                    <span className="font-display text-sm text-gray-800">Improve Goals</span>
                  </div>
                  <p className="text-xs font-normal text-gray-600 mb-2 italic">Making the goal measurable makes it easier to verify.</p>
                  <div className="text-sm space-y-2">
                    <div className="bg-red-50 border-l-3 border-red-400 rounded-r p-2.5">
                      <span className="text-[10px] font-semibold text-red-900 uppercase tracking-wide">Current</span>
                      <div className="text-red-950 font-normal mt-1 leading-relaxed">Fair matchmaking for all players</div>
                    </div>
                    <div className="bg-emerald-50 border-l-3 border-emerald-500 rounded-r p-2.5">
                      <span className="text-[10px] font-semibold text-emerald-900 uppercase tracking-wide">Suggested</span>
                      <div className="text-emerald-950 font-normal mt-1 leading-relaxed">Ensure equitable match outcomes by pairing players within a 200-point MMR band</div>
                    </div>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-emerald-600 text-white text-xs font-medium rounded-lg hover:bg-emerald-700 transition-colors"><IconCheck className="w-3.5 h-3.5" stroke={2} />Accept</button>
                  <button className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-gray-100 text-gray-700 text-xs font-medium rounded-lg border border-gray-200 hover:bg-gray-200 transition-colors"><IconX className="w-3.5 h-3.5" stroke={2} />Deny</button>
                </div>
              </div>
            </div>
            {/* Accepted / Denied — compact resolved chips (wrap when there are many) */}
            <div>
              <Badge label="Resolved (compact chips)" color="bg-gray-100 text-gray-600" />
              <div className="mt-2 flex flex-wrap gap-1">
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] bg-emerald-50 text-emerald-700">
                  <IconCheck className="w-3 h-3 shrink-0" stroke={2.5} /> Assumptions
                </span>
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] bg-gray-100 text-gray-400 line-through">
                  <IconX className="w-3 h-3 shrink-0" stroke={2.5} /> Constraints
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* ----------------------------------------------------------------- */}
        {/* Section: Modification Cards */}
        {/* ----------------------------------------------------------------- */}
        <section>
          <SectionHeader
            title="Modification Cards"
            description="ADD, UPDATE, and DELETE modification cards with their distinct visual styles and status badges."
          />
          <div className="bg-white rounded-xl shadow-[0_1px_3px_rgba(0,0,0,0.05)] border border-gray-200 p-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* ADD */}
              <div>
                <Badge label="ADD (pending)" color="bg-emerald-100 text-emerald-700" />
                <div className="mt-2 p-3 bg-white border border-gray-200 rounded-xl shadow-[0_1px_3px_rgba(0,0,0,0.05)]">
                  <div className="mb-3">
                    <div className="flex items-center gap-1.5 mb-1">
                      <IconPlus className="w-4 h-4 text-emerald-700 shrink-0" stroke={2} />
                      <span className="font-display text-sm text-emerald-700">ADD in Goals</span>
                    </div>
                    <p className="text-xs font-normal text-gray-600 mb-2 italic">A core goal for matchmaking.</p>
                    <div className="bg-emerald-50 border-l-3 border-emerald-500 rounded-r p-2.5">
                      <span className="text-[10px] font-semibold text-emerald-900 uppercase tracking-wide">Add</span>
                      <div className="text-emerald-950 font-normal mt-1 leading-relaxed text-sm">Minimise skill disparity between teams</div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-emerald-600 text-white text-xs font-medium rounded-lg"><IconCheck className="w-3.5 h-3.5" stroke={2} />Accept</button>
                    <button className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-gray-100 text-gray-700 text-xs font-medium rounded-lg border border-gray-200"><IconX className="w-3.5 h-3.5" stroke={2} />Deny</button>
                  </div>
                </div>
              </div>
              {/* UPDATE */}
              <div>
                <Badge label="UPDATE (pending)" color="bg-indigo-100 text-indigo-700" />
                <div className="mt-2 p-3 bg-white border border-gray-200 rounded-xl shadow-[0_1px_3px_rgba(0,0,0,0.05)]">
                  <div className="mb-3">
                    <div className="flex items-center gap-1.5 mb-1">
                      <IconPencil className="w-4 h-4 text-indigo-700 shrink-0" stroke={2} />
                      <span className="font-display text-sm text-indigo-700">UPDATE in Constraints (C-01)</span>
                    </div>
                    <p className="text-xs font-normal text-gray-600 mb-2 italic">Quantifying the constraint.</p>
                    <div className="text-sm space-y-2">
                      <div className="bg-red-50 border-l-3 border-red-400 rounded-r p-2.5">
                        <span className="text-[10px] font-semibold text-red-900 uppercase tracking-wide">Current</span>
                        <div className="text-red-950 font-normal mt-1 leading-relaxed">Low latency queue times</div>
                      </div>
                      <div className="bg-emerald-50 border-l-3 border-emerald-500 rounded-r p-2.5">
                        <span className="text-[10px] font-semibold text-emerald-900 uppercase tracking-wide">Replace with</span>
                        <div className="text-emerald-950 font-normal mt-1 leading-relaxed">Queue times under 60s at the 95th percentile</div>
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-emerald-600 text-white text-xs font-medium rounded-lg"><IconCheck className="w-3.5 h-3.5" stroke={2} />Accept</button>
                    <button className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-gray-100 text-gray-700 text-xs font-medium rounded-lg border border-gray-200"><IconX className="w-3.5 h-3.5" stroke={2} />Deny</button>
                  </div>
                </div>
              </div>
              {/* DELETE */}
              <div>
                <Badge label="DELETE (pending)" color="bg-red-100 text-red-700" />
                <div className="mt-2 p-3 bg-white border border-gray-200 rounded-xl shadow-[0_1px_3px_rgba(0,0,0,0.05)]">
                  <div className="mb-3">
                    <div className="flex items-center gap-1.5 mb-1">
                      <IconTrash className="w-4 h-4 text-red-700 shrink-0" stroke={2} />
                      <span className="font-display text-sm text-red-700">DELETE in Ideas (I-03)</span>
                    </div>
                    <p className="text-xs font-normal text-gray-600 mb-2 italic">Random matchmaking undermines fairness.</p>
                    <div className="bg-red-50 border-l-3 border-red-400 rounded-r p-2.5">
                      <span className="text-[10px] font-semibold text-red-900 uppercase tracking-wide">Remove</span>
                      <div className="text-red-950 font-normal mt-1 leading-relaxed text-sm">Use random matchmaking as fallback</div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-emerald-600 text-white text-xs font-medium rounded-lg"><IconCheck className="w-3.5 h-3.5" stroke={2} />Accept</button>
                    <button className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-gray-100 text-gray-700 text-xs font-medium rounded-lg border border-gray-200"><IconX className="w-3.5 h-3.5" stroke={2} />Deny</button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ----------------------------------------------------------------- */}
        {/* Section: Suggestions Timeline */}
        {/* ----------------------------------------------------------------- */}
        <section>
          <SectionHeader
            title="Suggestions Timeline"
            description="Chronological list of all improvements and modifications with their status badges (pending, accepted, denied)."
          />
          <div className="bg-white rounded-xl shadow-[0_1px_3px_rgba(0,0,0,0.05)] border border-gray-200 h-[500px] overflow-hidden">
            <SuggestionsTimeline messages={sampleMessages} />
          </div>
        </section>

        {/* ----------------------------------------------------------------- */}
        {/* Section: GACIOD Cards */}
        {/* ----------------------------------------------------------------- */}
        <section>
          <SectionHeader
            title="GACIOD Cards"
            description="The six editable cards with item labels (G-01, A-02, etc.), inline editing, add/delete, and highlighted items (Goals items 0 & 2 are highlighted)."
          />
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="h-56">
              <GACIODCard
                title="Goals"
                content={gaciodContent.goals}
                onUpdate={(v) => setGaciodContent((prev) => ({ ...prev, goals: v }))}
                highlightedIndices={[0, 2]}
                color="green"
                icon={IconTarget}
                subtitle="What are the outcomes you are designing towards?"
                prefix="G"
                singular="goal"
                plural="goals"
              />
            </div>
            <div className="h-56">
              <GACIODCard
                title="Assumptions"
                content={gaciodContent.assumptions}
                onUpdate={(v) => setGaciodContent((prev) => ({ ...prev, assumptions: v }))}
                highlightedIndices={[1]}
                color="yellow"
                icon={IconHelpCircle}
                subtitle="What are you treating as true without full evidence?"
                prefix="A"
                singular="assumption"
                plural="assumptions"
              />
            </div>
            <div className="h-56">
              <GACIODCard
                title="Constraints"
                content={gaciodContent.constraints}
                onUpdate={(v) => setGaciodContent((prev) => ({ ...prev, constraints: v }))}
                highlightedIndices={[0]}
                color="red"
                icon={IconLock}
                subtitle="What limits our solution space?"
                prefix="C"
                singular="constraint"
                plural="constraints"
              />
            </div>
            <div className="h-56">
              <GACIODCard
                title="Ideas"
                content={gaciodContent.ideas}
                onUpdate={(v) => setGaciodContent((prev) => ({ ...prev, ideas: v }))}
                highlightedIndices={[]}
                color="violet"
                icon={IconBulb}
                subtitle="What approaches are worth exploring?"
                prefix="I"
                singular="idea"
                plural="ideas"
              />
            </div>
            <div className="h-56">
              <GACIODCard
                title="Opinions"
                content={gaciodContent.opinions}
                onUpdate={(v) => setGaciodContent((prev) => ({ ...prev, opinions: v }))}
                highlightedIndices={[]}
                color="orange"
                icon={IconMessageCircle}
                subtitle="What do we think, but can't prove?"
                prefix="O"
                singular="opinion"
                plural="opinions"
              />
            </div>
            <div className="h-56">
              <GACIODCard
                title="Decision + Rationale"
                content={gaciodContent.decisions}
                onUpdate={(v) => setGaciodContent((prev) => ({ ...prev, decisions: v }))}
                highlightedIndices={[]}
                color="blue"
                icon={IconFlagCheck}
                subtitle="What have we committed to and why?"
                prefix="D"
                singular="decision"
                plural="decisions"
              />
            </div>
          </div>
        </section>

        {/* ----------------------------------------------------------------- */}
        {/* Section: Chat Sidebar */}
        {/* ----------------------------------------------------------------- */}
        <section>
          <SectionHeader
            title="Chat Sidebar"
            description="Session list with icon rail, hamburger toggle, new-chat button, session items (with hover delete), and user profile dropdown. Note: user profile requires auth context so it will not render here."
          />
          <div className="bg-white rounded-xl shadow-[0_1px_3px_rgba(0,0,0,0.05)] border border-gray-200 h-96 overflow-hidden flex">
            <ChatSidebar
              sessions={sampleSessions as any}
              activeSessionId="1"
              onNewChat={() => console.log('[debug] new chat')}
              onSelectSession={(id) => console.log('[debug] select session:', id)}
              onDeleteSession={(id) => console.log('[debug] delete session:', id)}
              isOpen={sidebarOpen}
              onToggle={() => setSidebarOpen(!sidebarOpen)}
              onOpenSettings={() => console.log('[debug] open settings')}
            />
            <div className="flex-1 flex items-center justify-center text-gray-400 text-sm">
              <p>Main content area (click the hamburger to toggle the sidebar)</p>
            </div>
          </div>
        </section>

        {/* ----------------------------------------------------------------- */}
        {/* Section: Quick Action Buttons */}
        {/* ----------------------------------------------------------------- */}
        <section>
          <SectionHeader
            title="Quick Action Buttons"
            description="The three shortcut buttons below the chat input: Review, Gaps, Improve."
          />
          <div className="bg-white rounded-xl shadow-[0_1px_3px_rgba(0,0,0,0.05)] border border-gray-200 p-6">
            <div className="grid grid-cols-3 gap-1.5 max-w-md">
              <button className="bg-gray-50 border border-gray-200 rounded-lg py-2 hover:bg-gray-100 hover:border-gray-300 transition-all flex items-center justify-center gap-1.5">
                <IconChecklist className="w-3.5 h-3.5 text-blue-600 shrink-0" stroke={2} />
                <span className="font-display text-xs text-gray-600 whitespace-nowrap">Review</span>
              </button>
              <button className="bg-gray-50 border border-gray-200 rounded-lg py-2 hover:bg-gray-100 hover:border-gray-300 transition-all flex items-center justify-center gap-1.5">
                <IconZoomQuestion className="w-3.5 h-3.5 text-orange-600 shrink-0" stroke={2} />
                <span className="font-display text-xs text-gray-600 whitespace-nowrap">Gaps</span>
              </button>
              <button className="bg-gray-50 border border-gray-200 rounded-lg py-2 hover:bg-gray-100 hover:border-gray-300 transition-all flex items-center justify-center gap-1.5">
                <IconSparkles className="w-3.5 h-3.5 text-emerald-600 shrink-0" stroke={2} />
                <span className="font-display text-xs text-gray-600 whitespace-nowrap">Improve</span>
              </button>
            </div>
          </div>
        </section>

        {/* ----------------------------------------------------------------- */}
        {/* Section: Status Badges */}
        {/* ----------------------------------------------------------------- */}
        <section>
          <SectionHeader
            title="Status Badges"
            description="The three status states used across improvements, modifications, and the suggestions timeline."
          />
          <div className="bg-white rounded-xl shadow-[0_1px_3px_rgba(0,0,0,0.05)] border border-gray-200 p-6 flex gap-4 flex-wrap">
            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md text-[10px] font-semibold bg-amber-100 text-amber-700">
              <IconPointFilled className="w-3 h-3" /> Pending
            </span>
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-semibold bg-emerald-100 text-emerald-700">
              <IconCheck className="w-3 h-3" stroke={2.5} /> Accepted
            </span>
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-semibold bg-gray-100 text-gray-500">
              <IconX className="w-3 h-3" stroke={2.5} /> Denied
            </span>
          </div>
        </section>

        {/* ----------------------------------------------------------------- */}
        {/* Section: Message Bubble Variants */}
        {/* ----------------------------------------------------------------- */}
        <section>
          <SectionHeader
            title="Message Bubble Variants"
            description="Individual message bubble styles: user, assistant, system, and quote."
          />
          <div className="bg-white rounded-xl shadow-[0_1px_3px_rgba(0,0,0,0.05)] border border-gray-200 p-6 space-y-4">
            {/* User */}
            <div className="flex justify-end">
              <div className="px-3 py-2 rounded-lg rounded-br-sm bg-gray-900 text-white max-w-[85%]">
                <p className="text-sm font-normal whitespace-pre-wrap">This is a user message bubble.</p>
              </div>
            </div>
            {/* Assistant */}
            <div className="flex justify-start">
              <div className="px-3 py-2 rounded-lg rounded-bl-sm bg-gray-100 text-gray-900 max-w-[85%]">
                <p className="text-sm font-normal">This is an assistant message bubble.</p>
              </div>
            </div>
            {/* System — centered, muted notice (e.g. "Workspace shared.") */}
            <div className="flex justify-center">
              <div className="bg-gray-100 text-gray-500 text-xs font-medium rounded-md px-3 py-1.5 max-w-[90%] text-center">
                This is a system notice.
              </div>
            </div>
            {/* Quote */}
            <div className="flex justify-start">
              <div className="border-l-4 border-gray-400 pl-4 py-2 max-w-[85%]">
                <p className="text-sm font-normal text-gray-600 italic">This is a quote-style message.</p>
              </div>
            </div>
          </div>
        </section>

        {/* ----------------------------------------------------------------- */}
        {/* Section: Chat Input Area */}
        {/* ----------------------------------------------------------------- */}
        <section>
          <SectionHeader
            title="Chat Input Area"
            description="Text input with send button, both enabled and disabled states."
          />
          <div className="bg-white rounded-xl shadow-[0_1px_3px_rgba(0,0,0,0.05)] border border-gray-200 p-6 space-y-4">
            {/* Active */}
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Active (with text)</p>
            <div className="border-t border-gray-100 p-2">
              <div className="flex gap-2">
                <textarea
                  defaultValue="Review my GACIOD framework"
                  className="flex-1 resize-none border border-gray-200 rounded-lg px-3 py-2 text-sm font-normal focus:outline-none focus:ring-1 focus:ring-gray-300 focus:border-transparent bg-gray-50"
                  rows={1}
                  readOnly
                />
                <button className="px-3 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors text-sm font-medium">
                  Send
                </button>
              </div>
            </div>
            {/* Disabled */}
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Disabled (loading)</p>
            <div className="border-t border-gray-100 p-2">
              <div className="flex gap-2">
                <textarea
                  defaultValue=""
                  placeholder="Type a message..."
                  className="flex-1 resize-none border border-gray-200 rounded-lg px-3 py-2 text-sm font-normal focus:outline-none focus:ring-1 focus:ring-gray-300 focus:border-transparent bg-gray-50"
                  rows={1}
                  readOnly
                />
                <button className="px-3 py-2 bg-gray-900 text-white rounded-lg transition-colors text-sm font-medium opacity-50 cursor-not-allowed" disabled>
                  ...
                </button>
              </div>
            </div>
          </div>
        </section>

      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Helper components
// ---------------------------------------------------------------------------

function SectionHeader({ title, description }: { title: string; description: string }) {
  return (
    <div className="mb-4">
      <h2 className="font-display text-lg tracking-tight text-gray-900">{title}</h2>
      <p className="text-sm text-gray-500 mt-0.5">{description}</p>
    </div>
  );
}

function Badge({ label, color }: { label: string; color: string }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold ${color}`}>
      {label}
    </span>
  );
}
