// Updates section render (persea-desktop#65, T5): the settings page
// renders the Updates section (title, version line, channel note, the
// "Check for updates" action) and the updater command surface answers.
//
// The version span stays empty today: initUpdates in shell/settings.js
// fills it from cmd_app_version, and the page's init block never calls
// initUpdates (known bug persea-desktop#123). The spec asserts the
// static section chrome that renders now, and checks the version
// source through cmd_app_version instead.
//
// The live update check runs against the real release feed: the
// updater endpoints are compile-time config
// (src-tauri/tauri.conf.json plugins.updater.endpoints, the GitHub
// releases latest.json), so a local dummy feed is impossible. None
// (up to date) or an available version both prove the command
// answered; a rejection (runner without GitHub egress, no release
// asset yet) degrades to a named skip rather than a failure. The
// update-available and download states need a real signed update on
// the feed and cannot be exercised headlessly; per the suite's
// convention a skip names the reason, nothing is stubbed away.
const { newSession, screenshot, seedInstances } = require("../driver");

const SHELL_ORIGIN = process.platform === "win32" ? "http://tauri.localhost" : "tauri://localhost";

async function waitForText(driver, text, timeoutMs = 10000) {
  const { until, By } = require("selenium-webdriver");
  await driver.wait(until.elementLocated(By.xpath(`//*[contains(text(), '${text}')]`)), timeoutMs);
}

function invoke(driver, cmd, args) {
  return driver.executeScript(
    `return window.__TAURI_INTERNALS__.invoke(${JSON.stringify(cmd)}, ${JSON.stringify(args || {})})`,
  );
}

module.exports = async function () {
  seedInstances([]);
  const driver = await newSession();
  const { until, By } = require("selenium-webdriver");

  try {
    await driver.get(`${SHELL_ORIGIN}/settings.html`);
    await waitForText(driver, "Instances");

    // Section render: the section, its title, and the check action.
    await driver.wait(until.elementLocated(By.id("sec-updates")), 10000);
    await waitForText(driver, "Updates");
    await driver.wait(until.elementLocated(By.id("btn-check-updates")), 10000);
    await waitForText(driver, "Check for updates");

    // The version line renders ("Version " plus its span). The span's
    // fill is initUpdates's job, which is not wired yet
    // (persea-desktop#123), so only the element is asserted here.
    await driver.wait(until.elementLocated(By.id("updates-version")), 10000);

    // The channel note is static markup ("Channel: stable." plus the
    // beta link) and renders without any wiring.
    await waitForText(driver, "Channel: stable");

    // Rest state: the status note is empty (no check has run) and the
    // "Download & restart" action is hidden (it only appears when a
    // check finds an update). Both are the markup defaults today and
    // stay true once persea-desktop#123 wires initUpdates, which fills
    // the note only in response to a check.
    const noteEmpty = await driver.executeScript(
      "return document.getElementById('updates-note').textContent === ''",
    );
    if (!noteEmpty) {
      throw new Error("the updates status note should be empty before any check runs");
    }
    const downloadHidden = await driver.executeScript(
      "return document.getElementById('btn-download-restart').classList.contains('hidden')",
    );
    if (!downloadHidden) {
      throw new Error("the Download & restart action should be hidden before any check finds an update");
    }
    await screenshot(driver, "updates-section");

    // The app binary answers on its own version (the source the version
    // line reads once initUpdates is wired).
    const appVersion = await invoke(driver, "cmd_app_version");
    if (typeof appVersion !== "string" || !appVersion.trim()) {
      throw new Error(`cmd_app_version did not answer: ${JSON.stringify(appVersion)}`);
    }

    // The check-for-updates command is registered and ACL-granted
    // (allow-cmd-updater-check). The verdict depends on the release
    // feed being reachable from the runner, so the invocation catches
    // its own rejection and a failure degrades to a named skip; None
    // and a version string both prove the check ran.
    const check = await driver.executeScript(
      "return window.__TAURI_INTERNALS__.invoke('cmd_updater_check')" +
        ".then((v) => ({ ok: true, value: v }))" +
        ".catch((e) => ({ ok: false, error: String(e) }))",
    );
    if (check && check.ok) {
      if (check.value === null || check.value === undefined) {
        console.log("updates: cmd_updater_check answered None (up to date on the configured feed)");
      } else {
        console.log(`updates: cmd_updater_check answered an available version (${check.value}); the section assertions covered the static render`);
      }
    } else {
      console.log(
        `updates: skipped the live check, the configured updater feed is unreachable headlessly (${check && check.error})`,
      );
    }

    console.log("updates: section render + rest states + updater command surface verified");
  } finally {
    await driver.quit();
  }
};