import React from 'react'

const CTA = () => {
  return (
    <section className="px-8 py-0 bg-forest">
      <div className="max-w-7xl mx-auto">

        <div className=" rounded-3xl px-12 py-16 flex flex-col md:flex-row items-center justify-between gap-8">

          {/* Left — Text */}
          <h2 className="text-4xl md:text-5xl font-black text-cream leading-tight max-w-xl">
            Ready for your journey? <br />
            <span className="text-sage">Enrol now</span> and get one session for free.
          </h2>

          {/* Right — Button */}
          <div className="flex items-center gap-6 shrink-0">
            <a
              href="#signup"
              className="px-10 py-5 bg-orange text-white text-lg font-bold rounded-2xl shadow-md hover:bg-orange/90 hover:-translate-y-1 transition-all duration-300 whitespace-nowrap"
            >
              Enrol for Free →
            </a>
          </div>

        </div>
      </div>
    </section>
  )
}

export default CTA