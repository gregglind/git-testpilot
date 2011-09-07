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
 *   Jono X <jono@mozilla.com>
 *   Raymond Lee <jono@appcoast.com>
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

var TestPilotWelcomePage = {
  surveyId: "basic_panel_survey_2",

  onLoad: function() {
    // Show link to pilot background survey only if user hasn't already
    // taken it.
    Components.utils.import("resource://testpilot/modules/setup.js");
    Components.utils.import("resource://testpilot/modules/tasks.js");
    Components.utils.import("resource://testpilot/modules/interface.js");
    this._setStrings();
    let survey = TestPilotSetup.getTaskById(this.surveyId);
    if (!survey) {
      // Can happen if page loaded before all tasks loaded
      window.setTimeout(function() { TestPilotWelcomePage.onLoad(); }, 2000);
      return;
    }
    if (survey.status == TaskConstants.STATUS_NEW) {
      document.getElementById("survey-link-p").setAttribute("style",
                                                            "display:block");
    }
  },

  openPilotSurvey: function() {
    let url =
      "chrome://testpilot/content/take-survey.html?eid=" + this.surveyId;
    TestPilotWindowUtils.openChromeless(url);
  },

  _setStrings: function() {
    let stringBundle =
      Components.classes["@mozilla.org/intl/stringbundle;1"].
        getService(Components.interfaces.nsIStringBundleService).
	  createBundle("chrome://testpilot/locale/main.properties");
    /* Use slightly different wording on this page depending on whether
     * the user has the version with the doorhanger notifications (Firefox 4.0+)
     * or not. */
    let doorhangerUI = TestPilotUIBuilder.hasDoorhangerNotifications();
    let map = [
      { id: "page-title", stringKey: "testpilot.fullBrandName" },
      { id: "thank-you-text",
        stringKey: "testpilot.welcomePage.thankYou" },
      { id: "please-take-text",
        stringKey: "testpilot.welcomePage.pleaseTake" },
      { id: "background-survey-text",
        stringKey: "testpilot.welcomePage.backgroundSurvey" },
      { id: "open-studies-window-link",
        stringKey: "testpilot.welcomePage.openAllStudiesPage" },
      {id: "mobile-addon-explanation-text",
       stringKey: "testpilot.welcomePage.mobileAddonExplanation"},
      {id: "mobile-notfn-explanation-text",
       stringKey: "testpilot.welcomePage.mobileNotfnExplanation"},
      {id: "mobile-options-explanation-text",
       stringKey: "testpilot.welcomePage.mobileOptionsExplanation"},
      { id: "privacy-policy-link",
	stringKey: "testpilot.welcomePage.privacyPolicy" },
      { id: "legal-notices-link",
	stringKey: "testpilot.welcomePage.legalNotices" }
      ];

    let mapLength = map.length;
    for (let i = 0; i < mapLength; i++) {
      let entry = map[i];
      document.getElementById(entry.id).innerHTML =
        stringBundle.GetStringFromName(entry.stringKey);
    }
  }
};