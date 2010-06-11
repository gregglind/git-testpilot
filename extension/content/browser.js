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
 *   Jorge Villalobos <jorge@mozilla.com>
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

Cu.import("resource://testpilot/modules/setup.js");

// Namespace object
var TestPilotMenuUtils = {
  updateSubmenu: function() {
    var ntfyMenuFinished =
      document.getElementById("pilot-menu-notify-finished");
    var ntfyMenuNew = document.getElementById("pilot-menu-notify-new");
    var ntfyMenuResults = document.getElementById("pilot-menu-notify-results");
    var alwaysSubmitData =
      document.getElementById("pilot-menu-always-submit-data");
    var Application = Cc["@mozilla.org/fuel/application;1"]
                    .getService(Ci.fuelIApplication);
    ntfyMenuFinished.setAttribute("checked", Application.prefs.getValue(
                                  POPUP_SHOW_ON_FINISH, false));
    ntfyMenuNew.setAttribute("checked", Application.prefs.getValue(
                              POPUP_SHOW_ON_NEW, false));
    ntfyMenuResults.setAttribute("checked", Application.prefs.getValue(
                                  POPUP_SHOW_ON_RESULTS, false));
    alwaysSubmitData.setAttribute("checked", Application.prefs.getValue(
                                   ALWAYS_SUBMIT_DATA, false));
  },

  togglePref: function(id) {
    var prefName = "extensions.testpilot." + id;
    var oldVal = Application.prefs.getValue(prefName, false);
    Application.prefs.setValue( prefName, !oldVal);

    // If you turn on or off the global pref, startup or shutdown test pilot
    // accordingly:
    if (prefName == RUN_AT_ALL_PREF) {
      if (oldVal == true) {
        TestPilotSetup.globalShutdown();
      }
      if (oldVal == false) {
        TestPilotSetup.globalStartup();
      }
    }
  },

  onPopupShowing: function(event) {
    this._setMenuImages();
    this._setMenuLabels();
  },

  onPopupHiding: function(event) {
    var target = event.target;
    if (target.id == "pilot-menu-popup") {
      var menu = document.getElementById("pilot-menu");
      if (target.parentNode != menu) {
        menu.appendChild(target);
      }
    }
  },

  _setMenuImages: function() {
    var happyItem = document.getElementById("feedback-menu-happy-button");

    if (happyItem == null) {
      return;
    }
    if (happyItem.getAttribute("image") == "") {
      var makeImgUrl = function(os, mood) {
        return "chrome://testpilot/skin/Firefox-Feedback-(" + os
          + ")-(" + mood + ")-16x16.png";
      };
      var sadItem = document.getElementById("feedback-menu-sad-button");
      var os = Cc["@mozilla.org/xre/app-info;1"].getService(Ci.nsIXULRuntime).OS;
      if (os.indexOf("Darwin") != -1) {
        happyItem.setAttribute("image", makeImgUrl("Mac", "Smile"));
        sadItem.setAttribute("image", makeImgUrl("Mac", "Frown"));
      } else if (os.indexOf("Win") != -1) {
        happyItem.setAttribute("image", makeImgUrl("Windows", "Smile"));
        sadItem.setAttribute("image", makeImgUrl("Windows", "Frown"));
      } else if (os.indexOf("Linux") != -1) {
        happyItem.setAttribute("image", makeImgUrl("Linux", "Smile"));
        sadItem.setAttribute("image", makeImgUrl("Linux", "Frown"));
      }
    }
  },

  _setMenuLabels: function() {
    // Make the enable/disable User Studies menu item show the right label
    // for the current status...
    var runStudiesToggle = document.getElementById("feedback-menu-enable-studies");
    if (runStudiesToggle) {
      var currSetting = Application.prefs.getValue("extensions.testpilot.runStudies",
                                                   true);
      // TODO those two labels should be pulled from properties
      if (currSetting) {
        runStudiesToggle.setAttribute("label", "Turn Off User Studies");
      } else {
        runStudiesToggle.setAttribute("label", "Turn On User Studies");
      }
    }

    var studiesMenuItem = document.getElementById("feedback-menu-show-studies");
    studiesMenuItem.setAttribute("disabled",
                                 !Application.prefs.getValue(RUN_AT_ALL_PREF, true));
  },

  onMenuButtonMouseDown: function(attachPointId) {
    try {
    if (!attachPointId) {
      attachPointId = "pilot-notifications-button";
    }
    var menuPopup = document.getElementById("pilot-menu-popup");
    var menuButton = document.getElementById(attachPointId);

    if (menuPopup.parentNode != menuButton)
      menuButton.appendChild(menuPopup);

    menuPopup.openPopup(menuButton, "before_start", 0, 0, true);
    } catch(e) {
      dump("Error in onMenuButtonMouseDown: " + e + "\n");
    }
  },

  openFeedbackPage : function (aIsHappy) {
    /* Copied from the MozReporterButtons extension */
    let url =
      Application.prefs.get(
        "extensions.testpilot." + (aIsHappy ? "happyURL" : "sadURL")).value;
    url =
      url.replace(
        "${USER_AGENT}", encodeURIComponent(window.navigator.userAgent));
    url = url.replace("${URL}", encodeURIComponent(gBrowser.contentDocument.location.href));

    window.openUILinkIn(url, "tab");
  }
};


var TestPilotWindowHandlers = {
  onWindowLoad: function() {
    /* "Hold" window load events for TestPilotSetup, passing them along only
     * after startup is complete.  It's hacky, but the benefit is that
     * TestPilotSetup.onWindowLoad can treat all windows the same no matter
     * whether they opened with Firefox on startup or were opened later. */
    if (TestPilotSetup.startupComplete) {
      TestPilotSetup.onWindowLoad(window);
    } else {
      var observerSvc = Cc["@mozilla.org/observer-service;1"]
                           .getService(Ci.nsIObserverService);
      var observer = {
        observe: function(subject, topic, data) {
          observerSvc.removeObserver(this, "testpilot:startup:complete");
          TestPilotSetup.onWindowLoad(window);
        }
      };
      observerSvc.addObserver(observer, "testpilot:startup:complete", false);
    }
  },

  onWindowUnload: function() {
    TestPilotSetup.onWindowUnload(window);
  }
};

window.addEventListener("load", TestPilotWindowHandlers.onWindowLoad, false);
window.addEventListener("unload", TestPilotWindowHandlers.onWindowUnload, false);
