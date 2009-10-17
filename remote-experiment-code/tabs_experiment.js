// A Securable Module to be loaded with Cuddlefish.
// This is the remote code for the Tabs Experiment, to be hosted from the server.
// (Think about where to put the remote experiments in the Hg repo!!)

const TabsExperimentConstants = {
  // constants for event_code
  OPEN_EVENT: 1,
  CLOSE_EVENT: 2,
  DRAG_EVENT: 3,
  DROP_EVENT: 4,
  SWITCH_EVENT: 5,
  LOAD_EVENT: 6,
  STARTUP_EVENT: 7,
  SHUTDOWN_EVENT: 8,
  OPEN_WINDOW_EVENT: 9,
  CLOSE_WINDOW_EVENT: 10,

  // constants for ui_method
  UI_CLICK: 1,
  UI_KEYBOARD: 2,
  UI_MENU: 3,
  UI_LINK: 4,
  UI_URLENTRY: 5,
  UI_SEARCH: 6,
  UI_BOOKMARK: 7,
  UI_HISTORY: 8
};

// TODO: Firefox blurs/focuses, i.e. user switches application?
// Tabs that are 'permanenly open'

const TABS_EXPERIMENT_FILE = "testpilot_tabs_experiment_results.sqlite";
/* In this schema, each row represents a single UI event. */

const TABS_TABLE_NAME = "testpilot_tabs_experiment";

// event.timeStamp is milliseconds since epoch

var TABS_EXPERIMENT_COLUMNS =  [{property: "event_code", type: TYPE_INT_32},
                                {property: "tab_position", type: TYPE_INT_32},
                                {property: "tab_window", type: TYPE_INT_32},
                                {property: "ui_method", type: TYPE_INT_32},
                                {property: "tab_site_hash", type: TYPE_INT_32},
                                {property: "num_tabs", type: TYPE_INT_32},
                                {property: "timestamp", type: TYPE_DOUBLE}];

exports.experimentInfo = {
  startDate: "",
  stopDate: "",
  testName: "Tab Open/Close Study",
  testId: 1,
  testInfoUrl: "",
  optInRequired: false,
  basicPanel: true,
  versionNumber: 2 // for minor changes in format within the same experiment
};

exports.dataStoreInfo = {
  fileName: TABS_EXPERIMENT_FILE,
  tableName: TABS_TABLE_NAME,
  columns: TABS_EXPERIMENT_COLUMNS
};

// Schema is generated from columns; the property names are also used to access
// the properties of the uiEvent objects passed to storeEvent, and to create
// the column headers of the CSV file generated by barfAllData.


exports.observer = function(window) {
  this._init(window);
};
exports.observer.prototype = {
  _init: function observer__init(window) {
  },

  install: function observer_install() {
  },

  uninstall: function observer_uninstall() {
  }

  // Plus whatever other code is needed to do the observation
};

exports.statusPagePlugin = {
  inProgressHtml: "",  // this gets displayed in status page when experiment
                       // is still in progress
  completedHtml: "",   // this gets displayed in status page when experiment
                       // is completed
  upcomingHtml: "",    // For tests which don't start automatically, this gets
                       // displayed in status page before test starts.
  onPageLoad: function() {
    // This gets called when status page is loaded
    // code in here for drawing graphs, etc.
  }
};
