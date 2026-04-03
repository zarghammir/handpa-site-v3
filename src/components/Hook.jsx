import React from "react";
import LiveStats from "./LiveStats";

const Hook = () => {
  return (
    <section className="min-h-screen flex items-center pt-32 pb-12 md:py-20 px-4 sm:px-8 bg-white">
      <div className="max-w-7xl mx-auto grid md:grid-cols-2 gap-8 md:gap-16 items-center">

        <div className="relative order-2 md:order-1">
          <img
            src="/images/medya.png"
            alt="Handpan player"
            className="w-full h-[280px] sm:h-[400px] md:h-[600px] object-cover rounded-3xl shadow-lg ring-2 ring-sage/40"
          />
          <div className="absolute bottom-4 left-4 md:bottom-6 md:left-6 bg-orange px-3 py-2 md:px-5 md:py-3 rounded-2xl shadow-lg">
            <p className="text-cream font-bold text-xs md:text-sm">
              🎵 <LiveStats type="students" suffix="+" /> students worldwide
            </p>
          </div>
        </div>

        <div className="space-y-6 md:space-y-8 order-1 md:order-2 text-center md:text-left">
          <div className="flex justify-center md:justify-start">
            <span className="inline-block px-5 py-2.5 bg-forest text-cream text-xs font-bold rounded-full uppercase tracking-widest">
              Your handpan journey starts here
            </span>
          </div>

          <h1 className="text-4xl sm:text-5xl md:text-5xl lg:text-6xl font-black leading-tight text-forest">
            Discover the <span className="text-sage">handpan's</span> magic
          </h1>

          <p className="text-base md:text-lg text-forest/60 leading-relaxed max-w-lg mx-auto md:mx-0">
            Even if you've never touched an instrument before, I'll guide you
            from your first note to beautiful flowing melodies in weeks, not years.
          </p>

          <div className="flex gap-4 sm:gap-8 justify-center md:justify-start">
            <div>
              <p className="text-2xl md:text-3xl font-black text-forest">
                <LiveStats type="students" suffix="+" />
              </p>
              <p className="text-forest/40 text-xs md:text-sm">Students</p>
            </div>

            <div className="w-px bg-sage/30" />

            <div>
              <p className="text-2xl md:text-3xl font-black text-forest">
                <LiveStats type="lessons" suffix="+" />
              </p>
              <p className="text-forest/40 text-xs md:text-sm">Lessons</p>
            </div>

            <div className="w-px bg-sage/30" />

            <div>
              <p className="text-2xl md:text-3xl font-black text-forest">
                <LiveStats type="hours" suffix="+" />
              </p>
              <p className="text-forest/40 text-xs md:text-sm">Class Hours</p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 md:gap-4 justify-center md:justify-start">
            <a
              href="#signup"
              className="px-8 py-4 md:px-10 md:py-5 bg-orange text-white text-base md:text-lg font-bold rounded-2xl shadow-md hover:bg-orange/90 hover:-translate-y-1 transition-all duration-300 text-center"
            >
              Start Free Today
            </a>
            <a
              href="#video"
              className="px-8 py-4 md:px-10 md:py-5 border-2 border-forest/30 text-forest text-base md:text-lg font-bold rounded-2xl hover:bg-sand transition-all duration-300 text-center"
            >
              Watch Me Play
            </a>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Hook;