import React, { useState, useEffect } from 'react'

const testimonials = [
  [
    {
      text: "I had zero musical background and within weeks I was playing real melodies. Medya's approach is so clear and encouraging — I never felt lost.",
      name: "Sarah K.",
      country: "Canada",
    },
    {
      text: "Lots of material presented in a clear and concise manner. Great if you are serious about learning the instrument. Huge amounts of progress in just a few weeks.",
      name: "Petar K.",
      country: "Bulgaria",
    },
  ],
  [
    {
      text: "I have to admit, I thought this was far too complex for me. But then I realized what a great teacher Medya is — so friendly, humble, and supportive.",
      name: "Lena M.",
      country: "Germany",
    },
    {
      text: "The course is very well thought out and truly enjoyable. Every step is just challenging enough without being demotivating. The melodies are lovely.",
      name: "Edsko V.",
      country: "Netherlands",
    },
  ],
  [
    {
      text: "Online lessons worked perfectly. Medya gives real personal feedback that makes all the difference. Worth every minute invested.",
      name: "Tom W.",
      country: "Australia",
    },
    {
      text: "I can now play full songs after only 2 months! The structure of the lessons is brilliant and I always look forward to the next one.",
      name: "Anika B.",
      country: "France",
    },
  ],
]

const Testimonials = () => {
  const [page, setPage] = useState(0)
  const [direction, setDirection] = useState(null)
  const [animating, setAnimating] = useState(false)
  const [displayed, setDisplayed] = useState(0)

  const navigate = (dir) => {
    if (animating) return
    setDirection(dir)
    setAnimating(true)
  }

  useEffect(() => {
    if (!animating) return
    const timeout = setTimeout(() => {
      setPage((prev) => {
        const next = direction === 'right'
          ? (prev + 1) % testimonials.length
          : (prev - 1 + testimonials.length) % testimonials.length
        setDisplayed(next)
        return next
      })
      setAnimating(false)
      setDirection(null)
    }, 600)
    return () => clearTimeout(timeout)
  }, [animating, direction])

  const current = testimonials[displayed]

  const slideClass = animating
    ? direction === 'right'
      ? 'opacity-0 translate-x-8'
      : 'opacity-0 -translate-x-8'
    : 'opacity-100 translate-x-0'

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

  return (
    <section className="py-12 md:py-20 px-4 sm:px-8 bg-cream">
      <div className="max-w-7xl mx-auto">

        {/* Heading */}
        <div className="text-center md:text-left mb-8 md:mb-10">
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-black text-forest leading-tight">
            Testimonials from <br className="hidden sm:block" /> our students
          </h2>
          <div className="w-24 h-1 bg-orange mt-3 rounded-full mx-auto md:mx-0" />
        </div>

        {/* Cards */}
        <div className={`grid md:grid-cols-2 gap-4 md:gap-8 transition-all duration-300 ease-in-out ${slideClass}`}>
          <Card {...current[0]} />
          <Card {...current[1]} />
        </div>

        {/* Arrows + Dots */}
        <div className="flex items-center justify-center gap-4 mt-8 md:mt-10">
          <button
            onClick={() => navigate('left')}
            className="w-10 h-10 rounded-full border-2 border-forest/20 flex items-center justify-center text-forest text-xl hover:border-orange hover:text-orange transition-colors"
          >
            ‹
          </button>

          {/* Dots */}
          <div className="flex gap-2">
            {testimonials.map((_, i) => (
              <button
                key={i}
                onClick={() => {
                  if (i > page) navigate('right')
                  else if (i < page) navigate('left')
                }}
                className={`h-2 rounded-full transition-all duration-300 ${i === displayed ? 'bg-orange w-6' : 'bg-forest/20 w-2'}`}
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

      </div>
    </section>
  )
}

export default Testimonials