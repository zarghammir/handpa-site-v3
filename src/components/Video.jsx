import React from 'react'

const Video = () => {
  return (
    <section className="py-20 px-8 bg-cream">
      <div className="max-w-7xl mx-auto grid md:grid-cols-2 gap-16 items-center">

        {/* Left — Text + Testimonial */}
        <div className="space-y-8">

          <h2 className="text-4xl md:text-5xl font-black text-forest leading-tight">
            Handpan learning at <br /> your fingertips
          </h2>

          {/* Testimonial */}
          <div className="space-y-4">
            <div className="flex gap-3">
              <span className="text-orange text-4xl font-black leading-none">"</span>
              <p className="text-forest/70 text-base leading-relaxed">
                I absolutely adore this course and feel such a progress with my
                playing 🙏 It really gave me tools to develop my own creativity and
                have fun with the instrument, I highly recommend it to every
                Handpan player!
              </p>
            </div>

            {/* Student */}
            <div className="flex items-center gap-4 pt-2">
              <img
                src="https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=80&h=80&fit=crop"
                alt="Kim Azulay"
                className="w-14 h-14 rounded-full object-cover ring-2 ring-orange"
              />
              <div>
                <p className="font-bold text-forest text-sm">Kim Azulay</p>
                <p className="text-forest/50 text-sm">Netherlands</p>
              </div>
            </div>
          </div>

          {/* Link */}
          <a
            href="#testimonials"
            className="inline-flex items-center gap-2 text-forest font-semibold text-sm hover:text-orange transition-colors duration-200"
          >
            More student feedback →
          </a>

        </div>

        {/* Right — Video */}
        <div className="relative">

          {/* Orange border frame */}
          <div className="absolute -top-3 -right-3 w-full h-full border-2 border-orange/60 rounded-2xl" />

          {/* Video wrapper */}
          <div className="relative rounded-2xl overflow-hidden shadow-lg bg-forest aspect-video">
            <iframe
              src="https://www.youtube.com/embed/dQw4w9WgXcQ"
              title="Handpan lesson preview"
              className="w-full h-full"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />

            {/* Play button overlay — shows before play */}
            {/* <div className="absolute inset-0 flex items-start justify-start p-4 pointer-events-none">
              <div className="bg-orange rounded-full w-12 h-12 flex items-center justify-center shadow-lg">
                <svg className="w-5 h-5 text-white ml-1" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M8 5v14l11-7z" />
                </svg>
              </div>
            </div> */}
          </div>

        

        </div>
      </div>
    </section>
  )
}

export default Video