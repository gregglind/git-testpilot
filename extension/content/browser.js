/* ***** BEGIN LICENSE BLOCK *****
 * Version: MPL 1.1/GPL 2.0/LGPL 2.1
 *
 * The contents of this file are subject to the Mozilla Public License Version
 * 1.1 (the "License"); you may not use this file except in compliance with
 * the License. You may obtain a copy of the License at
 * http://www.mozilla.org/MPL/
 *
 * Software distributed under the License is distributed on an "AS IS" basis,
 * WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License
 * for the specific language governing rights and limitations under the
 * License.
 *
 * The Original Code is Test Pilot.
 *
 * The Initial Developer of the Original Code is Mozilla.
 * Portions created by the Initial Developer are Copyright (C) 2007
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *   Atul Varma <atul@mozilla.com>
 *   Jono X <jono@mozilla.com>
 *
 * Alternatively, the contents of this file may be used under the terms of
 * either the GNU General Public License Version 2 or later (the "GPL"), or
 * the GNU Lesser General Public License Version 2.1 or later (the "LGPL"),
 * in which case the provisions of the GPL or the LGPL are applicable instead
 * of those above. If you wish to allow use of your version of this file only
 * under the terms of either the GPL or the LGPL, and not to allow others to
 * use your version of this file under the terms of the MPL, indicate your
 * decision by deleting the provisions above and replace them with the notice
 * and other provisions required by the GPL or the LGPL. If you do not delete
 * the provisions above, a recipient may use your version of this file under
 * the terms of any one of the MPL, the GPL or the LGPL.
 *
 * ***** END LICENSE BLOCK ***** */

var TestPilotMenuUtils;

(function() {
  var Cc = Components.classes;
  var Cu = Components.utils;
  var Ci = Components.interfaces;

  //Cu.import("resource://testpilot/modules/setup.js");

  TestPilotMenuUtils = {
    __prefs: null,
    get _prefs() {
      this.__prefs = Cc["@mozilla.org/preferences-service;1"]
        .getService(Ci.nsIPrefBranch);
      return this.__prefs;
    },

    updateSubmenu: function() {
      let ntfyMenuFinished =
        document.getElementById("pilot-menu-notify-finished");
      let ntfyMenuNew = document.getElementById("pilot-menu-notify-new");
      let ntfyMenuResults = document.getElementById("pilot-menu-notify-results");
      let alwaysSubmitData =
        document.getElementById("pilot-menu-always-submit-data");
      ntfyMenuFinished.setAttribute("checked",
                                    this._prefs.getCharPref(POPUP_SHOW_ON_FINISH));
      ntfyMenuNew.setAttribute("checked",
                                 this._prefs.getCharPref(POPUP_SHOW_ON_NEW));
      ntfyMenuResults.setAttribute("checked",
                                   this._prefs.getCharPref(POPUP_SHOW_ON_RESULTS));
      alwaysSubmitData.setAttribute("checked",
                                    this._prefs.getCharPref(ALWAYS_SUBMIT_DATA));
    },

    togglePref: function(id) {
      let prefName = "extensions.testpilot." + id;
      let oldVal = false;
      if (this._prefs.prefHasUserValue(prefName)) {
        oldVal = this._prefs.getBoolPref(prefName);
      }
      this._prefs.setBoolPref(prefName, !oldVal);
    },

    onPopupShowing: function(event) {
      this._setMenuLabels();
    },

    onPopupHiding: function(event) {
      let target = event.target;
      if (target.id == "pilot-menu-popup") {
        let menu = document.getElementById("pilot-menu");
        if (target.parentNode != menu) {
          menu.appendChild(target);
        }
      }
    },

    _setMenuLabels: function() {
    },

    onMenuButtonMouseDown: function(attachPointId) {
      if (!attachPointId) {
        attachPointId = "pilot-notifications-button";
      }
      let menuPopup = document.getElementById("pilot-menu-popup");
      let menuButton = document.getElementById(attachPointId);

      // TODO failing here with "menuPopup is null" for Tracy
      if (menuPopup.parentNode != menuButton)
        menuButton.appendChild(menuPopup);

      let alignment;
      // Menu should appear above status bar icon, but below Feedback button
      if (attachPointId == "pilot-notifications-button") {
        alignment = "before_start";
      } else {
        alignment = "after_end";
      }

      menuPopup.openPopup(menuButton, alignment, 0, 0, true);
    }
  };


  var TestPilotWindowHandlers = {
    initialized: false,
    onWindowLoad: function() {
      try {

      /* "Hold" window load events for TestPilotSetup, passing them along only
       * after startup is complete.  It's hacky, but the benefit is that
       * TestPilotSetup.onWindowLoad can treat all windows the same no matter
       * whether they opened with Firefox on startup or were opened later. */

      if (("TestPilotSetup" in window) && TestPilotSetup.startupComplete) {
        Services.console.logStringMessage("Startup complete, that's funny.\n");
        TestPilotSetup.onWindowLoad(window);
      } else {
        Services.console.logStringMessage("Initializing timer.\n");
        // TODO only want to start this timer ONCE so we need some global state to
        // remember whether we already started it (only a problem on multi-window systems)
        // (that's essentially the problem the component solved) deal with this later.
        window.setTimeout(function() {
           Services.console.logStringMessage("Timer got called back!.\n");
             Services.console.logStringMessage("Impoting setup");
             Cu.import("resource://testpilot/modules/setup.js");
             Services.console.logStringMessage("globally globalStartuping");
             TestPilotSetup.globalStartup();
             Services.console.logStringMessage("Did it.");
        }, 10000);
        Services.console.logStringMessage("Timer made.\n");

        let observerSvc = Cc["@mozilla.org/observer-service;1"]
                             .getService(Ci.nsIObserverService);
        let observer = {
          observe: function(subject, topic, data) {
            observerSvc.removeObserver(this, "testpilot:startup:complete");
            TestPilotSetup.onWindowLoad(window);
          }
        };
        Services.console.logStringMessage("Registering observer for startup completion.\n");
        observerSvc.addObserver(observer, "testpilot:startup:complete", false);
      }

      } catch (e) {
        Services.console.logStringMessage(e.toString());
      }
    },

    onWindowUnload: function() {
      TestPilotSetup.onWindowUnload(window);
    }
  };

  window.addEventListener("load", TestPilotWindowHandlers.onWindowLoad, false);
  window.addEventListener("unload", TestPilotWindowHandlers.onWindowUnload, false);
}());

