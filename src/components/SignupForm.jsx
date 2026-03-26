import { getCalApi } from "@calcom/embed-react"
import { useEffect } from "react"

const SignupForm = () => {
  useEffect(() => {
    (async function () {
      const cal = await getCalApi({ namespace: "45min" })
      cal("ui", {
        theme: "light",
        cssVarsPerTheme: {
          light: { "cal-brand": "#E67E22" },
          dark: { "cal-brand": "#faf" }
        },
        hideEventTypeDetails: false,
        layout: "month_view",
      })
      cal("inline", {
        elementOrSelector: "#cal-booking",
        calLink: "medya/45min",
        config: {
          layout: "month_view",
          useSlotsViewOnSmallScreen: "true",
          theme: "light",
        }
      })
    })()
  }, [])

  return (
    <section id="signup" className="py-12 md:py-20 px-4 sm:px-8 bg-cream">
      <div className="max-w-7xl mx-auto space-y-6 md:space-y-10">

        {/* Heading */}
        <div className="text-center space-y-3 px-2">
          <div className="flex justify-center">
            <span className="inline-block px-5 py-2.5 bg-forest text-cream text-xs font-bold uppercase tracking-widest rounded-full">
              Get Started
            </span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-black text-forest">
            Claim your <span className="text-sage">free session</span>
          </h2>
          <p className="text-forest/50 text-sm md:text-base max-w-sm mx-auto">
            Book your free 45-minute intro session directly with Medya.
          </p>
        </div>

        {/* Calendar — contained card on both mobile and desktop */}
        <div
          className="rounded-3xl overflow-hidden border border-sand shadow-sm bg-white"
          style={{ height: "520px" }}
        >
          <div
            id="cal-booking"
            className="w-full h-full overflow-y-auto"
          />
        </div>

        <p className="text-center text-forest/30 text-xs">
          No credit card required. No spam. Ever!
        </p>

      </div>
    </section>
  )
}

export default SignupForm