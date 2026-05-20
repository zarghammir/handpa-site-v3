// Address input with Google Places autocomplete suggestions.
//
// Uses the new `AutocompleteSuggestion.fetchAutocompleteSuggestions` API
// (GA 2024) and renders a custom Tailwind dropdown so the look-and-feel matches
// the rest of the booking/onboarding forms. We deliberately don't use Google's
// drop-in `PlaceAutocompleteElement` web component — it's harder to style to
// match a design system, and we only need the formatted address string here.
//
// Billing note: we attach an `AutocompleteSessionToken` to each request, then
// mint a fresh token after the user picks a suggestion. Google bills the
// keystrokes leading up to a selection as one "session" at a cheaper rate than
// individual per-character queries, so this keeps Places usage cheap.
//
// Falls back to a plain `<input>` when VITE_GOOGLE_PLACES_API_KEY is missing —
// that way local dev without a key still lets the user type an address.

import { useEffect, useRef, useState } from "react";
import { loadGoogleMaps } from "../lib/loadGoogleMaps";

const DEBOUNCE_MS = 250;
const MIN_CHARS = 3;

export default function AddressAutocomplete({
  value,
  onChange,
  placeholder = "Street, city",
  // ISO-3166-1 alpha-2 codes. Restricts suggestions to these countries so the
  // user doesn't see noisy international matches when we know the audience.
  countryCodes,
  className,
}) {
  const [suggestions, setSuggestions] = useState([]);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [ready, setReady] = useState(false);

  // Library handles + session token live in refs so they don't trigger
  // re-renders and survive across renders without effect churn.
  const placesLibRef = useRef(null);
  const sessionTokenRef = useRef(null);
  const debounceRef = useRef(null);
  const wrapperRef = useRef(null);
  // After the user picks a suggestion we set `value` to the chosen address —
  // that would normally retrigger the fetch effect and reopen the dropdown for
  // the freshly-picked address. This flag suppresses that one cycle.
  const skipNextFetchRef = useRef(false);

  // Load the Maps script once and grab the `places` library handle.
  // The loader script includes `libraries=places`, so by the time the script
  // promise resolves the places namespace is already attached at
  // `google.maps.places` — no need for the separate `importLibrary` bootstrap.
  useEffect(() => {
    const loader = loadGoogleMaps();
    if (!loader) return; // no API key → stay in plain-input mode

    let cancelled = false;
    loader
      .then((google) => {
        if (cancelled) return;
        const places = google.maps.places;
        if (!places?.AutocompleteSuggestion) {
          console.warn(
            "Google Places loaded but AutocompleteSuggestion is missing — " +
            "make sure 'Places API (New)' is enabled on the Cloud project."
          );
          return;
        }
        placesLibRef.current = places;
        sessionTokenRef.current = new places.AutocompleteSessionToken();
        setReady(true);
      })
      .catch((err) => console.warn("Google Places unavailable:", err));

    return () => {
      cancelled = true;
    };
  }, []);

  // Debounced fetch on every value change.
  useEffect(() => {
    if (!ready) return;
    if (skipNextFetchRef.current) {
      skipNextFetchRef.current = false;
      return;
    }
    if (!value || value.trim().length < MIN_CHARS) {
      setSuggestions([]);
      setOpen(false);
      return;
    }

    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      try {
        const { AutocompleteSuggestion } = placesLibRef.current;
        const request = {
          input: value,
          sessionToken: sessionTokenRef.current,
        };
        if (countryCodes?.length) {
          request.includedRegionCodes = countryCodes;
        }

        const { suggestions: results } =
          await AutocompleteSuggestion.fetchAutocompleteSuggestions(request);

        const items = (results ?? [])
          .map((s) => s.placePrediction)
          .filter(Boolean)
          .map((p) => ({
            id: p.placeId,
            full: p.text?.toString() ?? "",
            main: p.mainText?.toString() ?? "",
            secondary: p.secondaryText?.toString() ?? "",
          }))
          .filter((it) => it.full);

        setSuggestions(items);
        setOpen(items.length > 0);
        setActiveIndex(-1);
      } catch (err) {
        console.warn("Places autocomplete error:", err);
        setSuggestions([]);
        setOpen(false);
      }
    }, DEBOUNCE_MS);

    return () => clearTimeout(debounceRef.current);
  }, [value, ready, countryCodes]);

  // Close on outside click.
  useEffect(() => {
    function onDocMouseDown(e) {
      if (!wrapperRef.current?.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", onDocMouseDown);
    return () => document.removeEventListener("mousedown", onDocMouseDown);
  }, []);

  const pick = (item) => {
    skipNextFetchRef.current = true;
    onChange(item.full);
    setOpen(false);
    setSuggestions([]);
    setActiveIndex(-1);
    // A session ends when the user picks a place. Mint a fresh token so any
    // subsequent edits are billed as a new session at the bundled rate.
    if (placesLibRef.current) {
      sessionTokenRef.current = new placesLibRef.current.AutocompleteSessionToken();
    }
  };

  const onKeyDown = (e) => {
    if (!open || suggestions.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => (i + 1) % suggestions.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => (i <= 0 ? suggestions.length - 1 : i - 1));
    } else if (e.key === "Enter" && activeIndex >= 0) {
      e.preventDefault();
      pick(suggestions[activeIndex]);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  const inputClass =
    className ||
    "w-full rounded-2xl border border-forest/15 bg-white px-4 py-3 text-forest outline-none focus:border-orange transition-colors";

  return (
    <div ref={wrapperRef} className="relative">
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => suggestions.length > 0 && setOpen(true)}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        // Browser autofill collides with Places suggestions visually. Disable
        // both autocomplete + the iOS/Safari heuristics that ignore "off".
        autoComplete="off"
        autoCorrect="off"
        spellCheck={false}
        className={inputClass}
      />

      {open && suggestions.length > 0 && (
        <ul
          role="listbox"
          className="absolute z-20 left-0 right-0 mt-2 max-h-72 overflow-auto rounded-2xl border border-sand bg-white shadow-lg"
        >
          {suggestions.map((s, idx) => (
            <li
              key={s.id || `${s.full}-${idx}`}
              role="option"
              aria-selected={idx === activeIndex}
              // mousedown (not click) so the handler runs *before* the input
              // loses focus — otherwise blur would close the dropdown first
              // and pick() would never fire.
              onMouseDown={(e) => {
                e.preventDefault();
                pick(s);
              }}
              onMouseEnter={() => setActiveIndex(idx)}
              className={`px-4 py-3 cursor-pointer text-sm border-b border-sand last:border-b-0 ${
                idx === activeIndex ? "bg-cream" : "bg-white hover:bg-cream"
              }`}
            >
              <div className="font-medium text-forest">{s.main || s.full}</div>
              {s.secondary && (
                <div className="text-xs text-forest/50 mt-0.5">{s.secondary}</div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
