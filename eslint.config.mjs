/* ESLint flat config for the persea-desktop shell scripts (T6).
 *
 * Since the vite migration the shell pages load their scripts as ES
 * MODULES (bundled by vite), so sourceType is "module" everywhere and
 * the cross-file contract runs through explicit imports (app.js
 * exports invoke/initTheme/appVersion/copyText/capabilityChips;
 * lib/escape-html.js exports escapeHtml). No shared-globals table is
 * needed anymore. Recommended rules only: no formatting rules, no
 * plugins.
 */
import js from "@eslint/js";
import globals from "globals";

export default [
  {
    // All shell JS is browser ES module code now (the bundler resolves
    // the imports; eslint only needs the browser globals).
    files: ["shell/**/*.js"],
    ignores: ["shell/lib/escape-html.test.js"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: {
        ...globals.browser,
      },
    },
    rules: js.configs.recommended.rules,
  },
  {
    // The colocated test runs under Node.
    files: ["shell/lib/**/*.test.js"],
    languageOptions: {
      sourceType: "module",
      globals: {
        ...globals.node,
      },
    },
    rules: js.configs.recommended.rules,
  },
];