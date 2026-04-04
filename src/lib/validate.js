// ─── What is client-side form validation? ────────────────────────────────────
//
// Validation means checking that user input meets your requirements before
// sending it to the server. There are two layers:
//
//   Client-side (this file)
//     Runs in the browser, instant feedback, no network round-trip.
//     Purpose: good user experience — show errors as the user types.
//     NOT a security measure — users can bypass JS entirely.
//
//   Server-side (api/*.js)
//     Runs on the server, cannot be bypassed.
//     Purpose: actual enforcement — reject bad data even if JS is disabled
//     or someone calls your API directly with curl.
//
// Rule: always validate on both sides. Client-side for UX, server-side for safety.
//
// ── How to use these validators ──────────────────────────────────────────────
//
//   // On blur (when the user leaves a field):
//   const error = runValidators(email, [validateRequired, validateEmail])
//   if (error) setEmailError(error)
//
//   // On submit (check all fields before sending):
//   const nameError = validateRequired(name)
//   if (nameError) { setError(nameError); return; }
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns an error string if the value is empty, null if it's valid.
 * Convention: validators return null on success, a string on failure.
 */
export function validateRequired(value) {
  return String(value ?? "").trim() ? null : "This field is required.";
}

/**
 * Validates email format using a standard regex.
 * Note: this catches obvious mistakes (no @, no domain) but isn't exhaustive.
 * The server should also check format, and only a real send attempt confirms deliverability.
 */
export function validateEmail(value) {
  if (!value) return "Email is required.";
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
    ? null
    : "Please enter a valid email address.";
}

/**
 * Returns an error if the value has fewer than `min` characters.
 */
export function validateMinLength(value, min) {
  return String(value ?? "").trim().length >= min
    ? null
    : `Must be at least ${min} characters.`;
}

/**
 * Returns an error if the value exceeds `max` characters.
 */
export function validateMaxLength(value, max) {
  return String(value ?? "").length <= max
    ? null
    : `Must be under ${max} characters.`;
}

/**
 * Runs an ordered list of validators and returns the first error found.
 * Short-circuits on the first failure — validators run in order.
 *
 * Example:
 *   runValidators(email, [validateRequired, validateEmail])
 *   // → null if valid, or "This field is required." / "Please enter a valid email."
 */
export function runValidators(value, validators) {
  for (const validator of validators) {
    const error = validator(value);
    if (error) return error; // stop at first failure
  }
  return null; // all validators passed
}
