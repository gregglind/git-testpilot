
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

/* The TestPilotSetup object will choose one of these implementations to instantiate.
 * The interface for all NotificationManager implementations is:
     showNotification: function(window, options) {},
     hideNotification: function(window) {}
 */

EXPORTED_SYMBOLS = ["AndroidNotificationManager"];

const Cc = Components.classes;
const Ci = Components.interfaces;
const Cu = Components.utils;

function AndroidNotificationManager() {
  // See https://developer.mozilla.org/en/XPCOM_Interface_Reference/nsIAlertsService
  Components.utils.import("resource://gre/modules/Services.jsm");
  Services.console.logStringMessage("Android Notfn Manager Instantiated.");
  // Get an error in the next line saying NS_ERROR_XPC_GS_RETURNED_FAILURE (nsIJSCID.getService)
  // is this because the alert service isn't available on desktop fennec???
  this._alerts = Cc["@mozilla.org/alerts-service;1"].getService(Ci.nsIAlertsService);
}
AndroidNotificationManager.prototype = {
  showNotification: function TP_AndroidNotfn_showNotification(window, options) {
    /* Submit, SeeAllStudies, alwaysSubmit, and Cancel options not implemented.
     * fragile and iconClass are ignored.  Clicking the notification always activates
     * the moreInfo option (e.g. opens the More Info page.)
     */
    Services.console.logStringMessage("Showing Android Notfn: " + options.text);

    this._alerts.showAlertNotification("drawable://alertaddons",
                                       options.title,
                                       options.text,
                                       true, // link is clickable
                                       "", // no cookie
                                       { observe: function(aSubject, aTopic, data) {
                                           if (aTopic == "alertclickcallback") {
                                             if (options.moreInfoLabel) {
                                               options.moreInfoCallback();
                                             }
                                             Services.console.logStringMessage("Notfn clicked.");
                                           }
                                         }
                                       },
                                       "test-pilot-notification");
  },

  hideNotification: function TP_AndroidNotfn_showNotification(window) {
  }
};
