import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { BotMessageSquare, Send, Sparkles, RotateCcw, ChevronDown, ChevronUp } from "lucide-react";
import { postJson } from "../lib/api";
import { useApp } from "../context/AppContext";
import AuthenticatedShell from "./components/AuthenticatedShell";

// ── Helpers ──────────────────────────────────────────────────────────────────

function TypingDots() {
  return (
    <span className="inline-flex items-center gap-1">
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

function AnswerCard({ answer, index }) {
  const [expanded, setExpanded] = useState(true);

  return (
    <div className="rounded-[1.75rem] border border-fuchsia-100/80 bg-white/95 shadow-[0_14px_36px_rgba(217,70,239,0.08)] overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-fuchsia-50">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-gradient-to-br from-fuchsia-400 via-pink-300 to-amber-300 text-white shadow-md shadow-fuchsia-200/60 shrink-0">
            <BotMessageSquare className="h-4 w-4" />
          </div>
          <span className="text-xs font-semibold uppercase tracking-[0.2em] text-fuchsia-500">
            AI 教学助手 · 第 {index + 1} 条回答
          </span>
        </div>
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="rounded-xl p-1.5 text-slate-400 hover:bg-fuchsia-50 hover:text-fuchsia-500 transition"
          aria-label={expanded ? "收起" : "展开"}
        >
          {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>
      </div>

      {expanded && (
        <div className="divide-y divide-fuchsia-50 px-5">
          {/* 直接回答 */}
          <section className="py-4">
            <p className="mb-1 text-xs font-semibold uppercase tracking-[0.18em] text-orange-500">
              直接回答
            </p>
            <p className="text-base font-semibold text-slate-900 leading-relaxed">
              {answer.short_answer}
            </p>
          </section>

          {/* 详细解释 */}
          {answer.detailed_explanation && (
            <section className="py-4">
              <p className="mb-1 text-xs font-semibold uppercase tracking-[0.18em] text-fuchsia-500">
                详细解释
              </p>
              <p className="text-sm text-slate-700 leading-7 whitespace-pre-wrap">
                {answer.detailed_explanation}
              </p>
            </section>
          )}

          {/* 例子 */}
          {answer.example && (
            <section className="py-4">
              <p className="mb-1 text-xs font-semibold uppercase tracking-[0.18em] text-emerald-500">
                例子
              </p>
              <div className="rounded-2xl bg-emerald-50/70 border border-emerald-100 px-4 py-3">
                <p className="text-sm text-emerald-800 leading-6 whitespace-pre-wrap">
                  {answer.example}
                </p>
              </div>
            </section>
          )}

          {/* 要点 */}
          {answer.key_points && answer.key_points.length > 0 && (
            <section className="py-4">
              <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-sky-500">
                关键要点
              </p>
              <ul className="space-y-2">
                {answer.key_points.map((point, i) => (
                  <li key={i} className="flex items-start gap-2.5">
                    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-sky-100 to-fuchsia-100 text-xs font-bold text-fuchsia-600">
                      {i + 1}
                    </span>
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

// ── Main Page ─────────────────────────────────────────────────────────────────

const SUGGESTED_QUESTIONS = [
  "什么是机器学习中的过拟合？如何解决？",
  "请解释一下 Python 中的装饰器是什么",
  "数据库的第三范式是什么意思？",
  "HTTP 和 HTTPS 有什么区别？",
  "什么是面向对象编程中的多态？",
  "请简单解释一下什么是递归",
];

export default function AITutorPage() {
  const navigate = useNavigate();
  const { authUser, authCheckComplete } = useApp();

  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [turns, setTurns] = useState([]); // [{question, answer}]

  const bottomRef = useRef(null);
  const textareaRef = useRef(null);

  // Auth guard
  useEffect(() => {
    if (!authCheckComplete) return;
    if (!authUser) navigate("/login", { replace: true });
  }, [authCheckComplete, authUser, navigate]);

  // Auto scroll to bottom on new answer
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [turns, loading]);

  // Build history from turns for multi-turn context
  const buildHistory = useCallback((currentTurns) => {
    const history = [];
    for (const turn of currentTurns) {
      history.push({ role: "user", content: turn.question });
      if (turn.answer) {
        history.push({
          role: "assistant",
          content: `${turn.answer.short_answer}\n${turn.answer.detailed_explanation}`,
        });
      }
    }
    return history;
  }, []);

  const ask = useCallback(
    async (q) => {
      const trimmed = (q || question).trim();
      if (!trimmed || loading) return;

      setError("");
      setLoading(true);
      setQuestion("");

      const history = buildHistory(turns);
      const newTurn = { question: trimmed, answer: null };
      setTurns((prev) => [...prev, newTurn]);

      try {
        const data = await postJson("/api/ai/tutor/", {
          question: trimmed,
          history,
        });
        setTurns((prev) =>
          prev.map((t, i) =>
            i === prev.length - 1 ? { ...t, answer: data } : t
          )
        );
      } catch (err) {
        setError(err.message || "请求失败，请稍后重试。");
        setTurns((prev) => prev.slice(0, -1));
      } finally {
        setLoading(false);
        textareaRef.current?.focus();
      }
    },
    [question, loading, turns, buildHistory]
  );

  const handleSubmit = (e) => {
    e.preventDefault();
    ask();
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      ask();
    }
  };

  const handleClear = () => {
    setTurns([]);
    setError("");
    setQuestion("");
    textareaRef.current?.focus();
  };

  const hasTurns = turns.length > 0;

  return (
    <AuthenticatedShell
      title="AI 教学助手"
      subtitle="向 AI 提问，获得结构化、深度解析的学习辅导。"
    >
      {/* Hero card */}
      <section className="relative overflow-hidden rounded-[2rem] border border-fuchsia-100 bg-[radial-gradient(circle_at_top_left,rgba(217,70,239,0.18),transparent_40%),linear-gradient(135deg,rgba(255,255,255,0.96),rgba(245,243,255,0.92)_50%,rgba(255,247,237,0.94))] p-5 shadow-[0_16px_40px_rgba(217,70,239,0.10)] sm:p-6">
        <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-fuchsia-200/30 blur-3xl" />
        <div className="absolute bottom-0 left-4 h-20 w-20 rounded-full bg-amber-200/40 blur-2xl" />
        <div className="relative flex items-start gap-4">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-fuchsia-400 via-pink-300 to-amber-300 text-white shadow-lg shadow-fuchsia-200/70">
            <Sparkles className="h-6 w-6" />
          </div>
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.22em] text-fuchsia-500">
              智能辅导
            </p>
            <h2 className="text-xl font-bold text-slate-900 sm:text-2xl">
              有问题？直接问 AI
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              支持多轮对话，每次回答都包含直接答案、详细解释、例子和关键要点。
            </p>
          </div>
        </div>
      </section>

      {/* Suggested questions (shown only when no turns yet) */}
      {!hasTurns && (
        <section>
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
            试试这些问题
          </p>
          <div className="flex flex-wrap gap-2">
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

      {/* Conversation turns */}
      {hasTurns && (
        <div className="space-y-6">
          {turns.map((turn, i) => (
            <div key={i} className="space-y-3">
              {/* User question bubble */}
              <div className="flex justify-end">
                <div className="max-w-[80%] rounded-[1.5rem] rounded-tr-md bg-gradient-to-br from-fuchsia-500 to-pink-500 px-5 py-3 text-sm font-medium text-white shadow-md shadow-fuchsia-200/50">
                  {turn.question}
                </div>
              </div>

              {/* AI answer or loading */}
              {turn.answer ? (
                <AnswerCard answer={turn.answer} index={i} />
              ) : (
                <div className="flex items-center gap-3 rounded-[1.75rem] border border-fuchsia-100/80 bg-white/95 px-5 py-4 shadow-sm">
                  <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-gradient-to-br from-fuchsia-400 via-pink-300 to-amber-300 text-white shrink-0">
                    <BotMessageSquare className="h-4 w-4" />
                  </div>
                  <TypingDots />
                </div>
              )}
            </div>
          ))}
          <div ref={bottomRef} />
        </div>
      )}

      {/* Error message */}
      {error && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      )}

      {/* Input area */}
      <div className="sticky bottom-0 -mx-4 bg-white/90 px-4 pb-4 pt-3 backdrop-blur sm:-mx-5 sm:px-5 lg:-mx-6 lg:px-6">
        {hasTurns && (
          <div className="mb-2 flex justify-end">
            <button
              type="button"
              onClick={handleClear}
              className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-500 transition hover:border-rose-200 hover:text-rose-500 focus:outline-none"
            >
              <RotateCcw className="h-3 w-3" />
              清空对话
            </button>
          </div>
        )}
        <form onSubmit={handleSubmit} className="flex items-end gap-3">
          <div className="relative flex-1">
            <textarea
              ref={textareaRef}
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="输入你的问题… (Enter 发送，Shift+Enter 换行)"
              rows={2}
              maxLength={2000}
              disabled={loading}
              className="w-full resize-none rounded-[1.25rem] border border-fuchsia-200 bg-white/90 px-4 py-3 text-sm text-slate-800 shadow-sm outline-none transition focus:border-fuchsia-300 focus:ring-4 focus:ring-fuchsia-100 disabled:cursor-not-allowed disabled:opacity-60"
            />
            {question.length > 1800 && (
              <span className="absolute bottom-2 right-3 text-[10px] text-slate-400">
                {question.length}/2000
              </span>
            )}
          </div>
          <button
            type="submit"
            disabled={!question.trim() || loading}
            className="mb-0.5 flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-fuchsia-500 via-pink-400 to-amber-400 text-white shadow-lg shadow-fuchsia-200/70 transition hover:brightness-105 focus:outline-none focus:ring-4 focus:ring-fuchsia-100 disabled:cursor-not-allowed disabled:opacity-50"
            aria-label="发送"
          >
            <Send className="h-5 w-5" />
          </button>
        </form>
      </div>
    </AuthenticatedShell>
  );
}
