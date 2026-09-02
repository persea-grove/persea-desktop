/* Vite multi-page build for the Persea Desktop shell (T6).
 *
 * The shell pages are plain HTML files under shell/; every page is a
 * rollup input so each keeps its own file name in the output. The
 * bundle lands in dist/ (gitignored), which src-tauri/tauri.conf.json
 * embeds via build.frontendDist. Node-only files (the escape-html unit
 * test) are never referenced by a page, so the bundler leaves them out.
 *
 * A new shell page means adding its HTML file AND an entry here.
 */
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

const page = (name) => fileURLToPath(new URL(`shell/${name}.html`, import.meta.url));

export default defineConfig({
  root: "shell",
  base: "./",
  appType: "mpa",
  build: {
    outDir: "../dist",
    emptyOutDir: true,
    rollupOptions: {
      input: {
        index: page("index"),
        login: page("login"),
        pairing: page("pairing"),
        settings: page("settings"),
        tabstrip: page("tabstrip"),
        transfer: page("transfer"),
        dropzone: page("dropzone"),
      },
    },
  },
});