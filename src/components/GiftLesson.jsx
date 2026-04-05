// GiftLesson.jsx — /gift page
import { useState } from "react";

const GiftLesson = () => {
  const [form, setForm]     = useState({
    gifter_name: "", gifter_email: "",
    recipient_name: "", recipient_email: "",
    message: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState("");

  const handleChange = (e) =>
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res  = await fetch("/api/stripe-checkout", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(form),
      });
      const data = await res.json();

      if (!res.ok) throw new Error(data.message || "Something went wrong.");

      // Redirect to Stripe's hosted checkout page
      window.location.href = data.url;

    } catch (e) {
      setError(e.message);
      setLoading(false);
    }
  };

  return (
    <section className="min-h-screen py-16 px-4 bg-cream flex items-center justify-center">
      <div className="w-full max-w-lg">
        <div className="text-center mb-8 space-y-2">
          <span className="inline-block px-5 py-2.5 bg-forest text-cream text-xs font-bold uppercase tracking-widest rounded-full">
            Gift a Lesson
          </span>
          <h1 className="text-4xl font-black text-forest">
            Give the gift of <span className="text-sage">music</span>
          </h1>
          <p className="text-forest/60">
            One handpan lesson — $50. We'll send them a gift code instantly.
          </p>
        </div>

        <div className="bg-white rounded-3xl border border-sand p-8 shadow-sm">
          <form onSubmit={handleSubmit} className="space-y-5">

            <p className="text-sm font-bold text-forest/50 uppercase tracking-widest">
              Your details
            </p>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-bold text-forest mb-1">Your name</label>
                <input name="gifter_name" value={form.gifter_name}
                  onChange={handleChange} required
                  className="w-full rounded-2xl border border-forest/15 bg-cream px-4 py-3 text-forest outline-none focus:border-orange transition-colors"
                  placeholder="Your name" />
              </div>
              <div>
                <label className="block text-sm font-bold text-forest mb-1">Your email</label>
                <input name="gifter_email" type="email" value={form.gifter_email}
                  onChange={handleChange} required
                  className="w-full rounded-2xl border border-forest/15 bg-cream px-4 py-3 text-forest outline-none focus:border-orange transition-colors"
                  placeholder="you@example.com" />
              </div>
            </div>

            <p className="text-sm font-bold text-forest/50 uppercase tracking-widest pt-2">
              Recipient details
            </p>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-bold text-forest mb-1">Their name</label>
                <input name="recipient_name" value={form.recipient_name}
                  onChange={handleChange} required
                  className="w-full rounded-2xl border border-forest/15 bg-cream px-4 py-3 text-forest outline-none focus:border-orange transition-colors"
                  placeholder="Friend's name" />
              </div>
              <div>
                <label className="block text-sm font-bold text-forest mb-1">Their email</label>
                <input name="recipient_email" type="email" value={form.recipient_email}
                  onChange={handleChange} required
                  className="w-full rounded-2xl border border-forest/15 bg-cream px-4 py-3 text-forest outline-none focus:border-orange transition-colors"
                  placeholder="friend@example.com" />
              </div>
            </div>

            <div>
              <label className="block text-sm font-bold text-forest mb-1">
                Personal message <span className="text-forest/40">(optional)</span>
              </label>
              <textarea name="message" value={form.message}
                onChange={handleChange} rows={3}
                className="w-full rounded-2xl border border-forest/15 bg-cream px-4 py-3 text-forest outline-none focus:border-orange transition-colors resize-none"
                placeholder="Write a short note to include with the gift..." />
            </div>

            {error && (
              <p className="text-red-600 text-sm">{error}</p>
            )}

            <button type="submit" disabled={loading}
              className="w-full py-4 bg-orange text-white font-bold rounded-2xl hover:bg-orange/90 hover:-translate-y-0.5 transition-all duration-200 disabled:opacity-50">
              {loading ? "Redirecting to payment..." : "Gift a lesson — $50 →"}
            </button>

            <p className="text-center text-forest/40 text-xs">
              Secure payment via Stripe. Code expires in 3 months.
            </p>
          </form>
        </div>
      </div>
    </section>
  );
};

export default GiftLesson;