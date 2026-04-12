// api/_lib/buildSystemPrompt.js
//
// What this teaches:
//   → Configuration-driven behavior: separating "what the AI should do"
//     from the code that executes it — a fundamental backend pattern.
//   → In C#, this becomes appsettings.json + IConfiguration injection.
//   → This function is the single place that converts structured config
//     into the flat string Claude's API expects as a system prompt.
//
// Why not just pass the JSON directly to Claude?
//   Claude expects a plain string system prompt, not JSON. This function
//   is the "adapter" layer between your config format and the API format.

import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

// ── Load config once at module initialisation (not on every request) ──────────
// readFileSync is fine here because this runs once when the serverless function
// cold-starts. Hot path (per-request) code should never do synchronous I/O.
const __dirname = dirname(fileURLToPath(import.meta.url));
const configPath = join(__dirname, "../../prompt-config.json");
const config = JSON.parse(readFileSync(configPath, "utf8"));

// ── Build the flat string Claude needs ────────────────────────────────────────
export function buildSystemPrompt() {
  const { persona, knowledgeBase, timezoneMap, bookingFlow, hardRules } = config;

  // ── Timezone lookup table ──────────────────────────────────────────────────
  const tzLines = Object.entries(timezoneMap)
    .filter(([city]) => city !== "default")
    .map(([city, tz]) => `   - ${city} → ${tz}`)
    .join("\n");

  // ── Booking marker descriptions ────────────────────────────────────────────
  const { saveLead, createBooking, checkAvailability } = bookingFlow.markers;

  // ── Assemble prompt ────────────────────────────────────────────────────────
  return `You are ${persona.instructorName}'s ${persona.role}. Your name is ${persona.assistantName} (نوا — Persian for "melody" and "musical sound", the soul of what a handpan sings).

Your tone is ${persona.tone}. Keep all replies to ${persona.maxSentencesPerReply} sentences maximum.

You can answer questions about:
- What a handpan is and how it sounds
- Lesson format: ${knowledgeBase.location.online ? "online or " : ""}in-person in ${knowledgeBase.location.inPerson}
- Complete beginners are very welcome — ${knowledgeBase.requiresPriorExperience ? "some experience helpful" : "no experience needed"}
- Students do ${knowledgeBase.requiresOwnInstrument ? "" : "not "}need to own a handpan
- Free ${knowledgeBase.introSession.durationMinutes}-minute intro session to start
- Ongoing lessons are $${knowledgeBase.ongoingLessons.priceCAD}/${knowledgeBase.ongoingLessons.unit}
- ${persona.instructorName} teaches in ${knowledgeBase.languages.join(" and ")}

BOOKING FLOW — follow these steps exactly when someone wants to book:
${bookingFlow.steps.map((s, i) => `${i + 1}. ${s}`).join("\n")}
${bookingFlow.steps.length + 1}. If they give a city name, convert it to an IANA timezone:
${tzLines}
   - If unsure, default to ${timezoneMap.default}
${bookingFlow.steps.length + 2}. Once you have name, email AND timezone, output exactly this and nothing else:
   ${saveLead.format}
   ${saveLead.note}
${bookingFlow.steps.length + 3}. When the system returns available slots, present ONLY the display times to the user (not the raw ISO strings in brackets — those are for your internal use only). Ask which slot they prefer.
${bookingFlow.steps.length + 4}. When the user confirms a specific slot, find the matching ISO time in brackets from the availability list, then output:
   ${createBooking.format}
   ${createBooking.note}
   If you cannot find the exact ISO string, output:
   ${checkAvailability.format}

Important rules for markers:
${bookingFlow.markerRules.map((r) => `- ${r}`).join("\n")}

General rules:
${hardRules.map((r) => `- ${r}`).join("\n")}
- ${persona.scopeRestriction}`;
}

// ── Export the welcome message so ChatWidget can use it too ───────────────────
export function getWelcomeMessage() {
  return config.persona.welcomeMessage;
}

// ── Export the assistant name for use in UI components ────────────────────────
export function getAssistantName() {
  return config.persona.assistantName;
}