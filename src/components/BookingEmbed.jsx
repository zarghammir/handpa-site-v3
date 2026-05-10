// src/components/BookingEmbed.jsx
//
// Inline cal.com booking widget using the official React package.
//
// PROPS
//   calLink   — cal.com path without the domain, e.g. "medya/60min-lesson"
//   namespace — cal.com embed namespace; lets multiple embeds coexist on one
//               page without trampling each other's state
//   name      — pre-fills the booker form's name field
//   email     — pre-fills the email field
//   height    — explicit height in CSS units (default 720px)
//
// HOW THE PACKAGE WORKS
//   getCalApi({ namespace }) returns a small RPC handle pointing at the
//   embedded iframe for the given namespace. Calling cal("ui", {...}) sends a
//   message to that iframe to apply UI options (theme, layout, brand color).
//   <Cal namespace="..." calLink="..." config={{...}} /> mounts the iframe.

import Cal, { getCalApi } from "@calcom/embed-react";
import { useEffect } from "react";

export default function BookingEmbed({
  calLink,
  namespace = "60min-lesson",
  name,
  email,
  height = 720,
}) {
  useEffect(() => {
    (async function () {
      const cal = await getCalApi({ namespace });
      cal("ui", {
        hideEventTypeDetails: false,
        layout: "month_view",
        // Force light mode regardless of the device's color-scheme preference.
        // Cal.com defaults to following `prefers-color-scheme`, which made the
        // embed render dark on dark-mode devices — we always want light here
        // to match the rest of the site (cream + forest palette).
        theme: "light",
        // Match our forest brand color — propagates to buttons and accents
        // inside the cal.com iframe.
        cssVarsPerTheme: {
          light: { "cal-brand": "#0a3a2a" },
        },
      });
    })();
  }, [namespace]);

  if (!calLink) return null;

  // The config object is also where prefill values live — cal.com reads `name`
  // and `email` here and pre-populates the booker form so the student doesn't
  // retype info we already know.
  // theme: "light" here belt-and-braces in case the cal("ui") call hasn't run
  // yet when the iframe first mounts.
  const config = {
    layout: "month_view",
    useSlotsViewOnSmallScreen: "true",
    theme: "light",
  };
  if (name) config.name = name;
  if (email) config.email = email;

  return (
    <div className="bg-white rounded-3xl border border-sand overflow-hidden shadow-sm">
      <Cal
        namespace={namespace}
        calLink={calLink}
        style={{ width: "100%", height: `${height}px`, overflow: "scroll" }}
        config={config}
      />
    </div>
  );
}
