'use client';

import Chat, { Message, Improvement, Modification } from '@/components/Chat';
import SuggestionsTimeline from '@/components/SuggestionsTimeline';
import GACIODCard from '@/components/GACIODCard';
import ChatSidebar from '@/components/ChatSidebar';
import { useState } from 'react';

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
        <h1 className="text-lg font-bold text-gray-900">Debug: Chat UI/UX Elements</h1>
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
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 h-[700px] overflow-hidden">
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
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 h-48 overflow-hidden">
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
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 h-48 overflow-hidden">
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
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {[
                { type: 'Suggestion', text: 'Consider adding rate limiting to your matchmaking API.', color: 'bg-blue-50 border-blue-200', textColor: 'text-blue-900', icon: '\u{1f4a1}' },
                { type: 'Strength', text: 'Your constraint on queue times is well-defined and measurable.', color: 'bg-green-50 border-green-200', textColor: 'text-green-900', icon: '\u2728' },
                { type: 'Concern', text: 'Skill-based matching may cause long queues in low-population regions.', color: 'bg-orange-50 border-orange-200', textColor: 'text-orange-900', icon: '\u26a0\ufe0f' },
                { type: 'Question', text: 'How will you handle players who disconnect mid-match?', color: 'bg-purple-50 border-purple-200', textColor: 'text-purple-900', icon: '\u2753' },
                { type: 'Consideration', text: 'Time-of-day effects on matchmaking pool size should be modelled.', color: 'bg-yellow-50 border-yellow-200', textColor: 'text-yellow-900', icon: '\u{1f914}' },
                { type: 'Missing', text: 'No decision exists for handling new players without rating history.', color: 'bg-red-50 border-red-200', textColor: 'text-red-900', icon: '\u{1f50d}' },
                { type: 'Conflict', text: 'Strict matching and fast queues are at odds — needs resolution.', color: 'bg-orange-50 border-orange-200', textColor: 'text-orange-900', icon: '\u26a0\ufe0f' },
                { type: 'Unclear', text: 'It is ambiguous whether "region" means continent or data-centre.', color: 'bg-gray-50 border-gray-300', textColor: 'text-gray-800', icon: '\u2754' },
                { type: 'Incomplete', text: 'The anti-cheat constraint lacks specifics on detection methods.', color: 'bg-red-50 border-red-200', textColor: 'text-red-900', icon: '\u{1f4dd}' },
              ].map(({ type, text, color, textColor, icon }) => (
                <div key={type} className={`border rounded-lg p-3 ${color}`}>
                  <div className="flex items-center gap-1.5 mb-2">
                    <span>{icon}</span>
                    <span className={`text-xs font-semibold ${textColor}`}>{type}</span>
                  </div>
                  <p className="text-sm font-normal text-gray-900">{text}</p>
                </div>
              ))}
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
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 space-y-4">
            {/* Pending */}
            <div>
              <Badge label="Pending" color="bg-amber-100 text-amber-700" />
              <div className="mt-2 p-3 bg-white border border-gray-200 rounded-lg shadow-sm">
                <div className="mb-3">
                  <p className="text-xs font-semibold text-gray-800 mb-1">Suggested improvement for Goals:</p>
                  <p className="text-xs font-normal text-gray-600 mb-2 italic">Making the goal measurable makes it easier to verify.</p>
                  <div className="text-sm space-y-2">
                    <div className="bg-red-50 border-l-3 border-red-400 rounded-r p-2.5">
                      <span className="text-xs font-semibold text-red-900 uppercase tracking-wide">Current</span>
                      <div className="text-red-950 font-normal mt-1 leading-relaxed">Fair matchmaking for all players</div>
                    </div>
                    <div className="bg-green-50 border-l-3 border-green-500 rounded-r p-2.5">
                      <span className="text-xs font-semibold text-green-900 uppercase tracking-wide">Suggested</span>
                      <div className="text-green-950 font-normal mt-1 leading-relaxed">Ensure equitable match outcomes by pairing players within a 200-point MMR band</div>
                    </div>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button className="flex-1 px-3 py-1.5 bg-green-700 text-white text-xs font-semibold rounded hover:bg-green-800 transition-colors">Accept</button>
                  <button className="flex-1 px-3 py-1.5 bg-gray-100 text-gray-800 text-xs font-semibold rounded border border-gray-300 hover:bg-gray-200 transition-colors">Deny</button>
                </div>
              </div>
            </div>
            {/* Accepted */}
            <div>
              <Badge label="Accepted" color="bg-green-100 text-green-700" />
              <div className="mt-2 p-2 rounded-lg text-xs flex items-center gap-1.5 bg-green-50 text-green-700">
                <span>&#10003;</span>
                <span className="font-semibold">Accepted:</span>
                <span>Assumptions improvement</span>
              </div>
            </div>
            {/* Denied */}
            <div>
              <Badge label="Denied" color="bg-gray-100 text-gray-500" />
              <div className="mt-2 p-2 rounded-lg text-xs flex items-center gap-1.5 bg-gray-50 text-gray-500">
                <span>&#10007;</span>
                <span className="font-semibold">Denied:</span>
                <span>Constraints improvement</span>
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
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* ADD */}
              <div>
                <Badge label="ADD (pending)" color="bg-green-100 text-green-700" />
                <div className="mt-2 p-3 bg-white border border-gray-200 rounded-lg shadow-sm">
                  <div className="mb-3">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm">&#10133;</span>
                      <span className="text-xs font-semibold text-green-800">ADD in Goals</span>
                    </div>
                    <p className="text-xs font-normal text-gray-600 mb-2 italic">A core goal for matchmaking.</p>
                    <div className="bg-green-50 border-l-3 border-green-500 rounded-r p-2.5">
                      <span className="text-xs font-semibold text-green-900 uppercase tracking-wide">Add</span>
                      <div className="text-green-950 font-normal mt-1 leading-relaxed text-sm">Minimise skill disparity between teams</div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button className="flex-1 px-3 py-1.5 bg-green-700 text-white text-xs font-semibold rounded">Accept</button>
                    <button className="flex-1 px-3 py-1.5 bg-gray-100 text-gray-800 text-xs font-semibold rounded border border-gray-300">Deny</button>
                  </div>
                </div>
              </div>
              {/* UPDATE */}
              <div>
                <Badge label="UPDATE (pending)" color="bg-indigo-100 text-indigo-700" />
                <div className="mt-2 p-3 bg-white border border-gray-200 rounded-lg shadow-sm">
                  <div className="mb-3">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm">&#9999;&#65039;</span>
                      <span className="text-xs font-semibold text-indigo-800">UPDATE in Constraints (C-01)</span>
                    </div>
                    <p className="text-xs font-normal text-gray-600 mb-2 italic">Quantifying the constraint.</p>
                    <div className="text-sm space-y-2">
                      <div className="bg-red-50 border-l-3 border-red-400 rounded-r p-2.5">
                        <span className="text-xs font-semibold text-red-900 uppercase tracking-wide">Current</span>
                        <div className="text-red-950 font-normal mt-1 leading-relaxed">Low latency queue times</div>
                      </div>
                      <div className="bg-green-50 border-l-3 border-green-500 rounded-r p-2.5">
                        <span className="text-xs font-semibold text-green-900 uppercase tracking-wide">Replace with</span>
                        <div className="text-green-950 font-normal mt-1 leading-relaxed">Queue times under 60s at the 95th percentile</div>
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button className="flex-1 px-3 py-1.5 bg-green-700 text-white text-xs font-semibold rounded">Accept</button>
                    <button className="flex-1 px-3 py-1.5 bg-gray-100 text-gray-800 text-xs font-semibold rounded border border-gray-300">Deny</button>
                  </div>
                </div>
              </div>
              {/* DELETE */}
              <div>
                <Badge label="DELETE (pending)" color="bg-red-100 text-red-700" />
                <div className="mt-2 p-3 bg-white border border-gray-200 rounded-lg shadow-sm">
                  <div className="mb-3">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm">&#128465;&#65039;</span>
                      <span className="text-xs font-semibold text-red-800">DELETE in Ideas (I-03)</span>
                    </div>
                    <p className="text-xs font-normal text-gray-600 mb-2 italic">Random matchmaking undermines fairness.</p>
                    <div className="bg-red-50 border-l-3 border-red-400 rounded-r p-2.5">
                      <span className="text-xs font-semibold text-red-900 uppercase tracking-wide">Remove</span>
                      <div className="text-red-950 font-normal mt-1 leading-relaxed text-sm">Use random matchmaking as fallback</div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button className="flex-1 px-3 py-1.5 bg-green-700 text-white text-xs font-semibold rounded">Accept</button>
                    <button className="flex-1 px-3 py-1.5 bg-gray-100 text-gray-800 text-xs font-semibold rounded border border-gray-300">Deny</button>
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
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 h-[500px] overflow-hidden">
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
              />
            </div>
            <div className="h-56">
              <GACIODCard
                title="Assumptions"
                content={gaciodContent.assumptions}
                onUpdate={(v) => setGaciodContent((prev) => ({ ...prev, assumptions: v }))}
                highlightedIndices={[1]}
              />
            </div>
            <div className="h-56">
              <GACIODCard
                title="Constraints"
                content={gaciodContent.constraints}
                onUpdate={(v) => setGaciodContent((prev) => ({ ...prev, constraints: v }))}
                highlightedIndices={[0]}
              />
            </div>
            <div className="h-56">
              <GACIODCard
                title="Ideas"
                content={gaciodContent.ideas}
                onUpdate={(v) => setGaciodContent((prev) => ({ ...prev, ideas: v }))}
                highlightedIndices={[]}
              />
            </div>
            <div className="h-56">
              <GACIODCard
                title="Opinions"
                content={gaciodContent.opinions}
                onUpdate={(v) => setGaciodContent((prev) => ({ ...prev, opinions: v }))}
                highlightedIndices={[]}
              />
            </div>
            <div className="h-56">
              <GACIODCard
                title="Decisions"
                content={gaciodContent.decisions}
                onUpdate={(v) => setGaciodContent((prev) => ({ ...prev, decisions: v }))}
                highlightedIndices={[]}
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
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 h-96 overflow-hidden flex">
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
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="grid grid-cols-3 gap-1.5 max-w-md">
              <button className="bg-gray-50 border border-gray-200 rounded-lg py-2 hover:bg-gray-100 hover:border-gray-300 transition-all flex items-center justify-center gap-1.5">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-3.5 h-3.5 text-blue-600 shrink-0">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
                </svg>
                <span className="text-[11px] font-medium text-gray-600 whitespace-nowrap">Review</span>
              </button>
              <button className="bg-gray-50 border border-gray-200 rounded-lg py-2 hover:bg-gray-100 hover:border-gray-300 transition-all flex items-center justify-center gap-1.5">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-3.5 h-3.5 text-orange-600 shrink-0">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607zM10.5 7.5v6m3-3h-6" />
                </svg>
                <span className="text-[11px] font-medium text-gray-600 whitespace-nowrap">Gaps</span>
              </button>
              <button className="bg-gray-50 border border-gray-200 rounded-lg py-2 hover:bg-gray-100 hover:border-gray-300 transition-all flex items-center justify-center gap-1.5">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-3.5 h-3.5 text-green-600 shrink-0">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z" />
                </svg>
                <span className="text-[11px] font-medium text-gray-600 whitespace-nowrap">Improve</span>
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
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 flex gap-4 flex-wrap">
            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-100 text-amber-700">
              &#9679; Pending
            </span>
            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-green-100 text-green-700">
              &#10003; Accepted
            </span>
            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-gray-100 text-gray-500">
              &#10007; Denied
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
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 space-y-4">
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
            {/* System */}
            <div className="flex justify-start">
              <div className="px-3 py-2 rounded-lg bg-gray-100 text-gray-700 border border-gray-200 max-w-[85%]">
                <p className="text-sm font-normal">This is a system message bubble.</p>
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
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 space-y-4">
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
      <h2 className="text-base font-semibold text-gray-900">{title}</h2>
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
