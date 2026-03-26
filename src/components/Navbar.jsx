import React, { useState } from "react";

const Navbar = () => {
  const [open, setOpen] = useState(false);

  return (
    <div className="fixed top-4 left-0 right-0 z-50 px-4 sm:px-8">
      <nav className="max-w-7xl mx-auto bg-cream border border-sand rounded-2xl shadow-sm px-4 sm:px-6 py-3 flex items-center justify-between">
        {/* Left — Logo + Links */}
        <div className="hidden md:flex items-center gap-8">
          <a
            href="#"
            className="flex items-center gap-2 text-lg font-black text-forest"
          >
            🎵{" "}
            <span>
              Medya <span className="text-sage">Handpan</span>
            </span>
          </a>
          <a
            href="#"
            className="text-forest/60 hover:text-forest text-sm font-medium transition-colors"
          >
            Home
          </a>
          <a
            href="#video"
            className="text-forest/60 hover:text-forest text-sm font-medium transition-colors"
          >
            Lessons
          </a>
          <a
            href="#testimonials"
            className="text-forest/60 hover:text-forest text-sm font-medium transition-colors"
          >
            Students
          </a>
          <a
            href="#about"
            className="text-forest/60 hover:text-forest text-sm font-medium transition-colors"
          >
            About
          </a>
        </div>

        {/* Mobile Logo */}
        <a
          href="#"
          className="md:hidden flex items-center gap-2 text-base font-black text-forest"
        >
          🎵{" "}
          <span>
            Medya <span className="text-sage">Handpan</span>
          </span>
        </a>

        {/* Right — Buttons */}
        <div className="hidden md:flex items-center gap-3">
          <a
            href="#signup"
            className="px-5 py-2 border border-forest/20 text-forest text-sm font-medium rounded-xl hover:bg-sand transition-all duration-200"
          >
            Contact
          </a>
          <a
            href="#signup"
            className="px-5 py-2 bg-orange text-white text-sm font-bold rounded-xl hover:bg-orange/90 transition-all duration-200"
          >
            Book a Session
          </a>
        </div>

        {/* Mobile menu button */}
        <button
          className="md:hidden text-forest p-1"
          onClick={() => setOpen(!open)}
        >
          <svg
            className="w-6 h-6"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            {open ? (
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            ) : (
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 6h16M4 12h16M4 18h16"
              />
            )}
          </svg>
        </button>
      </nav>

      {/* Mobile menu */}
      {open && (
        <div className="md:hidden mt-2 bg-cream border border-sand rounded-2xl shadow-sm px-6 py-4 flex flex-col gap-4">
          <a
            href="#"
            onClick={() => setOpen(false)}
            className="text-forest/60 text-sm font-medium hover:text-forest transition-colors"
          >
            Home
          </a>
          <a
            href="#video"
            onClick={() => setOpen(false)}
            className="text-forest/60 text-sm font-medium hover:text-forest transition-colors"
          >
            Lessons
          </a>
          <a
            href="#testimonials"
            onClick={() => setOpen(false)}
            className="text-forest/60 text-sm font-medium hover:text-forest transition-colors"
          >
            Students
          </a>
          <a
            href="#about"
            onClick={() => setOpen(false)}
            className="text-forest/60 text-sm font-medium hover:text-forest transition-colors"
          >
            About
          </a>
          <div className="flex gap-3 pt-2 border-t border-sand">
            <a
              href="#signup"
              onClick={() => setOpen(false)}
              className="flex-1 text-center px-4 py-2.5 border border-forest/20 text-forest text-sm font-medium rounded-xl hover:bg-sand transition-all"
            >
              Contact
            </a>
            <a
              href="#signup"
              onClick={() => setOpen(false)}
              className="flex-1 text-center px-4 py-2.5 bg-orange text-white text-sm font-bold rounded-xl hover:bg-orange/90 transition-all"
            >
              Book a Session
            </a>
          </div>
        </div>
      )}
    </div>
  );
};

export default Navbar;
