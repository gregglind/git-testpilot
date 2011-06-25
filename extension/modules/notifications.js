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
     showNotification: function(window, features, choices) {},
     hideNotification: function(window) {}
 */

EXPORTED_SYMBOLS = ["CustomNotificationManager", "PopupNotificationManager"];

const Cc = Components.classes;
const Ci = Components.interfaces;
const Cu = Components.utils;

/* CustomNotificationManager: the one where notifications
 * come up from the Test Pilot icon in the addon bar.  For Firefox 3.6. */
function CustomNotificationManager(anchorToFeedbackButton) {
  this._anchorToFeedback = anchorToFeedbackButton;
}
CustomNotificationManager.prototype = {
  showNotification: function TP_OldNotfn_showNotification(window, features, choices) {
    let doc = window.document;
    let popup = doc.getElementById("pilot-notification-popup");
    let textLabel = doc.getElementById("pilot-notification-text");
    let titleLabel = doc.getElementById("pilot-notification-title");
    let icon = doc.getElementById("pilot-notification-icon");
    let button = doc.getElementById("pilot-notification-submit");
    let closeBtn = doc.getElementById("pilot-notification-close");
    let link = doc.getElementById("pilot-notification-link");
    let checkbox = doc.getElementById("pilot-notification-always-submit-checkbox");
    let self = this;
    let buttonChoice = null;
    let linkChoice = null;
    let checkBoxChoice = null;
    let anchor;

    if (this._anchorToFeedback) {
      /* If we're in the Ffx4Beta version, popups come down from feedback
       * button, but if we're in the standalone extension version, they
       * come up from status bar icon. */
      anchor = doc.getElementById("feedback-menu-button");
      popup.setAttribute("class", "tail-up");
    } else {
      anchor = doc.getElementById("pilot-notifications-button");
      popup.setAttribute("class", "tail-down");
    }

    popup.setAttribute("noautohide", !(features.fragile));
    if (features.title) {
      titleLabel.setAttribute("value", features.title);
    }
    while (textLabel.lastChild) {
      textLabel.removeChild(textLabel.lastChild);
    }
    if (features.text) {
      textLabel.appendChild(doc.createTextNode(features.text));
    }
    if (features.iconClass) {
      // css will set the image url based on the class.
      icon.setAttribute("class", features.iconClass);
    }

    /* Go through the specified choices and figure out which one to turn into a link, which one
     * (if any) to turn into a button, and which one (if any) to turn into a check box. */
    for (let i = 0; i < choices.length; i++) {
      switch(choices[i].customUiType) {
      case "button":
        buttonChoice = choices[i];
        break;
      case "link":
        linkChoice = choices[i];
        break;
      case "checkbox":
        checkBoxChoice = choices[i];
        break;
      }
    }
    // Create check box if specified:
    if (checkBoxChoice) {
      checkbox.removeAttribute("hidden");
      checkbox.setAttribute("label", checkBoxChoice.label);
    } else {
      checkbox.setAttribute("hidden", true);
    }

    // Create button if specified:
    if (buttonChoice) {
      button.setAttribute("label", buttonChoice.label);
      button.onclick = function(event) {
        if (event.button == 0) {
          if (checkbox.checked && checkBoxChoice) {
            checkBoxChoice.callback();
          }
          buttonChoice.callback();
          self.hideNotification(window);
          if (features.closeCallback) {
            features.closeCallback();
          }
        }
      };
      button.removeAttribute("hidden");
    } else {
      button.setAttribute("hidden", true);
    }

    // Create the link if specified:
    if (linkChoice) {
      link.setAttribute("value", linkChoice.label);
      link.setAttribute("class", "notification-link");
      link.onclick = function(event) {
        if (event.button == 0) {
          linkChoice.callback();
          self.hideNotification(window);
          if (features.closeCallback) {
            features.closeCallback();
          }
        }
      };
      link.removeAttribute("hidden");
    } else {
      link.setAttribute("hidden", true);
    }

    closeBtn.onclick = function() {
      self.hideNotification(window);
      if (features.closeCallback) {
        features.closeCallback();
      }
    };

    // Show the popup:
    popup.hidden = false;
    popup.setAttribute("open", "true");
    popup.openPopup( anchor, "after_end");
  },

  hideNotification: function TP_OldNotfn_hideNotification(window) {
    let popup = window.document.getElementById("pilot-notification-popup");
    popup.removeAttribute("open");
    popup.hidePopup();
  }
};

// For Fx 4.0 + , uses the built-in doorhanger notification system (but with my own anchor icon)
function PopupNotificationManager(anchorToFeedbackButton) {
  /* In the future, we may want to anchor these to the Feedback button if present,
   * but for now that option is unimplemented. */
  this._popupModule = {};
  Components.utils.import("resource://gre/modules/PopupNotifications.jsm", this._popupModule);
  this._pn = null;
}
PopupNotificationManager.prototype = {
  get _stringBundle() {
    delete this._stringBundle;
    return this._stringBundle = Cc["@mozilla.org/intl/stringbundle;1"].
        getService(Ci.nsIStringBundleService).
          createBundle("chrome://testpilot/locale/main.properties");
  },

  showNotification: function TP_NewNotfn_showNotification(window, features, choices) {
    let self = this;
    let tabbrowser = window.getBrowser();
    let panel = window.document.getElementById("testpilot-notification-popup");
    let iconBox = window.document.getElementById("tp-notification-popup-box");
    let defaultChoice = null;
    let additionalChoices = [];

    // hide any existing notification so we don't get a weird stack
    this.hideNotification();

    // TODO this is recreating PopupNotifications every time... should create once and store ref, but
    // can we do that without the window ref?
    this._pn = new this._popupModule.PopupNotifications(tabbrowser, panel, iconBox);

    /* Add hideNotification() calls to the callbacks of each choice -- the client code shouldn't
     * have to worry about hiding the notification in its callbacks.*/
    for (let i = 0; i < choices.length; i++) {
      let choice = choices[i];
      let choiceWithHide = {
        label: choice.label,
        accessKey: choice.accessKey,
        callback: function() {
          self.hideNotification();
          choice.callback();
        }};
      // Take the first one to be the default choice:
      if (i == 0) {
        defaultChoice = choiceWithHide;
      } else {
        additionalChoices.push(choiceWithHide);
      }
    }

    this._notifRef = this._pn.show(window.getBrowser().selectedBrowser,
                             "testpilot",
                             features.text,
                             "tp-notification-popup-icon", // All TP notifications use this icon
                             defaultChoice,
                             additionalChoices,
                             {persistWhileVisible: true,
                              timeout: 5000,
                              removeOnDismissal: features.fragile,
                              title: features.title,
                              iconClass: features.iconClass,
                              closeButtonFunc: function() {
                                self.hideNotification();
                              },
                              eventCallback: function(stateChange){
                                /* Note - closeCallback() will be called AFTER the button handler,
                                 * and will be called no matter whether the notification is closed via
                                 * close button or a menu button item.
                                 */
                                if (stateChange == "removed" && features.closeCallback) {
                                  features.closeCallback();
                                }
                              }}); // should make it not disappear for at least 5s?
    // See http://mxr.mozilla.org/mozilla-central/source/toolkit/content/PopupNotifications.jsm
  },

  hideNotification: function TP_NewNotfn_hideNotification() {
    if (this._notifRef && this._pn) {
      this._pn.remove(this._notifRef);
      this._notifRef = null;
    }
  }
};
