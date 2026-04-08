// GiftRedeem.jsx — /gift/redeem
import { useState } from "react";
import { Link } from "react-router-dom";

const GiftRedeem = () => {
  const [code, setCode]       = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(null);
  const [error, setError]     = useState("");

  const handleRedeem = async () => {
    if (!code.trim()) return;
    setLoading(true);
    setError("");
    setSuccess(null);

    try {
      const res  = await fetch("/api/gift-redeem", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ code: code.trim() }),
      });
      const data = await res.json();

      if (!res.ok) throw new Error(data.message || "Something went wrong.");

      setSuccess(data);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="min-h-screen py-16 px-4 bg-cream flex items-center justify-center">
      <div className="w-full max-w-md">

        {!success ? (
          <>
            <div className="text-center mb-8 space-y-2">
              <span className="inline-block px-5 py-2.5 bg-forest text-cream text-xs font-bold uppercase tracking-widest rounded-full">
                Redeem Gift
              </span>
              <h1 className="text-4xl font-black text-forest">
                You've got a <span className="text-sage">gift</span>
              </h1>
              <p className="text-forest/60">
                Enter your gift code below to claim your handpan lesson.
              </p>
            </div>

            <div className="bg-white rounded-3xl border border-sand p-8 shadow-sm space-y-4">
              <div>
                <label className="block text-sm font-bold text-forest mb-2">
                  Gift code
                </label>
                <input
                  type="text"
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  onKeyDown={(e) => e.key === "Enter" && handleRedeem()}
                  placeholder="GIFT-XXXX-XXXX"
                  className="w-full rounded-2xl border border-forest/15 bg-cream px-4 py-3 text-forest font-mono text-lg tracking-widest outline-none focus:border-orange transition-colors text-center uppercase"
                />
              </div>

              {error && (
                <p className="text-red-600 text-sm text-center">{error}</p>
              )}

              <button
                onClick={handleRedeem}
                disabled={loading || !code.trim()}
                className="w-full py-4 bg-orange text-white font-bold rounded-2xl hover:bg-orange/90 hover:-translate-y-0.5 transition-all duration-200 disabled:opacity-50"
              >
                {loading ? "Checking..." : "Redeem gift code"}
              </button>
            </div>
          </>
        ) : (
          // Success state
          <div className="bg-white rounded-3xl border border-sand p-8 shadow-sm text-center space-y-4">
            <div className="w-16 h-16 bg-sage/20 rounded-full flex items-center justify-center mx-auto">
              <span className="text-3xl">🎵</span>
            </div>
            <h2 className="text-3xl font-black text-forest">
              Code redeemed!
            </h2>
            <p className="text-forest/60">
              Hi <strong>{success.recipient_name}</strong> — your gift from{" "}
              <strong>{success.gifter_name}</strong> has been activated.
            </p>
            <div className="bg-cream rounded-2xl p-4 text-sm text-forest/70 leading-relaxed">
              Head to the booking page to schedule your lesson. Your code has
              been marked as used — just mention it when booking and Medya
              will confirm your free session.
            </div>
            <Link
              to="/signup"
              className="inline-block w-full py-4 bg-orange text-white font-bold rounded-2xl hover:bg-orange/90 transition-all duration-200"
            >
              Book your lesson →
            </Link>
          </div>
        )}

      </div>
    </section>
  );
};

export default GiftRedeem;