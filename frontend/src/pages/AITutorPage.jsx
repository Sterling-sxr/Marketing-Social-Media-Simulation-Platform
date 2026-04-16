import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { BotMessageSquare, Send, Sparkles, RotateCcw, ChevronDown, ChevronUp } from "lucide-react";
import { postJson } from "../lib/api";
import { useApp } from "../context/AppContext";
import AuthenticatedShell from "./components/AuthenticatedShell";

// This component shows the animated typing dots.
// It is displayed while the AI answer is loading.
function TypingDots() {
  return (
    <span className="inline-flex items-center gap-1">
      {/* Create three small dots. */}
      {/* Each dot uses the same style. */}
      {/* A delay is added to make the animation look sequential. */}
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="h-2 w-2 rounded-full bg-fuchsia-400 animate-bounce"
          style={{ animationDelay: `${i * 0.15}s` }}
        />
      ))}
    </span>
  );
}

// This component renders one AI answer card.
// It shows the direct answer.
// It can also show explanation, example, and key points.
function AnswerCard({ answer, index }) {
  // This state controls whether the card is expanded.
  // true means the content is visible.
  // false means the content is hidden.
  const [expanded, setExpanded] = useState(true);

  return (
    <div className="rounded-[1.75rem] border border-fuchsia-100/80 bg-white/95 shadow-[0_14px_36px_rgba(217,70,239,0.08)] overflow-hidden">
      {/* This is the header of the answer card. */}
      {/* It contains the icon, label, and expand button. */}
      <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-fuchsia-50">
        <div className="flex items-center gap-3">
          {/* This small icon block marks the answer as an AI response. */}
          <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-gradient-to-br from-fuchsia-400 via-pink-300 to-amber-300 text-white shadow-md shadow-fuchsia-200/60 shrink-0">
            <BotMessageSquare className="h-4 w-4" />
          </div>

          {/* This label shows the answer number in the conversation. */}
          <span className="text-xs font-semibold uppercase tracking-[0.2em] text-fuchsia-500">
            AI Tutor · Answer {index + 1}
          </span>
        </div>

        {/* This button toggles the card content. */}
        {/* When clicked, it switches expanded between true and false. */}
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="rounded-xl p-1.5 text-slate-400 hover:bg-fuchsia-50 hover:text-fuchsia-500 transition"
          aria-label={expanded ? "Collapse" : "Expand"}
        >
          {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>
      </div>

      {/* Only render the content when expanded is true. */}
      {expanded && (
        <div className="divide-y divide-fuchsia-50 px-5">
          {/* This section shows the short direct answer. */}
          <section className="py-4">
            <p className="mb-1 text-xs font-semibold uppercase tracking-[0.18em] text-orange-500">
              Direct Answer
            </p>
            <p className="text-base font-semibold text-slate-900 leading-relaxed">
              {answer.short_answer}
            </p>
          </section>

          {/* This section shows the detailed explanation. */}
          {/* It is rendered only if detailed_explanation exists. */}
          {answer.detailed_explanation && (
            <section className="py-4">
              <p className="mb-1 text-xs font-semibold uppercase tracking-[0.18em] text-fuchsia-500">
                Explanation
              </p>
              <p className="text-sm text-slate-700 leading-7 whitespace-pre-wrap">
                {answer.detailed_explanation}
              </p>
            </section>
          )}

          {/* This section shows an example. */}
          {/* It is rendered only if example exists. */}
          {answer.example && (
            <section className="py-4">
              <p className="mb-1 text-xs font-semibold uppercase tracking-[0.18em] text-emerald-500">
                Example
              </p>
              <div className="rounded-2xl bg-emerald-50/70 border border-emerald-100 px-4 py-3">
                <p className="text-sm text-emerald-800 leading-6 whitespace-pre-wrap">
                  {answer.example}
                </p>
              </div>
            </section>
          )}

          {/* This section shows the key points list. */}
          {/* It is rendered only when key_points exists and is not empty. */}
          {answer.key_points && answer.key_points.length > 0 && (
            <section className="py-4">
              <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-sky-500">
                Key Points
              </p>
              <ul className="space-y-2">
                {/* Render each key point as one list item. */}
                {answer.key_points.map((point, i) => (
                  <li key={i} className="flex items-start gap-2.5">
                    {/* This small badge shows the key point number. */}
                    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-sky-100 to-fuchsia-100 text-xs font-bold text-fuchsia-600">
                      {i + 1}
                    </span>
                    {/* This shows the text of the key point. */}
                    <span className="text-sm text-slate-700 leading-6">{point}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      )}
    </div>
  );
}

// This array stores suggested questions.
// These questions are shown before the user starts chatting.
const SUGGESTED_QUESTIONS = [
  "What is overfitting in machine learning and how do you prevent it?",
  "Can you explain what decorators are in Python?",
  "What does the Third Normal Form (3NF) mean in databases?",
  "What is the difference between HTTP and HTTPS?",
  "What is polymorphism in object-oriented programming?",
  "Can you give a simple explanation of recursion?",
];

// This is the main page component for the AI Tutor.
// It handles authentication.
// It manages chat turns.
// It sends questions to the backend.
// It renders the full page UI.
export default function AITutorPage() {
  // useNavigate is used for page navigation.
  // It is needed for redirecting unauthenticated users.
  const navigate = useNavigate();

  // Get auth state from the global app context.
  // authUser tells us whether the user is logged in.
  // authCheckComplete tells us whether the auth check has finished.
  const { authUser, authCheckComplete } = useApp();

  // Store the current text in the input box.
  const [question, setQuestion] = useState("");

  // Store whether a request is currently being processed.
  const [loading, setLoading] = useState(false);

  // Store the current error message.
  const [error, setError] = useState("");

  // Store the full conversation turns.
  // Each turn contains the user question and the AI answer.
  // Example: [{ question, answer }]
  const [turns, setTurns] = useState([]);

  // This ref points to the invisible bottom element.
  // It is used for auto-scrolling after new content appears.
  const bottomRef = useRef(null);

  // This ref points to the textarea input.
  // It is used to focus the input after actions finish.
  const textareaRef = useRef(null);

  // This effect protects the page with an auth guard.
  // If auth checking is not finished, do nothing yet.
  // If auth checking is done and there is no user, redirect to login.
  useEffect(() => {
    if (!authCheckComplete) return;
    if (!authUser) navigate("/login", { replace: true });
  }, [authCheckComplete, authUser, navigate]);

  // This effect scrolls the page to the bottom.
  // It runs when turns change.
  // It also runs when loading changes.
  // This keeps the latest message visible.
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [turns, loading]);

  // This helper builds the chat history for the backend.
  // It converts local turns into a role-based message array.
  // Each question becomes a "user" message.
  // Each answer becomes an "assistant" message.
  // This supports multi-turn conversation context.
  const buildHistory = useCallback((currentTurns) => {
    const history = [];

    for (const turn of currentTurns) {
      // Push the user question first.
      history.push({ role: "user", content: turn.question });

      // If the answer exists, push the assistant answer too.
      if (turn.answer) {
        history.push({
          role: "assistant",
          content: `${turn.answer.short_answer}\n${turn.answer.detailed_explanation}`,
        });
      }
    }

    return history;
  }, []);

  // This function sends a question to the AI tutor backend.
  // It supports asking from the current input.
  // It also supports asking from a provided suggested question.
  const ask = useCallback(
    async (q) => {
      // Use the provided question if available.
      // Otherwise use the current input value.
      // trim() removes leading and trailing spaces.
      const trimmed = (q || question).trim();

      // Do nothing if the question is empty.
      // Do nothing if a request is already in progress.
      if (!trimmed || loading) return;

      // Clear any old error before starting.
      setError("");

      // Mark request as loading.
      setLoading(true);

      // Clear the input box immediately for a cleaner UX.
      setQuestion("");

      // Build conversation history from previous turns.
      const history = buildHistory(turns);

      // Create a new turn for the current question.
      // The answer starts as null because it has not arrived yet.
      const newTurn = { question: trimmed, answer: null };

      // Add the new turn to the conversation list.
      // This allows the question bubble and typing state to appear immediately.
      setTurns((prev) => [...prev, newTurn]);

      try {
        // Send the question and history to the backend API.
        const data = await postJson("/api/ai/tutor/", {
          question: trimmed,
          history,
        });

        // When the response returns, update the last turn.
        // Replace its null answer with the real answer data.
        setTurns((prev) =>
          prev.map((t, i) =>
            i === prev.length - 1 ? { ...t, answer: data } : t
          )
        );
      } catch (err) {
        // If the request fails, show an error message.
        setError(err.message || "Request failed. Please try again later.");

        // Remove the last temporary turn.
        // This avoids leaving a question with no answer in the UI.
        setTurns((prev) => prev.slice(0, -1));
      } finally {
        // Stop the loading state no matter what happens.
        setLoading(false);

        // Focus the textarea again for better usability.
        textareaRef.current?.focus();
      }
    },
    [question, loading, turns, buildHistory]
  );

  // This handles normal form submission.
  // It prevents the browser's default refresh behavior.
  // Then it calls ask().
  const handleSubmit = (e) => {
    e.preventDefault();
    ask();
  };

  // This handles Enter key behavior in the textarea.
  // Enter without Shift sends the question.
  // Shift + Enter creates a new line.
  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      ask();
    }
  };

  // This clears the whole chat state.
  // It removes all turns.
  // It clears any current error.
  // It clears the input box.
  // Then it focuses the textarea again.
  const handleClear = () => {
    setTurns([]);
    setError("");
    setQuestion("");
    textareaRef.current?.focus();
  };

  // This tells us whether the conversation already has any turns.
  // It is used to switch between the empty state and chat state.
  const hasTurns = turns.length > 0;

  return (
    <AuthenticatedShell
      title="AI Tutor"
      subtitle="Ask questions and get structured, in-depth explanations to support your learning."
    >
      {/* This is the hero section at the top of the page. */}
      {/* It introduces the AI Tutor feature to the user. */}
      <section className="relative overflow-hidden rounded-[2rem] border border-fuchsia-100 bg-[radial-gradient(circle_at_top_left,rgba(217,70,239,0.18),transparent_40%),linear-gradient(135deg,rgba(255,255,255,0.96),rgba(245,243,255,0.92)_50%,rgba(255,247,237,0.94))] p-5 shadow-[0_16px_40px_rgba(217,70,239,0.10)] sm:p-6">
        {/* Decorative background glow. */}
        <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-fuchsia-200/30 blur-3xl" />

        {/* Decorative background glow. */}
        <div className="absolute bottom-0 left-4 h-20 w-20 rounded-full bg-amber-200/40 blur-2xl" />

        <div className="relative flex items-start gap-4">
          {/* Main icon for the hero section. */}
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-fuchsia-400 via-pink-300 to-amber-300 text-white shadow-lg shadow-fuchsia-200/70">
            <Sparkles className="h-6 w-6" />
          </div>

          <div>
            {/* Small label above the title. */}
            <p className="text-sm font-semibold uppercase tracking-[0.22em] text-fuchsia-500">
              Intelligent Tutoring
            </p>

            {/* Main title. */}
            <h2 className="text-xl font-bold text-slate-900 sm:text-2xl">
              Got a question? Just ask.
            </h2>

            {/* Short feature description. */}
            <p className="mt-1 text-sm text-slate-500">
              Multi-turn conversations supported. Every answer includes a direct reply, detailed explanation, examples, and key takeaways.
            </p>
          </div>
        </div>
      </section>

      {/* Show suggested questions only before the first chat turn. */}
      {!hasTurns && (
        <section>
          {/* Section title for suggested questions. */}
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
            Try asking
          </p>

          <div className="flex flex-wrap gap-2">
            {/* Render one button for each suggested question. */}
            {SUGGESTED_QUESTIONS.map((q) => (
              <button
                key={q}
                type="button"
                onClick={() => ask(q)}
                disabled={loading}
                className="rounded-full border border-fuchsia-200 bg-fuchsia-50/70 px-3.5 py-2 text-sm font-medium text-slate-700 transition hover:border-pink-200 hover:bg-white hover:text-fuchsia-700 focus:outline-none focus:ring-2 focus:ring-fuchsia-100 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {q}
              </button>
            ))}
          </div>
        </section>
      )}

      {/* Show the conversation only when at least one turn exists. */}
      {hasTurns && (
        <div className="space-y-6">
          {/* Render each turn in the conversation. */}
          {turns.map((turn, i) => (
            <div key={i} className="space-y-3">
              {/* This is the user question bubble. */}
              <div className="flex justify-end">
                <div className="max-w-[80%] rounded-[1.5rem] rounded-tr-md bg-gradient-to-br from-fuchsia-500 to-pink-500 px-5 py-3 text-sm font-medium text-white shadow-md shadow-fuchsia-200/50">
                  {turn.question}
                </div>
              </div>

              {/* If the answer exists, render the answer card. */}
              {/* Otherwise show the typing/loading indicator. */}
              {turn.answer ? (
                <AnswerCard answer={turn.answer} index={i} />
              ) : (
                <div className="flex items-center gap-3 rounded-[1.75rem] border border-fuchsia-100/80 bg-white/95 px-5 py-4 shadow-sm">
                  {/* Small AI icon next to typing dots. */}
                  <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-gradient-to-br from-fuchsia-400 via-pink-300 to-amber-300 text-white shrink-0">
                    <BotMessageSquare className="h-4 w-4" />
                  </div>

                  {/* Show animated dots while the answer is loading. */}
                  <TypingDots />
                </div>
              )}
            </div>
          ))}

          {/* Invisible anchor element used for auto-scroll. */}
          <div ref={bottomRef} />
        </div>
      )}

      {/* Show error message if an error exists. */}
      {error && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      )}

      {/* Input section fixed near the bottom of the page. */}
      {/* It keeps the input accessible while chatting. */}
      <div className="sticky bottom-0 -mx-4 bg-white/90 px-4 pb-4 pt-3 backdrop-blur sm:-mx-5 sm:px-5 lg:-mx-6 lg:px-6">
        {/* Show the clear chat button only when turns exist. */}
        {hasTurns && (
          <div className="mb-2 flex justify-end">
            <button
              type="button"
              onClick={handleClear}
              className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-500 transition hover:border-rose-200 hover:text-rose-500 focus:outline-none"
            >
              <RotateCcw className="h-3 w-3" />
              Clear chat
            </button>
          </div>
        )}

        {/* This form sends the question. */}
        <form onSubmit={handleSubmit} className="flex items-end gap-3">
          <div className="relative flex-1">
            {/* Main input area for the question. */}
            <textarea
              ref={textareaRef}
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type your question… (Enter to send, Shift+Enter for new line)"
              rows={2}
              maxLength={2000}
              disabled={loading}
              className="w-full resize-none rounded-[1.25rem] border border-fuchsia-200 bg-white/90 px-4 py-3 text-sm text-slate-800 shadow-sm outline-none transition focus:border-fuchsia-300 focus:ring-4 focus:ring-fuchsia-100 disabled:cursor-not-allowed disabled:opacity-60"
            />

            {/* Show character count only when the input is close to the limit. */}
            {question.length > 1800 && (
              <span className="absolute bottom-2 right-3 text-[10px] text-slate-400">
                {question.length}/2000
              </span>
            )}
          </div>

          {/* Send button. */}
          {/* It is disabled when the input is empty or loading is true. */}
          <button
            type="submit"
            disabled={!question.trim() || loading}
            className="mb-0.5 flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-fuchsia-500 via-pink-400 to-amber-400 text-white shadow-lg shadow-fuchsia-200/70 transition hover:brightness-105 focus:outline-none focus:ring-4 focus:ring-fuchsia-100 disabled:cursor-not-allowed disabled:opacity-50"
            aria-label="Send"
          >
            <Send className="h-5 w-5" />
          </button>
        </form>
      </div>
    </AuthenticatedShell>
  );
}
