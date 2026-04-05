// FAQ.jsx
//
// What this teaches:
//   → Controlled input with React state
//   → Calling your own API from the frontend
//   → Handling loading, success, and error states
//   → Why you call /api/faq (your server) not Anthropic directly

import { useState } from "react";

const SUGGESTED_QUESTIONS = [
  "Do I need experience to start?",
  "Do I need my own handpan?",
  "How do online lessons work?",
  "How do I book a lesson?",
];

const FAQ = () => {
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const ask = async (q) => {
    const text = q || question;
    if (!text.trim()) return;

    setLoading(true);
    setAnswer("");
    setError("");

    try {
      const res = await fetch("/api/faq", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: text }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || "Something went wrong.");
      }

      setAnswer(data.answer);
    } catch (e) {
      setError(e.message || "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleSuggestion = (q) => {
    setQuestion(q);
    ask(q);
  };

  return (
    <section id="faq" className="py-16 md:py-24 px-4 sm:px-8 bg-cream">
      <div className="max-w-2xl mx-auto space-y-8">

        {/* Header */}
        <div className="text-center space-y-3">
          <span className="inline-block px-5 py-2.5 bg-forest text-cream text-xs font-bold uppercase tracking-widest rounded-full">
            Questions
          </span>
          <h2 className="text-3xl sm:text-4xl font-black text-forest">
            Ask anything
          </h2>
          <p className="text-forest/60 text-base leading-relaxed">
            Have a question about lessons? Ask below and get an instant answer.
          </p>
        </div>

        {/* Suggested questions */}
        <div className="flex flex-wrap gap-2 justify-center">
          {SUGGESTED_QUESTIONS.map((q) => (
            <button
              key={q}
              onClick={() => handleSuggestion(q)}
              className="px-4 py-2 rounded-full border border-forest/20 text-sm text-forest/70 hover:bg-forest hover:text-cream transition-all duration-200"
            >
              {q}
            </button>
          ))}
        </div>

        {/* Input */}
        <div className="rounded-3xl border border-sand bg-white p-6 shadow-sm space-y-4">
          <textarea
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                ask();
              }
            }}
            placeholder="What would you like to know about handpan lessons?"
            rows={3}
            className="w-full rounded-2xl border border-forest/15 bg-cream px-4 py-3 text-forest placeholder:text-forest/35 outline-none focus:border-orange transition-colors resize-none"
          />
          <button
            onClick={() => ask()}
            disabled={loading || !question.trim()}
            className="w-full py-4 bg-orange text-white font-bold rounded-2xl hover:bg-orange/90 hover:-translate-y-0.5 transition-all duration-200 disabled:opacity-50 disabled:hover:translate-y-0"
          >
            {loading ? "Thinking..." : "Ask"}
          </button>
        </div>

        {/* Answer */}
        {answer && (
          <div className="rounded-3xl border border-sage/30 bg-white p-6 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-widest text-sage mb-3">
              Answer
            </p>
            <p className="text-forest leading-relaxed">{answer}</p>
            <p className="text-forest/40 text-sm mt-4">
              For specific pricing or scheduling, use the{" "}
              <a href="#contact" className="underline hover:text-orange">
                contact form
              </a>
              .
            </p>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="rounded-3xl border border-red-200 bg-red-50 p-6">
            <p className="text-red-700 text-sm">{error}</p>
          </div>
        )}

      </div>
    </section>
  );
};

export default FAQ;