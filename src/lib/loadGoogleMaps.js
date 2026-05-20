// Loads the Google Maps JavaScript API once per page and caches the promise so
// every component that calls `loadGoogleMaps()` shares one loader.
// Returns `null` if VITE_GOOGLE_PLACES_API_KEY is not set, which lets callers
// gracefully fall back to a plain input instead of crashing the page.
//
// Why the bootstrap loader (and not a plain <script> tag): the newer Places
// classes — `AutocompleteSuggestion`, `Place` — are ONLY exposed when the API
// is loaded via `google.maps.importLibrary`. A direct `?libraries=places`
// script tag attaches the legacy `google.maps.places` namespace but omits
// those new classes. The snippet below is Google's official inline bootstrap
// loader; it defines `importLibrary`, which lazily fetches each library and
// resolves only once that library is fully ready.

let cached = null;

export function loadGoogleMaps() {
  const apiKey = import.meta.env.VITE_GOOGLE_PLACES_API_KEY;
  if (!apiKey) return null;

  if (cached) return cached;

  cached = new Promise((resolve) => {
    // Google's official inline bootstrap loader (verbatim logic, de-minified
    // variable names left as-is so it stays diffable against Google's docs).
    ((g) => {
      let h, a, k, p = "The Google Maps JavaScript API", c = "google",
        l = "importLibrary", q = "__ib__", m = document, b = window;
      b = b[c] || (b[c] = {});
      const d = b.maps || (b.maps = {}), r = new Set(),
        e = new URLSearchParams(),
        u = () => h || (h = new Promise(async (f, n) => {
          a = m.createElement("script");
          e.set("libraries", [...r] + "");
          for (k in g) e.set(k.replace(/[A-Z]/g, (t) => "_" + t[0].toLowerCase()), g[k]);
          e.set("callback", c + ".maps." + q);
          a.src = `https://maps.${c}apis.com/maps/api/js?` + e;
          d[q] = f;
          a.onerror = () => (h = n(Error(p + " could not load.")));
          a.nonce = m.querySelector("script[nonce]")?.nonce || "";
          m.head.append(a);
        }));
      d[l]
        ? console.warn(p + " only loads once. Ignoring:", g)
        : (d[l] = (f, ...n) => r.add(f) && u().then(() => d[l](f, ...n)));
    })({ key: apiKey, v: "weekly" });

    // The bootstrap snippet defines `google.maps.importLibrary` synchronously;
    // the actual library fetch happens lazily on first `importLibrary` call.
    resolve(window.google);
  });

  return cached;
}
