/* Persea Desktop shell: shared escapeHtml helper.
 *
 * Escapes the five HTML-special characters for safe interpolation into
 * innerHTML strings. A proper ES module since the vite migration (T6);
 * the escape-html.test.js file imports it the same way. Keep it a pure
 * function with no globals it mutates.
 */

export function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[c]));
}