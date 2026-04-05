import React from 'react'

const Video = () => {
  return (
    <section id="video" className="py-12 md:py-20 px-4 sm:px-8 bg-cream">
      <div className="max-w-7xl mx-auto grid md:grid-cols-2 gap-8 md:gap-16 items-center">

        {/* Left — Text + Testimonial */}
        <div className="space-y-6 md:space-y-8 text-center md:text-left">

          <h2 className="text-3xl sm:text-4xl md:text-5xl font-black text-forest leading-tight">
            Handpan learning at <br className="hidden sm:block" /> your fingertips
          </h2>

          {/* Testimonial */}
          <div className="space-y-4">
            <div className="flex gap-3">
              <span className="text-orange text-4xl font-black leading-none">"</span>
              <p className="text-forest/70 text-sm md:text-base leading-relaxed text-left">
                I absolutely adore this course and feel such a progress with my
                playing 🙏 It really gave me tools to develop my own creativity and
                have fun with the instrument, I highly recommend it to every
                Handpan player!
              </p>
            </div>

            {/* Student */}
            {/* <div className="flex items-center gap-4 pt-2 justify-center md:justify-start">
              <img
                src="https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=80&h=80&fit=crop"
                alt="Kim Azulay"
                className="w-12 h-12 md:w-14 md:h-14 rounded-full object-cover ring-2 ring-orange"
              />
              <div>
                <p className="font-bold text-forest text-sm">Kim Azulay</p>
                <p className="text-forest/50 text-sm">Netherlands</p>
              </div>
            </div> */}
          </div>

          {/* Link */}
          <div className="flex justify-center md:justify-start">
            <a
              href="#testimonials"
              className="inline-flex items-center gap-2 text-forest font-semibold text-sm hover:text-orange transition-colors duration-200"
            >
              More student feedback →
            </a>
          </div>

        </div>

        {/* Right — Video */}
        <div className="relative mt-4 md:mt-0">

          {/* Orange border frame */}
          {/* <div className="absolute -top-3 -right-3 w-full h-full border-2 border-orange/60 rounded-2xl" /> */}

          {/* Video wrapper */}
          <div className="relative rounded-2xl overflow-hidden shadow-lg bg-forest aspect-video">
            <iframe
              src="https://www.youtube.com/embed/dQw4w9WgXcQ"
              title="Handpan lesson preview"
              className="w-full h-full"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          </div>

        </div>
      </div>
    </section>
  )
}

export default Video