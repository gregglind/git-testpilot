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

// for the HTML version

const NO_STUDIES_IMG = "chrome://testpilot/skin/testPilot_200x200.png";
const PROPOSE_STUDY_URL =
  "https://wiki.mozilla.org/Labs/Test_Pilot#For_researchers";

function _sortNewestFirst(experiments) {
    experiments.sort(
      function sortFunc(a, b) {
        if (a.status != b.status) {
          return a.status - b.status;
          // Ascending order of status - will put finished below in-progress
          // and put canceled studies at the bottom.
        }
        if (a.endDate && b.endDate) {
          return b.endDate - a.endDate; // Descending order of date
        }
        if (a.publishDate && b.publishDate) {
          if (isNaN(a.publishDate) || isNaN(b.publishDate)) {
            return 0;
          }
          return b.publishDate - a.publishDate;
        }
        return 0;
      });
    return experiments;
}


function fillAllStudiesPage() {
  Components.utils.import("resource://testpilot/modules/Observers.js");
  Components.utils.import("resource://testpilot/modules/setup.js");
  Components.utils.import("resource://testpilot/modules/tasks.js");

  let stringBundle =
      Components.classes["@mozilla.org/intl/stringbundle;1"].
        getService(Components.interfaces.nsIStringBundleService).
          createBundle("chrome://testpilot/locale/main.properties");

  let loadingMsg =  document.getElementById("still-loading-msg");
  loadingMsg.innerHTML = stringBundle.GetStringFromName("testpilot.statusPage.loading");

  // Are we done loading tasks?
  if (!TestPilotSetup.startupComplete || TestPilotSetup.getAllTasks().length == 0) {
    // If you opened the window before tasks are done loading, exit now
    // but try again in a few seconds.
    window.setTimeout(fillAllStudiesPage, 2000);
    return;
  }

  // hide the 'loading' msg
  loadingMsg.innerHTML = "";

  // clear the table
  let table = window.document.getElementById("studies-list");
  table.innerHTML = "";

  let experiments = TestPilotSetup.getAllTasks();
  if (experiments.length == 0) {
    // Show the message about no studies existing yet:
    // TODO test this part
    let span = document.createElement("span");
    span.innerHTML = stringBundle.GetStringFromName("testpilot.studiesWindow.noStudies");

    let link = document.createElement("a");
    link.setAttribute("href", PROPOSE_STUDY_URL);
    link.innerHTML = stringBundle.GetStringFromName("testpilot.studiesWindow.proposeStudy");

    let img = document.createElement("img");
    img.setAttribute("src", NO_STUDIES_IMG);
    loadingMsg.appendChild(span);
    loadingMsg.appendChild(link);
    loadingMsg.appendChild(img);
    return;
  }
  experiments = _sortNewestFirst(experiments);

  for (let i = 0; i < experiments.length; i++) {
    let task = experiments[i];
    let newRow = document.createElement("tr");

    let img = document.createElement("img");
    img.setAttribute("class", "results-thumbnail");
    img.setAttribute("src", task.thumbnail);
    let newCell = document.createElement("td");
    newCell.appendChild(img);
    newRow.appendChild(newCell);

    let link = document.createElement("a");
    link.setAttribute("href", task.defaultUrl);
    link.setAttribute("class", "study-title");
    link.innerHTML = task.title;
    newCell = document.createElement("td");
    newCell.appendChild(link);
    newRow.appendChild(newCell);

    let p = document.createElement("p");
    p.setAttribute("class", "ensmallened");
    img = null;
    switch (task.status) {
    case TaskConstants.STATUS_CANCELLED:
      img = document.createElement("img");
      img.setAttribute("src", "chrome://testpilot/skin/status-ejected.png");
      p.innerHTML = stringBundle.GetStringFromName("testpilot.studiesWindow.canceledStudy");
      break;
    case TaskConstants.STATUS_SUBMITTED:
      img = document.createElement("img");
      img.setAttribute("src", "chrome://testpilot/skin/status-completed.png");
      p.innerHTML = stringBundle.GetStringFromName("testpilot.studiesWindow.thanksForContributing");
      break;
    case TaskConstants.STATUS_MISSED:
      img = document.createElement("img");
      img.setAttribute("src", "chrome://testpilot/skin/status-missed.png");
      p.innerHTML = stringBundle.GetStringFromName("testpilot.studiesWindow.missedStudy");
      break;
    case TaskConstants.STATUS_FINISHED: // TODO submit button here?
      p.innerHTML = stringBundle.formatStringFromName(
        "testpilot.studiesWindow.finishedOn",
        [(new Date(task.endDate)).toLocaleDateString()], 1);
      break;
    case TaskConstants.STATUS_IN_PROGRESS:
    case TaskConstants.STATUS_STARTING:
      p.innerHTML = stringBundle.formatStringFromName(
        "testpilot.studiesWindow.willFinish",
        [(new Date(task.endDate)).toLocaleDateString()], 1);
      break;
    case TaskConstants.STATUS_PENDING:
    case TaskConstants.STATUS_NEW:
      p.innerHTML = stringBundle.formatStringFromName(
        "testpilot.studiesWindow.willStart",
        [(new Date(task.startDate)).toLocaleDateString()], 1);
      break;
    }
    newCell = document.createElement("td");
    if (img) {
      newCell.appendChild(img);
      newCell.appendChild(document.createElement("br"));
    }
    newCell.appendChild(p);
    newRow.appendChild(newCell);

    table.appendChild(newRow);

    newRow = document.createElement("tr");
    newCell = document.createElement("td");
    newCell.setAttribute("colspan", 3);
    newCell.setAttribute("class", "underlined-cell");
    newCell.innerHTML = task.summary;
    newRow.appendChild(newCell);
    table.appendChild(newRow);
  }
}