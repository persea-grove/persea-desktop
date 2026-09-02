/* ESLint flat config for the persea-desktop shell scripts (T3).
 *
 * The shell pages load their scripts as CLASSIC scripts in webviews
 * (no bundler yet), so sourceType is "script" and the cross-file
 * contract between app.js / lib/escape-html.js and the consumer pages
 * is declared as readonly globals (see the file headers: "Runs after
 * app.js"). Recommended rules only: no formatting rules, no plugins.
 *
 * app.js and the self-contained tabstrip/transfer pages define their
 * own helpers, so they get no function globals (declaring the ones
 * they define would trip no-redeclare).
 */
import js from "@eslint/js";
import globals from "globals";

/* Functions app.js and lib/escape-html.js expose to the pages that
 * load them afterwards (classic-script contract, not ES imports). */
const shellSharedGlobals = {
  invoke: "readonly",
  escapeHtml: "readonly",
  copyText: "readonly",
  appVersion: "readonly",
  capabilityChips: "readonly",
};

export default [
  {
    // app.js defines invoke/appVersion/copyText/... itself and only
    // consumes escapeHtml from lib/escape-html.js.
    files: ["shell/app.js"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "script",
      globals: {
        ...globals.browser,
        escapeHtml: "readonly",
      },
    },
    rules: js.configs.recommended.rules,
  },
  {
    // Consumer pages: settings.js, login.js, pairing.js call the
    // helpers app.js defines at top level.
    files: ["shell/settings.js", "shell/login.js", "shell/pairing.js"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "script",
      globals: {
        ...globals.browser,
        ...shellSharedGlobals,
      },
    },
    rules: js.configs.recommended.rules,
  },
  {
    // Self-contained classic scripts: their helpers live inside the
    // IIFE, nothing crosses files.
    files: ["shell/tabstrip.js", "shell/transfer.js"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "script",
      globals: {
        ...globals.browser,
      },
    },
    rules: js.configs.recommended.rules,
  },
  {
    // The shared helper doubles as a CommonJS module for node --test
    // (see the export guard at the bottom of escape-html.js), and the
    // colocated test runs under Node.
    files: ["shell/lib/**/*.js"],
    languageOptions: {
      sourceType: "commonjs",
      globals: {
        ...globals.node,
      },
    },
  },
];