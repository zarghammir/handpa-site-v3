# PRODUCT.md — Medya Handpan

## What this is
Medya Shadabi teaches handpan (online via video call, and in person around
Vancouver, BC). The site — www.medyhandpan.com — is her whole business
surface: marketing homepage, AI chat assistant ("Nava"), gift lessons via
Stripe, and a logged-in area where students manage their lessons.

## Offer
- First session: free 45-minute intro (booked from the public site / chat,
  cal.com event `45min`; deliberately NOT tracked in the dashboard).
- Ongoing: paid 60-minute lessons at $50 CAD/session, booked from the
  student dashboard (cal.com event `60min-lesson`, instructor-confirmed).

## Users
- **Students** (~30, growing): all levels, many complete beginners, wide age
  range, English/Farsi. They log in occasionally — mostly to check their next
  lesson, re-read notes/files Medya left them, and book the next session.
- **Medya (instructor / owner)**: product-owner level, not technical. Runs
  everything from the instructor dashboard.

## Tech truth (constraints)
- Vite + React 19 + react-router 7 + Tailwind 4, Supabase (auth/DB/storage),
  cal.com embed for booking, Vercel hosting/functions. No SSR.
- Booking truth lives in cal.com; the dashboard mirrors it via webhook.
- Lessons carry a per-booking notes + files thread (SessionNotes) shared
  between student and instructor.

## Brand commitments
- Name: Medya Handpan. Domain: www.medyhandpan.com. Sender:
  hello@medyhandpan.com.
- Incumbent site palette (Tailwind tokens): cream ground, forest ink, sage
  + orange accents, sand borders. Warm, calm, human — matches the
  instrument's wood/steel/meditative world.
- Tone: encouraging, personal, first-person from Medya. Never corporate.

## Non-negotiables
- The cal.com embed does the actual booking; don't replace it.
- Supabase realtime keeps the instructor agenda live.
- 30-min inactivity sign-out on protected routes.
