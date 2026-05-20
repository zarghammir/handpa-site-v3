// Loads the Google Maps JavaScript API once per page and caches the promise so
// every component that calls `loadGoogleMaps()` shares the same script tag.
// Returns `null` if VITE_GOOGLE_PLACES_API_KEY is not set, which lets callers
// gracefully fall back to a plain input instead of crashing the page.
//
// Why a singleton: Google's loader will throw if you include the script twice
// with different configs, so we centralise it here and resolve with the global
// `window.google` namespace once the script is ready.

let cached = null;

export function loadGoogleMaps() {
  const apiKey = import.meta.env.VITE_GOOGLE_PLACES_API_KEY;
  if (!apiKey) return null;

  if (cached) return cached;

  cached = new Promise((resolve, reject) => {
    // Script might already be present from a previous mount (HMR, route change).
    if (window.google?.maps?.importLibrary) {
      resolve(window.google);
      return;
    }

    const script = document.createElement("script");
    // `v=weekly` tracks Google's current channel; `loading=async` tells the
    // loader we won't synchronously call Maps APIs from script-load time so it
    // can defer heavy work without a console warning.
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&v=weekly&loading=async&libraries=places`;
    script.async = true;
    script.onerror = () => {
      // Reset the cache so a subsequent mount can retry (e.g. network blip).
      cached = null;
      reject(new Error("Failed to load Google Maps JS API"));
    };
    script.onload = () => resolve(window.google);
    document.head.appendChild(script);
  });

  return cached;
}
