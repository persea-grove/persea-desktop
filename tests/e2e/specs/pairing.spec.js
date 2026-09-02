// Device pairing through the settings page (persea-desktop#65, T5):
// open the pairing page from the settings row's "Pair device" entry
// point, render the pairing dialog states, and take the negative path
// (cancel the in-flight pairing; the page returns to idle).
//
// Flow per src-tauri/src/pairing.rs + shell/pairing.js:
//   - the settings row's "Pair device" button navigates to
//     pairing.html?url=<instance url>
//   - the page gates on the cached probe's `desktop_pairing`
//     capability (defaults ON on the pinned e2e server ref) and hides
//     the "Pair this device" button otherwise
//   - "Pair this device" opens the modal, calls pairing_start, and
//     renders the 8-char code with "Waiting for approval" while the
//     Rust poll loop runs
//   - "Cancel" calls pairing_cancel and closes the dialog; the page is
//     idle again (pairing_status reports `cancelled`, the poll loop
//     stops)
//
// Approval itself needs a signed-in user on the server to confirm the
// code on the account tokens page; that half is out of WebDriver reach
// here (the confirm page interaction is server UI, and pairing_start
// already proved the server accepted the code).
const { newSession, screenshot, seedInstances } = require("../driver");

const BASE = process.env.PERSEA_E2E_BASE_URL;
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
  if (!BASE) {
    console.log("pairing: skipped, PERSEA_E2E_BASE_URL is not set");
    return;
  }
  seedInstances([{ name: "Local", url: BASE, default: true }]);
  const driver = await newSession();
  const { until, By } = require("selenium-webdriver");

  try {
    // The settings page is the entry point named in the ticket.
    await driver.get(`${SHELL_ORIGIN}/settings.html`);
    await waitForText(driver, "Instances");

    // The pairing capability gate reads the cached probe, which runs in
    // the background at startup; wait for it the same way kiosk.spec.js
    // does. Without a successful probe the gate fails closed.
    await driver.wait(
      async () => {
        const list = await invoke(driver, "cmd_instances_list");
        return Array.isArray(list) && list.length > 0 && list[0].probe && list[0].probe.ok === true;
      },
      20000,
      "the instance probe did not complete",
    );

    // Entry point: the instance row's "Pair device" button navigates to
    // the pairing page for that instance (settings.js wires it to
    // pairing.html?url=...).
    const pairDeviceBtn = await driver.wait(
      until.elementLocated(By.xpath("//button[text()='Pair device']")),
      10000,
    );
    await pairDeviceBtn.click();
    await driver.wait(
      until.urlContains("pairing.html"),
      10000,
      "the Pair device button did not open the pairing page",
    );
    await waitForText(driver, "Paired devices");
    await screenshot(driver, "pairing-page");

    // Capability gate: with desktop_pairing advertised (the pinned e2e
    // server defaults it on) the Pair button is visible and the
    // disabled notice stays hidden.
    await driver.wait(until.elementLocated(By.id("btn-pair")), 10000);
    const pairBtnVisible = await driver.executeScript(
      "return !document.getElementById('btn-pair').classList.contains('hidden')",
    );
    const disabledHidden = await driver.executeScript(
      "return document.getElementById('pairing-disabled').classList.contains('hidden')",
    );
    if (!pairBtnVisible || !disabledHidden) {
      throw new Error(
        `pairing capability gate mismatch: pair visible=${pairBtnVisible}, disabled notice hidden=${disabledHidden}`,
      );
    }

    // Start the pairing: the dialog opens, pairing_start returns the
    // code, and the status flips to the waiting text.
    await driver.findElement(By.id("btn-pair")).click();
    await driver.wait(until.elementLocated(By.id("pairing-dialog")), 10000);
    await waitForText(driver, "Waiting for approval", 20000);

    // Pending state: a non-empty 8-character code renders (grouped as
    // 4 + 4), and the action buttons match the waiting state.
    const code = await driver.executeScript(
      "return document.getElementById('pairing-code').textContent",
    );
    const codeChars = code.replace(/\s+/g, "");
    if (codeChars.length !== 8) {
      throw new Error(`expected an 8-character pairing code, got ${JSON.stringify(code)}`);
    }
    const codeShown = await driver.executeScript(
      "return !document.getElementById('pairing-code').classList.contains('hidden')",
    );
    if (!codeShown) {
      throw new Error("the pairing code should be visible while waiting");
    }
    const cancelVisible = await driver.executeScript(
      "return !document.getElementById('pairing-cancel').classList.contains('hidden')" +
        " && document.getElementById('pairing-cancel').textContent === 'Cancel'",
    );
    if (!cancelVisible) {
      throw new Error("the Cancel action should be offered while waiting");
    }

    // The Rust-side session is actually in the waiting state (not just
    // the DOM): pairing_status answers from the pairing session store.
    const status = await invoke(driver, "pairing_status", { instanceUrl: BASE });
    if (!status || status.status !== "waiting" || !status.code) {
      throw new Error(`pairing_status should report waiting, got ${JSON.stringify(status)}`);
    }
    await screenshot(driver, "pairing-waiting");

    // Negative path: cancel the in-flight pairing. The dialog closes
    // and the poll loop stops; the session store reports the terminal
    // cancelled state.
    await driver.findElement(By.id("pairing-cancel")).click();
    await driver.wait(
      async () => {
        const s = await invoke(driver, "pairing_status", { instanceUrl: BASE });
        return s && s.status === "cancelled";
      },
      10000,
      "pairing_cancel did not reach the cancelled state",
    );
    const dialogClosed = await driver.executeScript(
      "return !document.getElementById('pairing-dialog').open",
    );
    if (!dialogClosed) {
      throw new Error("the pairing dialog should close after the cancel");
    }
    await screenshot(driver, "pairing-cancelled");

    // Back to idle: reopening the page (a fresh render, no in-flight
    // pairing UI) shows the idle surface again. A terminal cancelled
    // session is not resumed by the page (resumePairingIfActive only
    // reopens for waiting).
    await driver.get(`${SHELL_ORIGIN}/pairing.html?url=${encodeURIComponent(BASE)}`);
    await waitForText(driver, "Paired devices");
    const dialogOpenAgain = await driver.executeScript(
      "return document.getElementById('pairing-dialog').open",
    );
    if (dialogOpenAgain) {
      throw new Error("a cancelled pairing must not reopen the dialog on a fresh page load");
    }
    await screenshot(driver, "pairing-idle-after-cancel");

    console.log("pairing: settings entry point, pending code state, and cancel path verified");
  } catch (err) {
    try {
      const text = await driver.executeScript(
        "return (document.body && document.body.innerText || '').slice(0, 800)",
      );
      const url = await driver.getCurrentUrl();
      console.error(`pairing diag url: ${url}`);
      console.error(`pairing diag page: ${JSON.stringify(text)}`);
    } catch (diagErr) {
      console.error(`diag failed: ${diagErr.message}`);
    }
    throw err;
  } finally {
    await driver.quit();
  }
};