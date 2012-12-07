/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

EXPORTED_SYMBOLS = ["TestPilotSetup", "POPUP_SHOW_ON_NEW",
                    "POPUP_SHOW_ON_FINISH", "POPUP_SHOW_ON_RESULTS",
                    "ALWAYS_SUBMIT_DATA", "RUN_AT_ALL_PREF"];

let l10n = require("l10n").get;
let myprefs = require('simple-prefs').prefs;
let observer = require("observer-service");
const {Cc,Ci,Cu} = require("chrome");

const EXTENSION_ID = require('self').id;
const VERSION_PREF ="lastversion";
const FIRST_RUN_PREF ="firstRunUrl";
const RUN_AT_ALL_PREF = "runStudies";
const POPUP_SHOW_ON_NEW = "popup.showOnNewStudy";
const POPUP_SHOW_ON_FINISH = "popup.showOnStudyFinished";
const POPUP_SHOW_ON_RESULTS = "popup.showOnNewResults";
const POPUP_CHECK_INTERVAL = "popup.delayAfterStartup";
const POPUP_REMINDER_INTERVAL = "popup.timeBetweenChecks";
const ALWAYS_SUBMIT_DATA = "alwaysSubmitData";
const UPDATE_CHANNEL_PREF = "app.update.channel";
const LOG_FILE_NAME = "TestPilotErrorLog.log";
const RANDOM_DEPLOY_PREFIX = "deploymentRandomizer";

let {TestPilotUIBuilder} = require('interface');

let TestPilotSetup = {
  didReminderAfterStartup: false,
  startupComplete: false,
  _shortTimer: null,
  _longTimer: null,
  _remoteExperimentLoader: null, // TODO make this a lazy initializer too?
  taskList: [],
  version: "",

  // Lazy initializers:
  __application: null,
  get _application() {
    if (this.__application == null) {
      this.__application = Cc["@mozilla.org/fuel/application;1"]
                             .getService(Ci.fuelIApplication);
    }
    return this.__application;
  },

  get _prefs() {
    return { 'getValue': function(key,default_value){
        let v = myprefs[key];
        console.log('getting:', key,v,default_value);
        return (v === undefined) ? default_value : v
      },
      'setValue': function(key,value){
        myprefs[key] = value;
      }
    }
  },

  __feedbackManager: null,
  get _feedbackManager() {
    if (this.__feedbackManager == null) {
      let FeedbackModule = require("feedback");
      this.__feedbackManager = FeedbackModule.FeedbackManager;
    }
    return this.__feedbackManager;
  },

  __dataStoreModule: null,
  get _dataStoreModule() {
    if (this.__dataStoreModule == null) {
      this.__dataStoreModule = require("experiment_data_store");
    }
    return this.__dataStoreModule;
  },

  __logRepo: null,
  get _logRepo() {
    // Note: This hits the disk so it's an expensive operation; don't call it
    // on startup.
    if (this.__logRepo == null) {
      let {Log4Moz} = require("log4moz");
      let props = Cc["@mozilla.org/file/directory_service;1"].
                    getService(Ci.nsIProperties);
      let logFile = props.get("ProfD", Ci.nsIFile);
      logFile.append(LOG_FILE_NAME);
      let formatter = new Log4Moz.BasicFormatter;
      let root = Log4Moz.repository.rootLogger;
      root.level = Log4Moz.Level["All"];
      let appender = new Log4Moz.RotatingFileAppender(logFile, formatter);
      root.addAppender(appender);
      if (require('simple-prefs').prefs['logtoconsole']){
        root.addAppender(new Log4Moz.ConsoleAppender(formatter));
      }
      this.__logRepo = Log4Moz.repository;

    }
    return this.__logRepo;
  },

  __logger: null,
  get _logger() {
    if (this.__logger == null) {
      this.__logger = this._logRepo.getLogger("TestPilot.Setup");
    }
    return this.__logger;
  },

  __taskModule: null,
  get _taskModule() {
    if (this.__taskModule == null) {
      this.__taskModule = require("tasks");
    }
    return this.__taskModule;
  },

  __obs: null,
  get _obs() {
    // TODO, completely eliminate, superceded by jetpack
    return observer
  },

  globalStartup: function TPS__doGlobalSetup() {
    // Only ever run this stuff ONCE, on the first window restore.
    // Should get called by the Test Pilot component.
    let logger = this._logger;
    logger.trace("TestPilotSetup.globalStartup was called.");

    try {
    if (!this._prefs.getValue(RUN_AT_ALL_PREF, true)) {
      logger.trace("Test Pilot globally disabled: Not starting up.");
      return;
    }

    // Set up observation for task state changes
    var self = this;
    this._obs.add("testpilot:task:changed", this.onTaskStatusChanged, self);
    this._obs.add(
      "testpilot:task:dataAutoSubmitted", this._onTaskDataAutoSubmitted, self);
    // Set up observation for application shutdown.
    this._obs.add("quit-application", this.globalShutdown, self);
    // Set up observation for enter/exit private browsing:
    this._obs.add("private-browsing", this.onPrivateBrowsingMode, self);

    // Set up timers to remind user x minutes after startup
    // and once per day thereafter.  Use nsITimer so it doesn't belong to
    // any one window.
    logger.trace("Setting interval for showing reminders...");

    this._shortTimer = Cc["@mozilla.org/timer;1"].createInstance(Ci.nsITimer);
    this._shortTimer.initWithCallback(
      { notify: function(timer) { self._doHousekeeping();} },
      this._prefs.getValue(POPUP_CHECK_INTERVAL, 180000),
      Ci.nsITimer.TYPE_REPEATING_SLACK
    );
    this._longTimer = Cc["@mozilla.org/timer;1"].createInstance(Ci.nsITimer);
    this._longTimer.initWithCallback(
      { notify: function(timer) {
          self.reloadRemoteExperiments(function() {
            self._notifyUserOfTasks();
	  });
      }}, this._prefs.getValue(POPUP_REMINDER_INTERVAL, 86400000),
      Ci.nsITimer.TYPE_REPEATING_SLACK);

      this.getVersion(function() {
        /* Show first run page (in front window) only the first time after install;
         * Don't show first run page in Feedback UI version. */
        if ((self._prefs.getValue(VERSION_PREF, "") == "") &&
           (!TestPilotUIBuilder.channelUsesFeedback())) {
            self._prefs.setValue(VERSION_PREF, self.version);
            let browser = self._getFrontBrowserWindow().getBrowser();
            let url = self._prefs.getValue(FIRST_RUN_PREF, "");
            let tab = browser.addTab(url);
            browser.selectedTab = tab;
        }

        // Install tasks. (This requires knowing the version, so it is
        // inside the callback from getVersion.)
        self.checkForTasks(function() {
          /* Callback to complete startup after we finish
           * checking for tasks. */
         self.startupComplete = true;
         logger.trace("I'm in the callback from checkForTasks.");
         // Send startup message to each task:
         for (let i = 0; i < self.taskList.length; i++) {
           self.taskList[i].onAppStartup();
         }
         self._obs.notify("testpilot:startup:complete", "", null);
         /* onWindowLoad gets called once for each window,
          * but only after we fire this notification. */
         logger.trace("Testpilot startup complete.");
      });
    });
    } catch(e) {
      logger.error("Error in testPilot startup: " + e);
    }
  },

  globalShutdown: function TPS_globalShutdown() {
    let logger = this._logger;
    logger.trace("Global shutdown.  Unregistering everything.");
    let self = this;
    for (let i = 0; i < self.taskList.length; i++) {
      self.taskList[i].onAppShutdown();
      self.taskList[i].onExperimentShutdown();
    }
    this.taskList = [];
    this._obs.remove("testpilot:task:changed", this.onTaskStatusChanged, self);
    this._obs.remove(
      "testpilot:task:dataAutoSubmitted", this._onTaskDataAutoSubmitted, self);
    this._obs.remove("quit-application", this.globalShutdown, self);
    this._obs.remove("private-browsing", this.onPrivateBrowsingMode, self);
    this._loader.unload();
    this._shortTimer.cancel();
    this._longTimer.cancel();
    logger.trace("Done unregistering everything.");
  },

  _getFrontBrowserWindow: function TPS__getFrontWindow() {
    let wm = Cc["@mozilla.org/appshell/window-mediator;1"].
               getService(Ci.nsIWindowMediator);
    // TODO Is "most recent" the same as "front"?
    return wm.getMostRecentWindow("navigator:browser");
  },

  onPrivateBrowsingMode: function TPS_onPrivateBrowsingMode(topic, data) {
    for (let i = 0; i < this.taskList.length; i++) {
      if (data == "enter") {
        this.taskList[i].onEnterPrivateBrowsing();
      } else if (data == "exit") {
        this.taskList[i].onExitPrivateBrowsing();
      }
    }
  },

  onWindowUnload: function TPS__onWindowRegistered(window) {
    this._logger.trace("Called TestPilotSetup.onWindow unload!");
    for (let i = 0; i < this.taskList.length; i++) {
      this.taskList[i].onWindowClosed(window);
    }
  },

  onWindowLoad: function TPS_onWindowLoad(window) {
    this._logger.trace("Called TestPilotSetup.onWindowLoad!");
    // Run this stuff once per window...
    let self = this;

    // Register listener for URL loads, that will notify all tasks about
    // new page:
    let appcontent = window.document.getElementById("appcontent");
    if (appcontent) {
      appcontent.addEventListener("DOMContentLoaded", function(event) {
        let newUrl =  event.originalTarget.URL;
        self._feedbackManager.fillInFeedbackPage(newUrl, window);
        for (let i = 0; i < self.taskList.length; i++) {
          self.taskList[i].onUrlLoad(newUrl, event);
        }
      }, true);
    }

    // Let each task know about the new window.
    for (let i = 0; i < this.taskList.length; i++) {
      this.taskList[i].onNewWindow(window);
    }
  },

  addTask: function TPS_addTask(testPilotTask) {
    // TODO raise some kind of exception if a task with the same ID already
    // exists.  No excuse to ever be running two copies of the same task.
    this.taskList.push(testPilotTask);
  },

  _showNotification: function TPS__showNotification(task, fragile, text, title,
                                                    iconClass, showSubmit,
						    showAlwaysSubmitCheckbox,
                                                    linkText, linkUrl,
						    isExtensionUpdate,
                                                    onCloseCallback) {
    /* TODO: Refactor the arguments of this function, it's getting really
     * unweildly.... maybe pass in an object, or even make a notification an
     * object that you create and then call .show() on. */

    // If there are multiple windows, show notifications in the frontmost
    // window.
    let window = this._getFrontBrowserWindow();
    let doc = window.document;
    let popup = doc.getElementById("pilot-notification-popup");

    let anchor, xOffset;
    if (TestPilotUIBuilder.channelUsesFeedback()) {
      /* If we're in the Ffx4Beta version, popups hang down from the feedback
       * button. In the standalone extension version, they hang down from
       * a temporary Test Pilot icon that appears in the toolbar. */
      anchor = doc.getElementById("feedback-menu-button");
      xOffset = 0;
    } else {
      anchor = doc.getElementById("tp-notification-popup-icon");
      anchor.hidden = false;
      /* By default, right edge of notification will line up with right edge of anchor.
       * That looks fine for feedback button, but the test pilot icon is narrower and
       * this alignment causes the pointy part of the arrow to miss the icon.  Fix this
       * by shifting the notification to the right 24 pixels. */
      xOffset = 24;
    }
    let textLabel = doc.getElementById("pilot-notification-text");
    let titleLabel = doc.getElementById("pilot-notification-title");
    let icon = doc.getElementById("pilot-notification-icon");
    let submitBtn = doc.getElementById("pilot-notification-submit");
    let closeBtn = doc.getElementById("pilot-notification-close");
    let link = doc.getElementById("pilot-notification-link");
    let alwaysSubmitCheckbox =
      doc.getElementById("pilot-notification-always-submit-checkbox");
    let self = this;

    // Set all appropriate attributes on popup:
    if (isExtensionUpdate) {
      popup.setAttribute("tpisextensionupdate", "true");
    }
    popup.setAttribute("noautohide", !fragile);
    titleLabel.setAttribute("value", title);
    while (textLabel.lastChild) {
      textLabel.removeChild(textLabel.lastChild);
    }
    textLabel.appendChild(doc.createTextNode(text));
    if (iconClass) {
      // css will set the image url based on the class.
      icon.setAttribute("class", iconClass);
    }

    alwaysSubmitCheckbox.setAttribute("hidden", !showAlwaysSubmitCheckbox);
    if (showSubmit) {
      if (isExtensionUpdate) {
        submitBtn.setAttribute("label", l10n("testpilot.notification.update"));
	submitBtn.onclick = function() {
          this._extensionUpdater.check(EXTENSION_ID);
          self._hideNotification(window, onCloseCallback);
	};
      } else {
        submitBtn.setAttribute("label",l10n("testpilot.submit"));
        // Functionality for submit button:
        submitBtn.onclick = function() {
          self._hideNotification(window, onCloseCallback);
          if (showAlwaysSubmitCheckbox && alwaysSubmitCheckbox.checked) {
            self._prefs.setValue(ALWAYS_SUBMIT_DATA, true);
          }
          task.upload( function(success) {
            if (success) {
              self._showNotification(
		task, true,
                l10n("testpilot.notification.thankYouForUploadingData.message"),
                l10n("testpilot.notification.thankYouForUploadingData"),
		"study-submitted", false, false,
                l10n("testpilot.moreInfo"),
		task.defaultUrl);
            } else {
              // TODO any point in showing an error message here?
            }
          });
        };
      }
    }
    submitBtn.setAttribute("hidden", !showSubmit);

    // Create the link if specified:
    if (linkText && (linkUrl || task)) {
      link.setAttribute("value", linkText);
      link.onclick = function(event) {
        if (event.button == 0) {
	  if (task) {
            task.loadPage();
	  } else {
            self._openChromeless(linkUrl);
	  }
          self._hideNotification(window, onCloseCallback);
        }
      };
      link.setAttribute("hidden", false);
    } else {
      link.setAttribute("hidden", true);
    }

    closeBtn.onclick = function() {
      self._hideNotification(window, onCloseCallback);
    };

    // Show the popup:
    popup.hidden = false;
    popup.setAttribute("open", "true");
    popup.openPopup( anchor, "after_end", xOffset, 0);
  },

  _openChromeless: function TPS__openChromeless(url) {
    let window = this._getFrontBrowserWindow();
    window.TestPilotWindowUtils.openChromeless(url);
  },

  _hideNotification: function TPS__hideNotification(window, onCloseCallback) {
    /* Note - we take window as an argument instead of just using the frontmost
     * window because the window order might have changed since the notification
     * appeared and we want to be sure we close the notification in the same
     * window as we opened it in! */
    let popup = window.document.getElementById("pilot-notification-popup");
    popup.hidden = true;
    popup.setAttribute("open", "false");
    popup.removeAttribute("tpisextensionupdate");
    popup.hidePopup();

    if (!TestPilotUIBuilder.channelUsesFeedback()) {
      // If we're using the temporary test pilot icon as an anchor, hide it now
      let icon = window.document.getElementById("tp-notification-popup-icon");
      icon.hidden = true;
    }
    if (onCloseCallback) {
      onCloseCallback();
    }
  },

  _isShowingUpdateNotification : function() {
    let window = this._getFrontBrowserWindow();
    let popup = window.document.getElementById("pilot-notification-popup");

    return popup.hasAttribute("tpisextensionupdate");
  },

  _notifyUserOfTasks: function TPS__notifyUser() {
    // Check whether there are tasks needing attention, and if any are
    // found, show the popup door-hanger thingy.
    let i, task;
    let TaskConstants = this._taskModule.TaskConstants;

    // if showing extension update notification, don't do anything.
    if (this._isShowingUpdateNotification()) {
      return;
    }

    // Highest priority is if there is a finished test (needs a decision)
    if (this._prefs.getValue(POPUP_SHOW_ON_FINISH, false)) {
      for (let i = 0; i < this.taskList.length; i++) {
        task = this.taskList[i];
        if (task.status == TaskConstants.STATUS_FINISHED) {
          if (!this._prefs.getValue(ALWAYS_SUBMIT_DATA, false)) {
            this._showNotification(
	      task, false,
	      l10n("testpilot.notification.readyToSubmit.message", task.title),
	      l10n("testpilot.notification.readyToSubmit"),
	      "study-finished", true, true,
	      l10n("testpilot.moreInfo"),
	      task.defaultUrl);
            // We return after showing something, because it only makes
            // sense to show one notification at a time!
            return;
          }
        }
      }
    }

    // If there's no finished test, next highest priority is new tests that
    // are starting...
    if (this._prefs.getValue(POPUP_SHOW_ON_NEW, false)) {
      for (let i = 0; i < this.taskList.length; i++) {
        task = this.taskList[i];
        if (task.status == TaskConstants.STATUS_PENDING ||
            task.status == TaskConstants.STATUS_NEW) {
          if (task.taskType == TaskConstants.TYPE_EXPERIMENT) {
	    this._showNotification(
	      task, false,
	      l10n("testpilot.notification.newTestPilotStudy.pre.message",task.title),
	      l10n("testpilot.notification.newTestPilotStudy"),
	      "new-study", false, false,
	      l10n("testpilot.moreInfo"),
	      task.defaultUrl, false, function() {
                /* on close callback (Bug 575767) -- when the "new study
                 * starting" popup is dismissed, then the study can start. */
                task.changeStatus(TaskConstants.STATUS_STARTING, true);
                TestPilotSetup.reloadRemoteExperiments();
              });
            return;
          } else if (task.taskType == TaskConstants.TYPE_SURVEY) {
	    this._showNotification(
	      task, false,
        l10n("testpilot.notification.newTestPilotSurvey.message",task.summary || task.title),
          // in task.js summary falls back to title if undefined or empty, but we double make sure :)

        l10n("testpilot.notification.newTestPilotSurvey"),
        "new-survey",
	      false, false,
        l10n("testpilot.takeSurvey"),
	      task.defaultUrl);
            task.changeStatus(TaskConstants.STATUS_IN_PROGRESS, true);
            return;
          }
        }
      }
    }

    // And finally, new experiment results:
    if (this._prefs.getValue(POPUP_SHOW_ON_RESULTS, false)) {
      for (let i = 0; i < this.taskList.length; i++) {
        task = this.taskList[i];
        if (task.taskType == TaskConstants.TYPE_RESULTS &&
            task.status == TaskConstants.STATUS_NEW) {
	  this._showNotification(
	    task, true,
	    l10n("testpilot.notification.newTestPilotResults.message",task.title),
      l10n("testpilot.notification.newTestPilotResults"),
	    "new-results", false, false,
	    l10n("testpilot.moreInfo"),
	    task.defaultUrl);
          // Having shown the notification, advance the status of the
          // results, so that this notification won't be shown again
          task.changeStatus(TaskConstants.STATUS_ARCHIVED, true);
          return;
        }
      }
    }
  },

  _doHousekeeping: function TPS__doHousekeeping() {
    // check date on all tasks:
    for (let i = 0; i < this.taskList.length; i++) {
      let task = this.taskList[i];
      task.checkDate();
    }
    // Do a full reminder -- but at most once per browser session
    if (!this.didReminderAfterStartup) {
      this._logger.trace("Doing reminder after startup...");
      this.didReminderAfterStartup = true;
      this._notifyUserOfTasks();
    }
  },

  onTaskStatusChanged: function TPS_onTaskStatusChanged() {
    this._notifyUserOfTasks();
  },

  _onTaskDataAutoSubmitted: function(subject, data) {
    this._showNotification(
      subject, true,
      this._stringBundle.formatStringFromName(
	"testpilot.notification.autoUploadedData.message",
	[subject.title], 1),
      this._stringBundle.GetStringFromName(
	"testpilot.notification.autoUploadedData"),
      "study-submitted", false, false,
      this._stringBundle.GetStringFromName("testpilot.moreInfo"),
      subject.defaultUrl);
  },

  getVersion: function TPS_getVersion(callback) {
    // Application.extensions undefined in Firefox 4; will use the new
    // asynchrounous API, store string in this.version, and call the
    // callback when done.
    if (this._application.extensions) {
      this.version = this._application.extensions.get(EXTENSION_ID).version;
      callback();
    } else {
      let self = this;
      self._application.getExtensions(function(extensions) {
        self.version = extensions.get(EXTENSION_ID).version;
        callback();
      });
    }
  },

  _isNewerThanMe: function TPS__isNewerThanMe(versionString) {
    let result = Cc["@mozilla.org/xpcom/version-comparator;1"]
                   .getService(Ci.nsIVersionComparator)
                   .compare(this.version, versionString);
    if (result < 0) {
      return true; // versionString is newer than my version
    } else {
      return false; // versionString is the same as or older than my version
    }
  },

  _isNewerThanFirefox: function TPS__isNewerThanFirefox(versionString) {
    let result = Cc["@mozilla.org/xpcom/version-comparator;1"]
                   .getService(Ci.nsIVersionComparator)
                   .compare(this._application.version, versionString);
    if (result < 0) {
      return true; // versionString is newer than Firefox
    } else {
      return false; // versionString is the same as or older than Firefox
    }
  },

  _checkExperimentRequirements: function TPS__requirementsMet(experiment, callback) {
    /* Async.
     * Calls callback with a true if we we meet the requirements to run this
     * experiment (e.g. meet the minimum Test Pilot version and Firefox version)
     * calls callback with a false if not.
     * All of the requirements that a study can specify - firefox version, test pilot
     * version, filter function etc - default to true if not provided. callback(true)
     * UNLESS the study specifies a requirement that we don't meet. */
    let logger = this._logger;
    try {
      let minTpVer, minFxVer, expName, filterFunc, randomDeployment;
      /* Could be an experiment, which specifies experimentInfo, or survey,
       * which specifies surveyInfo. */
      let info = experiment.experimentInfo ?
                   experiment.experimentInfo :
                   experiment.surveyInfo;
      if (!info) {
        // If neither one is supplied, study lacks metadata required to run
        logger.warn("Study lacks minimum metadata to run.");
        callback(false);
        return;
      }
      minTpVer = info.minTPVersion;
      minFxVer = info.minFXVersion;
      expName =  info.testName;
      filterFunc = info.filter;
      randomDeployment = info.randomDeployment;

      // Minimum test pilot version:
      if (minTpVer && this._isNewerThanMe(minTpVer)) {
        logger.warn("Not loading " + expName);
        logger.warn("Because it requires Test Pilot version " + minTpVer);

        // Let user know there is a newer version of Test Pilot available:
        if (!this._isShowingUpdateNotification()) {
          this._showNotification(
	    null, false,
	    l10n("testpilot.notification.extensionUpdate.message"),
	    l10n("testpilot.notification.extensionUpdate"),
	    "update-extension", true, false, "", "", true);
	}
        callback(false);
        return;
      }

      // Minimum firefox version:
      if (minFxVer && this._isNewerThanFirefox(minFxVer)) {
        logger.warn("Not loading " + expName);
        logger.warn("Because it requires Firefox version " + minFxVer);
        callback(false);
        return;
      }

      // Random deployment (used to give study to random subsample of users)
      if (randomDeployment) {
        /* Roll a 100*uniform_random. Remember what we roll for later reference or reuse.  A study
         * using random subsample deployment will provide a range (say, 0 ~ 30) which means
         * only users who roll not outside that range (inclusive) will run the study.
         * ie., [0,1.5] -> 1.5% prob
         */
        let prefName = RANDOM_DEPLOY_PREFIX + "." + randomDeployment.rolloutCode;
        let myRoll = this._prefs.getValue(prefName, null);
        if (myRoll == null) {
          myRoll = Math.random()*100;
          this._prefs.setValue(prefName, JSON.stringify(myRoll));
        } else {
          myRoll = Number(myRoll);  // cast it
        }
        if (myRoll < randomDeployment.minRoll) {
          callback(false);
          return;
        }
        if (myRoll > randomDeployment.maxRoll) {
          callback(false);
          return;
        }
      }

      /* The all-purpose, arbitrary code "Should this study run?" function - if
       * provided, use it.  (filterFunc must be asynchronous too!)*/
      if (filterFunc) {
        filterFunc(callback);
        return;
      }
    } catch (e) {
      logger.warn("Error in requirements check " +  e);
      callback(false); // if something went wrong, err on the side of not running the study
    }
    callback(true);
  },

  checkForTasks: function TPS_checkForTasks(callback) {
    let logger = this._logger;
    if (! this._remoteExperimentLoader ) {
      logger.trace("Now requiring remote experiment loader:");
      let remoteLoaderModule = this._loader.require("remote-experiment-loader");
      logger.trace("Now instantiating remoteExperimentLoader:");
      let rel = new remoteLoaderModule.RemoteExperimentLoader(this._logRepo);
      this._remoteExperimentLoader = rel;
    }

    let self = this;
    this._remoteExperimentLoader.checkForUpdates(
      function(success) {
        logger.info("Getting updated experiments... Success? " + success);
        // Actually, we do exactly the same thing whether we succeeded in
        // downloading new contents or not...
        let experiments = self._remoteExperimentLoader.getExperiments();

        let numExperimentsProcessed = 0;
        let numExperiments = Object.keys(experiments).length;
        for (let filename in experiments) {
          self._checkExperimentRequirements(experiments[filename], function(requirementsMet) {
            if (requirementsMet) {
              try {
                /* The try-catch ensures that if something goes wrong in loading one
                 * experiment, the other experiments after that one still get loaded. */
                logger.trace("Attempting to load experiment " + filename);
                let task;
                // Could be a survey: check if surveyInfo is exported:
                if (experiments[filename].surveyInfo != undefined) {
                  let sInfo = experiments[filename].surveyInfo;
                  // If it supplies questions, it's a built-in survey.
                  // If not, it's a web-based survey.
                  if (!sInfo.surveyQuestions) {
                    task = new self._taskModule.TestPilotWebSurvey(sInfo);
                  } else {
                    task = new self._taskModule.TestPilotBuiltinSurvey(sInfo);
                  }
                } else {
                  // This one must be an experiment.
                  let expInfo = experiments[filename].experimentInfo;
                  let dsInfo = experiments[filename].dataStoreInfo;
                  let dataStore = new self._dataStoreModule.ExperimentDataStore(
                    dsInfo.fileName, dsInfo.tableName, dsInfo.columns );
                  let webContent = experiments[filename].webContent;
                  task = new self._taskModule.TestPilotExperiment(expInfo,
                                                                  dataStore,
                                                                  experiments[filename].handlers,
                                                                  webContent);
                }
                self.addTask(task);
                logger.info("Loaded task " + filename);
              } catch (e) {
                logger.warn("Failed to load task " + filename + ": " + e);
              }
            } // end if requirements met
            // whether loading succeeded or failed, we're done processing that one; increment the count:
            numExperimentsProcessed ++;
            if (numExperimentsProcessed == numExperiments) {
              // all done with experiments -- do results and legacy studies:
              let results = self._remoteExperimentLoader.getStudyResults();
              for (let r in results) {
                let studyResult = new self._taskModule.TestPilotStudyResults(results[r]);
                self.addTask(studyResult);
              }

              /* Legacy studies = stuff we no longer have the code for, but
               * if the user participated in it we want to keep that metadata. */
              let legacyStudies = self._remoteExperimentLoader.getLegacyStudies();
              for (let l in legacyStudies) {
                let legacyStudy = new self._taskModule.TestPilotLegacyStudy(legacyStudies[l]);
                self.addTask(legacyStudy);
              }

              // Finally, call the callback if there is one
              if (callback) {
                callback();
              }
            } // end of if all experiments are processed
          }); // end of call to check experiment requirements
        } // end for filename in experiments
      }
    ); // end of call to checkForUpdates
  },

  reloadRemoteExperiments: function TPS_reloadRemoteExperiments(callback) {
    for (let i = 0; i < this.taskList.length; i++) {
      this.taskList[i].onExperimentShutdown();
    }

    this.taskList = [];
    this.checkForTasks(callback);
  },

  getTaskById: function TPS_getTaskById(id) {
    for (let i = 0; i < this.taskList.length; i++) {
      let task = this.taskList[i];
      if (task.id == id) {
	return task;
      }
    }
    return null;
  },

  getAllTasks: function TPS_getAllTasks() {
    return this.taskList;
  }
};

EXPORTED_SYMBOLS.forEach(function(x){exports[x] = this[x]});
