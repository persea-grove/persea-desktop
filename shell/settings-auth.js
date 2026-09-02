/* Persea Desktop settings page: auth offers and renew banners (D1/D2).
 *
 * Extracted from an inline <script> in settings.html during the vite
 * migration (T6); it runs as a module after settings.js renders the
 * instance rows.
 *
 * Auth failed: when a reachable server rejects the stored credential
 * with an auth error (compliance-mode behavior, probe authFailed),
 * offer "Log in instead" on that server's row. Pairing stays the
 * default flow; this offer only appears on auth-failed probes.
 *
 * Sign-in expiring: the shell watches each stored scoped token and
 * pushes "token-state" events ("ok", "expiring", "expired",
 * "invalidated"). Expiring, expired and invalidated rows get a
 * "Renew sign-in" banner linking to login.html; renewal is always
 * interactive because the app never stores the password.
 *
 * A mutation watcher re-applies both offers whenever the list
 * re-renders.
 */
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";

function initAuthOffers() {
  const list = document.getElementById("instance-list");
  if (!list) return;

  const OFFER_CLASS = "login-offer";
  const RENEW_CLASS = "renew-offer";

  /* Banner text per renewable token state; any other state clears. */
  const RENEW_MESSAGES = {
    expiring:
      "The desktop sign-in for this server expires soon. Renew it to stay signed in.",
    expired:
      "The desktop sign-in for this server has expired. Sign in again to renew it.",
    invalidated:
      "This server rejected the desktop sign-in. Sign in again to renew it.",
  };

  /* Latest known token state per instance URL; kept outside the DOM
   * so banners re-attach after settings.js re-renders the list. */
  const renewStates = {};

  function offerHtml(url) {
    return (
      '<div class="setup-banner ' + OFFER_CLASS + '">' +
      "<span>This server rejected the stored sign-in. Sign in with " +
      "your account to get a fresh scoped token.</span>" +
      '<a class="btn btn-accent" href="login.html?url=' +
      encodeURIComponent(url) +
      '">Log in instead</a></div>'
    );
  }

  function renewHtml(state, url) {
    return (
      '<div class="setup-banner ' + RENEW_CLASS + '">' +
      "<span>" + RENEW_MESSAGES[state] + "</span>" +
      '<a class="btn btn-accent" href="login.html?url=' +
      encodeURIComponent(url) +
      '">Renew sign-in</a></div>'
    );
  }

  function applyRenewBanners() {
    list.querySelectorAll(".instance-row").forEach((row) => {
      const url = row.getAttribute("data-url");
      const main = row.querySelector(".instance-main");
      if (!main) return;
      const existing = main.querySelector("." + RENEW_CLASS);
      const message = RENEW_MESSAGES[renewStates[url]];
      if (message) {
        if (!existing) {
          main.insertAdjacentHTML("beforeend", renewHtml(renewStates[url], url));
        }
      } else if (existing) {
        existing.remove();
      }
    });
  }

  async function applyOffers() {
    let instances = [];
    try {
      instances = await invoke("cmd_instances_list");
    } catch {
      return;
    }
    const failed = new Set(
      instances
        .filter((i) => i.probe && i.probe.ok && i.probe.authFailed)
        .map((i) => i.url)
    );
    list.querySelectorAll(".instance-row").forEach((row) => {
      const url = row.getAttribute("data-url");
      const main = row.querySelector(".instance-main");
      if (!main) return;
      const existing = main.querySelector("." + OFFER_CLASS);
      if (failed.has(url)) {
        if (!existing) main.insertAdjacentHTML("beforeend", offerHtml(url));
      } else if (existing) {
        existing.remove();
      }
    });
    applyRenewBanners();
  }

  /* Live token-state pushes from the shell (poller watcher and the
   * bridge's 401 invalidation routing). Outside Tauri the import
   * rejects and the banner stays off. */
  listen("token-state", (event) => {
    const p = event && event.payload !== undefined ? event.payload : event;
    if (!p || typeof p.instanceUrl !== "string") return;
    renewStates[p.instanceUrl] = p.state;
    applyRenewBanners();
  }).catch(() => {});

  let timer = null;
  function schedule() {
    clearTimeout(timer);
    timer = setTimeout(applyOffers, 50);
  }

  new MutationObserver(schedule).observe(list, { childList: true });
  schedule();
}

initAuthOffers();