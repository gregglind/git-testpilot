/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/* Choose correct overlay to apply based on user's update channel setting;
 * do any other tweaking to UI needed to work correctly with user's version.
 * 1. Fx 3.*, default update channel -> TP icon menu in status bar
 * 2. beta update channel -> Feedback button in toolbar, customizable
 * 3. Fx 4.*, default update channel -> TP icon menu in add-on bar
 */

// A lot of the stuff that's currently in browser.js can get moved here.

/* Note on prefs:
 * beacuse we want to use "Default Branch", we use the raw service
 * rather than the jetpack wrapped versions.
 *
 */

EXPORTED_SYMBOLS = ["TestPilotUIBuilder"];

const { id, data } = require("self");
const appname = require("xul-app").name;
let { emit } = require('sdk/event/core');
let tabs = require('tabs');

//let {switchtab,banner,doorhanger,nbButtons:B,anchorit} = require("moz-ui");

const ADDON_BRANCH = "extensions." + id + ".";

const {Cc,Ci,Cu} = require("chrome");
const UPDATE_CHANNEL_PREF = "app.update.channel";
const POPUP_SHOW_ON_NEW = ADDON_BRANCH + "popup.showOnNewStudy";
const POPUP_CHECK_INTERVAL = ADDON_BRANCH + "popup.delayAfterStartup";

var TestPilotUIBuilder = {
  get _prefs() {
    delete this._prefs;
    return this._prefs = Cc["@mozilla.org/preferences-service;1"]
      .getService(Ci.nsIPrefBranch);
  },

  get _prefDefaultBranch() {
    delete this._prefDefaultBranch;
    return this._prefDefaultBranch = Cc["@mozilla.org/preferences-service;1"]
      .getService(Ci.nsIPrefService).getDefaultBranch("");
  },

  get _comparator() {
    delete this._comparator;
    return this._comparator = Cc["@mozilla.org/xpcom/version-comparator;1"]
      .getService(Ci.nsIVersionComparator);
  },

  get _appVersion() {
    delete this._appVersion;
    return this._appVersion = Cc["@mozilla.org/xre/app-info;1"]
      .getService(Ci.nsIXULAppInfo).version;
  },

  buildTestPilotInterface: function(window) {
    // Don't need Feedback button: remove it
    let feedbackButton = window.document.getElementById("feedback-menu-button");
    if (!feedbackButton) {
      let toolbox = window.document.getElementById("navigator-toolbox");
      let palette = toolbox.palette;
      feedbackButton = palette.getElementsByAttribute("id", "feedback-menu-button").item(0);
    }
    feedbackButton.parentNode.removeChild(feedbackButton);

    /* Default prefs for test pilot version - default to NOT notifying user about new
     * studies starting. Note we're setting default values, not current values -- we
     * want these to be overridden by any user set values!!*/
    this._prefDefaultBranch.setBoolPref(POPUP_SHOW_ON_NEW, false);
    this._prefDefaultBranch.setIntPref(POPUP_CHECK_INTERVAL, 180000);
  },

  buildFeedbackInterface: function(window) {
    /* If this is first run, and it's ffx4 beta version, and the feedback
     * button is not in the expected place, put it there!
     * (copied from MozReporterButtons extension) */

    /* Check if we've already done this customization -- if not, don't do it
     * again  (don't want to put it back in after user explicitly takes it out-
     * bug 577243 )*/
    let firefoxnav = window.document.getElementById("nav-bar");
    let pref = ADDON_BRANCH + "alreadyCustomizedToolbar";
    let alreadyCustomized = this._prefs.getBoolPref(pref);
    let curSet = firefoxnav.currentSet;

    if (!alreadyCustomized && (-1 == curSet.indexOf("feedback-menu-button"))) {
      // place the buttons after the search box.
      let newSet = curSet + ",feedback-menu-button";
      firefoxnav.setAttribute("currentset", newSet);
      firefoxnav.currentSet = newSet;
      window.document.persist("nav-bar", "currentset");
      this._prefs.setBoolPref(pref, true);
      // if you don't do the following call, funny things happen.
      try {
        window.BrowserToolboxCustomizeDone(true);
      } catch (e) {
      }
    }

    /* Pref defaults for Feedback version: default to notifying user about new
     * studies starting. Note we're setting default values, not current values -- we
     * want these to be overridden by any user set values!!*/
    this._prefDefaultBranch.setBoolPref(POPUP_SHOW_ON_NEW, true);
    this._prefDefaultBranch.setIntPref(POPUP_CHECK_INTERVAL, 600000);
  },

  channelUsesFeedback: function() {
    // Beta and aurora channels use feedback interface; nightly and release channels don't.
    let channel = this._prefDefaultBranch.getCharPref(UPDATE_CHANNEL_PREF);
    return (channel == "beta") || (channel == "betatest") || (channel == "aurora");
  },

  appVersionIsFinal: function() {
    // Return true iff app version >= 4.0 AND there is no "beta" or "rc" in version string.
    if (this._comparator.compare(this._appVersion, "4.0") >= 0) {
      if (this._appVersion.indexOf("b") == -1 && this._appVersion.indexOf("rc") == -1) {
        return true;
      }
    }
    return false;
  },

  buildCorrectInterface: function(window) {
    let firefoxnav = window.document.getElementById("nav-bar");
    /* This is sometimes called for windows that don't have a navbar - in
     * that case, do nothing. TODO maybe this should be in onWindowLoad?*/
    if (!firefoxnav) {
      return;
    }

    /* Overlay Feedback XUL if we're in the beta update channel, Test Pilot XUL otherwise, and
     * call buildFeedbackInterface() or buildTestPilotInterface(). */
    if (this.channelUsesFeedback()) {
      window.document.loadOverlay("chrome://"+id+"/content/feedback-browser.xul", null);
      this.buildFeedbackInterface(window);
    } else {
      window.document.loadOverlay("chrome://"+id+"/content/tp-browser.xul", null);
      this.buildTestPilotInterface(window);
    }
  }
};



// UTILS... here for now...
const windowUtils = require("window-utils");
const window = windowUtils.activeBrowserWindow;

let anchorit = exports.anchorit = function(elements){
    if (! elements) {
        elements = ['home-button'];  // Where else should it try to anchorit?
    }
    for (let ii in elements) {
        let guess = elements[ii];
        let el = null;
        console.log("guessing:", guess);
        if (typeof(guess) == "string") {
            el = window.document.getElementById(guess);
        } else {  // TODO, this should typecheck against elements, then throw?
            el = guess;
        }
        if (el) {
            console.log("got element!");
            return el;
        };
    };
    return null;  // I got nothin'
};


/** Open or reopen a tab, based on url.
 * options will only be used in the case of a new tab.  if the tab exists,
 *  it will just activate it
 */
exports.switchtab = function(options) {
    var url = options.url || options;  // tabs.open takes both
    if (! options) options = {};
    for (let ii in tabs) {
        let tab = tabs[ii];
        if (tab.url == url) {
            tab.activate();
            return tab;
        }
    }
    return tabs.open(options);
};

// updates, questions, and notices
// TODO li0n!


// TODO: should this take args about the task itself?
let tpdialogue = function(event_target){
  let mypanel = require("tppanel").Panel({
      width:  300,
      height: 300,
      contentURL:data.url('tp-browser-notification.html'),
      //onHide:  function(evt){mypanel.show()}
  });

  // maybe this should live over on task / setup side?
  mypanel.port.on("action", function(data) {
    console.log('got action!');
    console.log(JSON.stringify(data));

    if (!data.data.action) return

    switch (data.data.action) {
      case "close":
          mypanel.destroy();  // yes, fall through!
      default:
          emit(event_target,data.data.action,data);
          break;
    }
  });
  return mypanel
}


let ask_survey_desktop = function(){

};

let ask_experiment_upload_desktop = function(){

}

let ask_experiment_install_desktop = function(){

};

let inform_upload_desktop = function(){
};

switch (appname) {
    case "Firefox":
        exports.tpdialogue  = tpdialogue;
        exports.ask_survey = ask_survey_desktop;
        exports.ask_experiment_upload = ask_experiment_upload_desktop;
        exports.ask_experiment_install = ask_experiment_install_desktop;
        exports.inform_upload = inform_upload_desktop
        break;
    case "Fennec":
        throw Error("we don't know how to run UI on mobile yet");
        break;
    default:
        throw Error("no ui available on platform: " + appname);
};


EXPORTED_SYMBOLS.forEach(function(x){exports[x] = this[x]});
