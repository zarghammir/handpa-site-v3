import React, { useState } from "react";

const ContactForm = () => {
  const [form, setForm] = useState({
    name: "",
    email: "",
    message: "",
  });

  const [status, setStatus] = useState({
    loading: false,
    success: "",
    error: "",
  });

  const handleChange = (e) => {
    setForm((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    setStatus({
      loading: true,
      success: "",
      error: "",
    });

    try {
      const response = await fetch("/api/contact", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(form),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Something went wrong.");
      }

      setStatus({
        loading: false,
        success: "Your message was sent successfully.",
        error: "",
      });

      setForm({
        name: "",
        email: "",
        message: "",
      });
    } catch (error) {
      setStatus({
        loading: false,
        success: "",
        error: error.message || "Something went wrong.",
      });
    }
  };

  return (
    <section id="contact" className="py-12 md:py-20 px-4 sm:px-8 bg-cream">
      <div className="max-w-7xl mx-auto grid md:grid-cols-2 gap-8 md:gap-16 items-start">
        <div className="space-y-6 text-center md:text-left">
          <div className="flex justify-center md:justify-start">
            <span className="inline-block px-5 py-2.5 bg-forest text-cream text-xs font-bold uppercase tracking-widest rounded-full">
              Contact
            </span>
          </div>

          <h2 className="text-3xl sm:text-4xl md:text-5xl font-black text-forest leading-tight">
            Got a <span className="text-sage">question?</span>
          </h2>

          <p className="text-forest/60 text-base md:text-lg leading-relaxed max-w-xl mx-auto md:mx-0">
            Not ready to book yet? You can send a message here for questions
            about lessons, level, scheduling, or anything else.
          </p>

          {/* <div className="rounded-3xl border border-sand bg-cream p-6 md:p-8 shadow-sm">
            <div className="space-y-3">
              <p className="text-forest font-bold text-lg">
                What this teaches you
              </p>
              <p className="text-forest/60 text-sm md:text-base leading-relaxed">
                This form is your first real API practice. The page sends data to
                your own backend route, and the backend answers back.
              </p>
            </div>
          </div> */}
        </div>

        <div className="rounded-3xl border border-sand bg-white p-6 md:p-8 shadow-sm">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label
                htmlFor="name"
                className="block text-sm font-bold text-forest mb-2"
              >
                Name
              </label>
              <input
                id="name"
                name="name"
                type="text"
                value={form.name}
                onChange={handleChange}
                placeholder="Your name"
                className="w-full rounded-2xl border border-forest/15 bg-white px-4 py-3 text-forest placeholder:text-forest/35 outline-none focus:border-orange transition-colors"
                required
              />
            </div>

            <div>
              <label
                htmlFor="email"
                className="block text-sm font-bold text-forest mb-2"
              >
                Email
              </label>
              <input
                id="email"
                name="email"
                type="email"
                value={form.email}
                onChange={handleChange}
                placeholder="you@example.com"
                className="w-full rounded-2xl border border-forest/15 bg-white px-4 py-3 text-forest placeholder:text-forest/35 outline-none focus:border-orange transition-colors"
                required
              />
            </div>

            <div>
              <label
                htmlFor="message"
                className="block text-sm font-bold text-forest mb-2"
              >
                Message
              </label>
              <textarea
                id="message"
                name="message"
                value={form.message}
                onChange={handleChange}
                placeholder="Write your message here..."
                rows="6"
                className="w-full rounded-2xl border border-forest/15 bg-white px-4 py-3 text-forest placeholder:text-forest/35 outline-none focus:border-orange transition-colors resize-none"
                required
              />
            </div>

            <button
              type="submit"
              disabled={status.loading}
              className="w-full md:w-auto px-8 py-4 bg-orange text-white text-base font-bold rounded-2xl shadow-md hover:bg-orange/90 hover:-translate-y-1 transition-all duration-300 disabled:opacity-70 disabled:hover:translate-y-0"
            >
              {status.loading ? "Sending..." : "Send Message"}
            </button>

            {status.success && (
              <p className="text-sm font-medium text-green-700 bg-green-50 border border-green-200 rounded-2xl px-4 py-3">
                {status.success}
              </p>
            )}

            {status.error && (
              <p className="text-sm font-medium text-red-700 bg-red-50 border border-red-200 rounded-2xl px-4 py-3">
                {status.error}
              </p>
            )}
          </form>
        </div>
      </div>
    </section>
  );
};

export default ContactForm;