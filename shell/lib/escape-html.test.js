/* Unit tests for the shared escapeHtml helper (shell/lib/escape-html.js).
 *
 * Run with `npm test` (node --test, no framework). The helper is a
 * browser classic script, so the CommonJS export guard at the bottom of
 * the file makes it requireable here; the browser path never sees it.
 */

const { test } = require("node:test");
const assert = require("node:assert");
const { escapeHtml } = require("./escape-html.js");

test("passes plain text through unchanged", () => {
  assert.strictEqual(escapeHtml("hello world"), "hello world");
  assert.strictEqual(escapeHtml("persea 1.2 ready"), "persea 1.2 ready");
});

test("escapes each of the five HTML-special characters", () => {
  assert.strictEqual(escapeHtml("&"), "&amp;");
  assert.strictEqual(escapeHtml("<"), "&lt;");
  assert.strictEqual(escapeHtml(">"), "&gt;");
  assert.strictEqual(escapeHtml('"'), "&quot;");
  assert.strictEqual(escapeHtml("'"), "&#39;");
});

test("escapes every special character in a mixed markup string", () => {
  assert.strictEqual(
    escapeHtml(`<a href="/x?a=1&b=2">Tom & Jerry's "page"</a>`),
    "&lt;a href=&quot;/x?a=1&amp;b=2&quot;&gt;Tom &amp; Jerry&#39;s &quot;page&quot;&lt;/a&gt;"
  );
});

test("returns an empty string for an empty string", () => {
  assert.strictEqual(escapeHtml(""), "");
});

test("stringifies undefined and null like every current call site", () => {
  /* The helper has always gone through String() first, so missing
   * values render as bare words (for example the welcome probe prints
   * "Server version undefined" when the probe has no version). Pin the
   * behavior so a stricter helper would be a conscious change. */
  assert.strictEqual(escapeHtml(undefined), "undefined");
  assert.strictEqual(escapeHtml(null), "null");
});

test("coerces non-string values through String()", () => {
  assert.strictEqual(escapeHtml(0), "0");
  assert.strictEqual(escapeHtml(1.5), "1.5");
  assert.strictEqual(escapeHtml(12), "12");
});