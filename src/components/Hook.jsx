import React from 'react'

const Hook = () => {
  return (
    <section className="min-h-screen flex items-center py-20 px-8 bg-white">
      <div className="max-w-7xl mx-auto grid md:grid-cols-2 gap-16 items-center">

        {/* Image */}
        <div className="relative">
          <img
            src ="/images/medya.png"
            alt="Handpan player"
            className="w-full h-[600px] object-cover rounded-3xl shadow-lg ring-2 ring-sage/40"
          />
          {/* Floating badge */}
          <div className="absolute bottom-6 left-6 bg-orange px-5 py-3 rounded-2xl shadow-lg">
            <p className="text-cream font-bold text-sm">🎵 500+ students worldwide</p>
          </div>
        </div>

        {/* Content */}
        <div className="space-y-8">

          {/* Tag */}
          <span className="inline-block px-4 py-2 bg-sage/20 text-forest rounded-full text-sm font-semibold uppercase tracking-wide border border-sage/40">
            Your handpan journey starts here
          </span>

          {/* Headline */}
          <h1 className="text-5xl md:text-6xl font-black leading-tight text-forest">
            Discover the{' '}
            <span className="text-sage">
              handpan's
            </span>{' '}
            magic
          </h1>

          {/* Subtext */}
          <p className="text-lg text-forest/60 leading-relaxed max-w-lg">
            Even if you've never touched an instrument before, I'll guide you
            from your first note to beautiful flowing melodies in weeks, not years.
          </p>

          {/* Stats */}
          <div className="flex gap-8">
            <div>
              <p className="text-3xl font-black text-forest">500+</p>
              <p className="text-forest/40 text-sm">Students</p>
            </div>
            <div className="w-px bg-sage/30" />
            <div>
              <p className="text-3xl font-black text-forest">12+</p>
              <p className="text-forest/40 text-sm">Lessons</p>
            </div>
            <div className="w-px bg-sage/30" />
            <div>
              <p className="text-3xl font-black text-forest">4.9★</p>
              <p className="text-forest/40 text-sm">Rating</p>
            </div>
          </div>

          {/* Buttons */}
          <div className="flex flex-col sm:flex-row gap-4">
            <a
              href="#signup"
              className="px-10 py-5 bg-orange text-white text-lg font-bold rounded-2xl shadow-md hover:bg-orange/90 hover:-translate-y-1 transition-all duration-300"
            >
              Start Free Today
            </a>
            <a
              href="#video"
              className="px-10 py-5 border-2 border-forest/30 text-forest text-lg font-bold rounded-2xl hover:bg-sand transition-all duration-300"
            >
              Watch Me Play
            </a>
          </div>

        </div>
      </div>
    </section>
  )
}

export default Hook