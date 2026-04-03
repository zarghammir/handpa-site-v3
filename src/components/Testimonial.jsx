import React, { useState, useEffect } from 'react'

// ─── Testimonial Card ─────────────────────────────────────────────────────────
const Card = ({ text, name, country }) => (
  <div className="bg-sand/50 border border-sand rounded-3xl p-5 md:p-8 space-y-4 md:space-y-5">
    <span className="text-orange text-4xl md:text-5xl font-black leading-none">"</span>
    <p className="text-forest/70 text-sm md:text-base leading-relaxed -mt-4">{text}</p>
    <div>
      <p className="font-bold text-forest text-sm">{name}</p>
      <p className="text-forest/40 text-sm">{country}</p>
    </div>
  </div>
)

// ─── Submission Form ──────────────────────────────────────────────────────────
const SubmitForm = ({ onClose }) => {
  const [form, setForm] = useState({ name: '', country: '', text: '' })
  const [status, setStatus] = useState({ loading: false, success: '', error: '' })

  const handleSubmit = async (e) => {
    e.preventDefault()
    setStatus({ loading: true, success: '', error: '' })

    try {
      const response = await fetch('/api/testimonial-submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.message || 'Something went wrong.')
      }

      setStatus({ loading: false, success: data.message, error: '' })
      setForm({ name: '', country: '', text: '' })
    } catch (err) {
      setStatus({ loading: false, success: '', error: err.message })
    }
  }

  return (
    <div className="mt-10 rounded-3xl border border-sand bg-white p-6 md:p-8 shadow-sm">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-black text-forest">Share your experience</h3>
        <button
          onClick={onClose}
          className="text-forest/40 hover:text-forest text-sm transition-colors"
        >
          Cancel
        </button>
      </div>

      {status.success ? (
        <p className="text-sm font-medium text-green-700 bg-green-50 border border-green-200 rounded-2xl px-4 py-3">
          {status.success}
        </p>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-bold text-forest mb-2">Name</label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Your name"
                required
                className="w-full rounded-2xl border border-forest/15 bg-white px-4 py-3 text-forest placeholder:text-forest/35 outline-none focus:border-orange transition-colors"
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-forest mb-2">Country</label>
              <input
                type="text"
                value={form.country}
                onChange={(e) => setForm({ ...form, country: e.target.value })}
                placeholder="e.g. Canada"
                required
                className="w-full rounded-2xl border border-forest/15 bg-white px-4 py-3 text-forest placeholder:text-forest/35 outline-none focus:border-orange transition-colors"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-bold text-forest mb-2">
              Your experience
              <span className="text-forest/40 font-normal ml-2">
                ({form.text.length}/500)
              </span>
            </label>
            <textarea
              value={form.text}
              onChange={(e) => setForm({ ...form, text: e.target.value })}
              placeholder="Tell others about your lessons with Medya..."
              rows="4"
              maxLength={500}
              required
              className="w-full rounded-2xl border border-forest/15 bg-white px-4 py-3 text-forest placeholder:text-forest/35 outline-none focus:border-orange transition-colors resize-none"
            />
          </div>

          {status.error && (
            <p className="text-sm font-medium text-red-700 bg-red-50 border border-red-200 rounded-2xl px-4 py-3">
              {status.error}
            </p>
          )}

          <button
            type="submit"
            disabled={status.loading}
            className="px-8 py-4 bg-orange text-white text-base font-bold rounded-2xl shadow-md hover:bg-orange/90 hover:-translate-y-1 transition-all duration-300 disabled:opacity-70 disabled:hover:translate-y-0"
          >
            {status.loading ? 'Submitting...' : 'Submit Testimonial'}
          </button>
        </form>
      )}
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────
const Testimonials = () => {
  const [testimonials, setTestimonials] = useState([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(0)
  const [direction, setDirection] = useState(null)
  const [animating, setAnimating] = useState(false)
  const [displayed, setDisplayed] = useState(0)
  const [showForm, setShowForm] = useState(false)

  // Fetch approved testimonials from the API on mount.
  // This is your first GET request — the frontend asks the server,
  // the server asks the database, and sends back only approved rows.
  useEffect(() => {
    const fetchTestimonials = async () => {
      try {
        const response = await fetch('/api/testimonials-get')
        const data = await response.json()

        if (!response.ok) throw new Error(data.message)

        setTestimonials(data.testimonials)
      } catch (err) {
        console.error('Failed to fetch testimonials:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchTestimonials()
  }, [])

  // Group testimonials into pairs for the two-column layout
  const pages = []
  for (let i = 0; i < testimonials.length; i += 2) {
    pages.push(testimonials.slice(i, i + 2))
  }

  const navigate = (dir) => {
    if (animating || pages.length <= 1) return
    setDirection(dir)
    setAnimating(true)
  }

  useEffect(() => {
    if (!animating) return
    const timeout = setTimeout(() => {
      setPage((prev) => {
        const next =
          direction === 'right'
            ? (prev + 1) % pages.length
            : (prev - 1 + pages.length) % pages.length
        setDisplayed(next)
        return next
      })
      setAnimating(false)
      setDirection(null)
    }, 600)
    return () => clearTimeout(timeout)
  }, [animating, direction, pages.length])

  const current = pages[displayed] || []

  const slideClass = animating
    ? direction === 'right'
      ? 'opacity-0 translate-x-8'
      : 'opacity-0 -translate-x-8'
    : 'opacity-100 translate-x-0'

  return (
    <section id="testimonials" className="py-12 md:py-20 px-4 sm:px-8 bg-cream">
      <div className="max-w-7xl mx-auto">

        {/* Heading */}
        <div className="flex flex-col md:flex-row md:items-end md:justify-between mb-8 md:mb-10 gap-4">
          <div className="text-center md:text-left">
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-black text-forest leading-tight">
              Testimonials from <br className="hidden sm:block" /> our students
            </h2>
            <div className="w-24 h-1 bg-orange mt-3 rounded-full mx-auto md:mx-0" />
          </div>

          {!showForm && (
            <button
              onClick={() => setShowForm(true)}
              className="self-center md:self-auto px-6 py-3 border-2 border-forest/20 text-forest text-sm font-bold rounded-2xl hover:bg-sand transition-all duration-200"
            >
              Share your experience →
            </button>
          )}
        </div>

        {/* Cards */}
        {loading ? (
          <div className="grid md:grid-cols-2 gap-4 md:gap-8">
            {[0, 1].map((i) => (
              <div key={i} className="bg-sand/30 border border-sand rounded-3xl p-5 md:p-8 h-48 animate-pulse" />
            ))}
          </div>
        ) : pages.length === 0 ? (
          <p className="text-forest/40 text-center py-12">No testimonials yet.</p>
        ) : (
          <div className={`grid md:grid-cols-2 gap-4 md:gap-8 transition-all duration-300 ease-in-out ${slideClass}`}>
            {current.map((t) => (
              <Card key={t.id} text={t.text} name={t.name} country={t.country} />
            ))}
            {/* If a page has only 1 testimonial, keep the grid balanced */}
            {current.length === 1 && <div />}
          </div>
        )}

        {/* Arrows + Dots — only show if more than one page */}
        {pages.length > 1 && (
          <div className="flex items-center justify-center gap-4 mt-8 md:mt-10">
            <button
              onClick={() => navigate('left')}
              className="w-10 h-10 rounded-full border-2 border-forest/20 flex items-center justify-center text-forest text-xl hover:border-orange hover:text-orange transition-colors"
            >
              ‹
            </button>

            <div className="flex gap-2">
              {pages.map((_, i) => (
                <button
                  key={i}
                  onClick={() => {
                    if (i > page) navigate('right')
                    else if (i < page) navigate('left')
                  }}
                  className={`h-2 rounded-full transition-all duration-300 ${
                    i === displayed ? 'bg-orange w-6' : 'bg-forest/20 w-2'
                  }`}
                />
              ))}
            </div>

            <button
              onClick={() => navigate('right')}
              className="w-10 h-10 rounded-full border-2 border-forest/20 flex items-center justify-center text-forest text-xl hover:border-orange hover:text-orange transition-colors"
            >
              ›
            </button>
          </div>
        )}

        {/* Submission form */}
        {showForm && <SubmitForm onClose={() => setShowForm(false)} />}

      </div>
    </section>
  )
}

export default Testimonials