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
    <section id="signup" className="py-20 px-8 bg-cream">
      <div className="max-w-7xl mx-auto space-y-10">

        <div className="text-center space-y-3">
          <span className="inline-block px-4 py-2 bg-sage/20 text-forest text-sm font-semibold uppercase tracking-wide rounded-full border border-sage/40">
            Get Started
          </span>
          <h2 className="text-4xl font-black text-forest">
            Claim your <span className="text-sage">free session</span>
          </h2>
          <p className="text-forest/50 text-base">
            Book your free 45-minute intro session directly with Medya.
          </p>
        </div>

        <div
          id="cal-booking"
          className="rounded-3xl overflow-hidden w-full"
          style={{ minHeight: "500px" }}
        />

        <p className="text-center text-forest/30 text-xs">
          No credit card required. No spam. Ever! 
        </p>

      </div>
    </section>
  )
}

export default SignupForm