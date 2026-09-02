/* Persea Desktop shell: shared escapeHtml helper.
 *
 * Escapes the five HTML-special characters for safe interpolation into
 * innerHTML strings. The shell pages have no bundler yet, so this file
 * is loaded as a CLASSIC script before app.js on every page whose
 * scripts call it (index, login, pairing, settings) and defines the
 * single shared symbol `escapeHtml`. The bundler ticket converts it to
 * an ES module export; keep it a pure function with no globals it
 * mutates.
 */

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[c]));
}

/* CommonJS export for node --test (shell/lib/escape-html.test.js).
 * Browsers never define `module` in a classic script, so this is a
 * no-op in the app. The bundler ticket replaces it with `export`. */
if (typeof module !== "undefined") {
  module.exports = { escapeHtml };
}