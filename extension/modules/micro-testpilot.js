
// Tiny embeddable version of Test Pilot.
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

EXPORTED_SYMBOLS = ["MicroTestPilot"];

const Cc = Components.classes;
const Ci = Components.interfaces;
const Cu = Components.utils;

let AddonManagerMod = {};
Cu.import("resource://gre/modules/AddonManager.jsm",AddonManagerMod);
let {AddonManager} = AddonManagerMod;

const STATUS_PREF_PREFIX = "extensions.testpilot.taskstatus.";
const LOCALE_PREF = "general.useragent.locale";
const UPDATE_CHANNEL_PREF = "app.update.channel";
const DATA_UPLOAD_URL = "https://testpilot.mozillalabs.com/submit/";

const NEW = 0;
const RUNNING = 1;
const DONE = 2;
const UPLOADED = 3;

const DAY_MS = 24 * 60 * 60 * 1000; // milliseconds in a day

var _dirSvc = Cc["@mozilla.org/file/directory_service;1"]
                .getService(Ci.nsIProperties);
var _storSvc = Cc["@mozilla.org/storage/service;1"]
                 .getService(Ci.mozIStorageService);
var _prefs = Cc["@mozilla.org/preferences-service;1"]
      .getService(Ci.nsIPrefBranch);

function MicroTestPilot(studyName, duration) {
  /* Duration is a number of days the study should collect data.
   * studyName must be a string containing only alphanumerics and underscores
   * and must not be the same as the name of any other test pilot study. */
  var startDate, dbConnection, timer;
  var tableName = "tp_" + studyName + "_data";
  var status = _prefs.getIntPref(STATUS_PREF_PREFIX + studyName);
  function setStatus(newStatus) {
    status = newStatus;
    _prefs.setValue(STATUS_PREF_PREFIX + studyName, newStatus);
  }

  if (status == UPLOADED) {
    // do nothing; return object with no-op method so that record() calls in client code
    // are no-ops
    return { name: studyName, record: function() {} };
  }

  dbConnection = initDatabase();

  // 0 - not initialized. 1 - running. 2 - done but not submitted. 3 - submitted.
  if (status == NEW) {
    // first run - set start date
    startDate = Date.now();
    _prefs.setCharPref(START_DATE_PREF_PREFIX + studyName, startDate.toString());
    setStatus(RUNNING);
  } else {
    // Not first run - retrieve start date we set before.
    startDate = Date.parse( _prefs.getCharPref(START_DATE_PREF_PREFIX + studyName));
  }

  function checkDate() {
    if (Date.now() - startDate > duration * DAY_MS) {
      endStudy();
    }
  }
  if (status == RUNNING || status == DONE) {
    timer = Cc["@mozilla.org/timer;1"]
              .createInstance(Ci.nsITimer);
    timer.initWithCallback({ notify: function(timer) {
                               checkDate();
                             } }, 24 * 60 * 60 * 1000, Ci.nsITimer.TYPE_REPEATING_SLACK);
    checkDate();
  }

  function endStudy() {
    setStatus(DONE);
    upload( function(success) {
              if (success) {
                setStatus(UPLOADED);
                cleanupDatabase();
                timer.cancel();
              }
            });
  }

  function record(object) {
    if (status == RUNNING) {
      var insert = "INSERT INTO " + tableName + " VALUES(?1, ?2);";
      var insertStmt = dbConnection.createStatement(insert);
      insertStmt.params[0] = JSON.stringify(object);
      insertStmt.params[1] = Date.now();
      insertStmt.executeAsync();
      insertStmt.finalize();
    }
  }

  function initDatabase() {
    var file = _dirSvc.get("ProfD", Ci.nsIFile);
    file.append(tableName + ".sqlite");
    // openDatabase creates the file if it's not there yet:
    var dbConnection = _storSvc.openDatabase(file);
    // Create the table if it does not exist:
    if (!dbConnection.tableExists(tableName)) {
      dbConnection.createTable(tableName, "jsonblob TEXT, timestamp INTEGER");
    }
    return dbConnection;
  }

  function cleanupDatabase() {
    // Drop table, close database connection:
    var drop = dbConnection.createStatement("DROP TABLE " + tableName);
    drop.executeAsync();
    drop.finalize();
    if (dbConnnection) {
      dbConnection.close();
    }
    // Delete file:
    var file = _dirSvc.get("ProfD", Ci.nsIFile);
    file.append(tableName + ".sqlite");
    if (file.exists) {
      file.remove();
    }
  }

  function retrieveAllData(callback) {
    let userData = {
      location: _prefs.getCharPref(LOCALE_PREF),
      fxVersion: Cc["@mozilla.org/xre/app-info;1"]
        .getService(Ci.nsIXULAppInfo).version,
      os: Cc["@mozilla.org/xre/app-info;1"].getService(Ci.nsIXULRuntime).OS,
      updateChannel: _prefs.getCharPref(UPDATE_CHANNEL_PREF)
    };

    AddonManager.getAllAddons(function(extensions) {
      userData.extensionCount = extensions.all.length;
      let selectSql = "SELECT * FROM " + tableName;
      var select = dbConnection.createStatement(selectSql);
      var records= [];
      select.executeAsync({
        handleResult: function(resultSet) {
          for (let row = aResultSet.getNextRow(); row;
            row = aResultSet.getNextRow()) {
            let newRecord = JSON.parse( row.getUTF8string(0) );
            newRecord.timestamp = row.getDouble(1);
            records.push( newRecord );
          }
        },
        handleCompletion: function() {
          userData.events = records;
          callback( JSON.stringify( json ) );
        }
      });
    });
  }

  function upload(callback) {
    var url = DATA_UPLOAD_URL + studyName;
    retrieveAllData( function(dataString) {
      var req = Cc["@mozilla.org/xmlextras/xmlhttprequest;1"]
                  .createInstance( Ci.nsIXMLHttpRequest );
      req.open('POST', url, true);
      req.setRequestHeader("Content-type", "application/json");
      req.setRequestHeader("Content-length", dataString.length);
      req.setRequestHeader("Connection", "close");
      req.onreadystatechange = function(aEvt) {
        if (req.readyState == 4) {
          if (req.status == 200 || req.status == 201 || req.status == 202) {
            callback(true);
          } else {
            callback(false);
          }
        }
      };
      req.send(dataString);
    });
  }

  // Return object with record method
  return { name: studyName,
           timer: timer,
           record: record,
           status: status
           };
}

