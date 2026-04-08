import React from "react";
import medyaImg from "../../public/images/medya.png";
import LiveStats from "./LiveStats";

const About = () => {
  return (
    <section id="about" className="py-12 md:py-20 px-4 sm:px-8 bg-cream">
      <div className="max-w-7xl mx-auto grid md:grid-cols-2 gap-8 md:gap-16 items-start">
        <div className="space-y-6 md:space-y-8 text-center md:text-left order-2 md:order-1">
          <div className="flex justify-center md:justify-start">
            <span className="inline-block px-5 py-2.5 bg-forest text-cream text-xs font-bold uppercase tracking-widest rounded-full">
              About Your Teacher
            </span>
          </div>

          <h2 className="text-3xl sm:text-4xl md:text-5xl font-black text-forest leading-tight">
            Why I teach <span className="text-sage">handpan</span>
          </h2>

          <p className="text-forest/60 text-base md:text-lg leading-relaxed max-w-md mx-auto md:mx-0">
            I'm Medya — a passionate handpan instructor dedicated to helping you
            find your own musical voice. With years of experience, I guide
            students from their very first note to flowing melodies, online or
            in-person.
          </p>

          <div className="grid grid-cols-2 gap-3 md:gap-4">
            <div className="px-5 md:px-10 py-4 md:py-5 border-2 border-forest/30 text-forest rounded-2xl hover:bg-sand transition-all duration-300">
              <p className="text-2xl md:text-3xl font-black text-forest">10+</p>
              <p className="text-forest/40 text-xs md:text-sm mt-1">Years playing</p>
            </div>

            <div className="px-5 md:px-10 py-4 md:py-5 border-2 border-forest/30 text-forest rounded-2xl hover:bg-sand transition-all duration-300">
              <p className="text-2xl md:text-3xl font-black text-forest">
                {/* <LiveStats type="students" suffix="+" /> */} 28+
              </p>
              <p className="text-forest/40 text-xs md:text-sm mt-1">Students taught</p>
            </div>

            <div className="px-5 md:px-10 py-4 md:py-5 border-2 border-forest/30 text-forest rounded-2xl col-span-2 hover:bg-sand transition-all duration-300">
              <p className="text-base md:text-xl font-black text-forest">
                North Vancouver based
              </p>
              <p className="text-forest/40 text-xs md:text-sm mt-1">
                Available online or in-person (North Van)
              </p>
            </div>
          </div>
        </div>

        <div className="relative order-1 md:order-2">
          <img
            src={medyaImg}
            alt="Medya Shadabi"
            className="w-full h-[280px] sm:h-[400px] md:h-[600px] object-cover rounded-3xl shadow-lg"
          />
          <div className="absolute bottom-4 md:bottom-6 left-1/2 -translate-x-1/2">
            <div className="bg-orange text-white font-bold text-sm md:text-base px-6 md:px-8 py-3 md:py-4 rounded-2xl shadow-lg whitespace-nowrap">
              Medya Shadabi
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default About;