/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const APP_STARTUP = 1; //The application is starting up.
const APP_SHUTDOWN = 2; //The application is shutting down.
const ADDON_ENABLE = 3;	//The add-on is being enabled.
const ADDON_DISABLE = 4; //The add-on is being disabled.
const ADDON_INSTALL = 5; //The add-on is being installed.
const ADDON_UNINSTALL = 6; //The add-on is being uninstalled.
const ADDON_UPGRADE = 7; //The add-on is being upgraded.
const ADDON_DOWNGRADE = 8; //The add-on is being downgraded.


function startup(data, reason) {
   // called when the extension needs to start itself up -
   // data tells us extension id, version, and installPath.
   // reason is one of APP_STARTUP, ADDON_ENABLE, ADDON_INSTALL,
   // ADDON_UPGRADE, or ADDON_DOWNGRADE.

  /* TODO this will need to register a listener for new window opens,
   * so tht it can apply the TestPilotWindowHandlers.onWindowLoad()
   * currently defined in browser.js.  (Without an overlay, we have no
   * other way of ensuring that the window load handler gets called for
   * each window.)
   *
   * This will also need to manually insert CSS styles (which are otherwise
   * included by the overlay.)   Look at the document.loadOverlay function.
   * https://developer.mozilla.org/En/DOM/Document.loadOverlay
   */
}

function shutdown(data, reason) {
   // reason is one of APP_SHUTDOWN, ADDON_DISABLE, ADDON_UNINSTALL, ADDON_UPGRADE, or ADDON_DOWNGRADE.
}

function install(data, reason) {
  // Optional.  Called before first call to startup() when
  // extension first installed.
}

function uninstall(data, reason) {
  // Optional.  Called after last call to shutdown() when uninstalled.
}
