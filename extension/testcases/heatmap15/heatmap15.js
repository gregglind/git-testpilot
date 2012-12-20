"use strict";

if (typeof Cc == "undefined") {
  var {Cc,Ci,Cu} = require("chrome");
}

var BaseClasses = require("./study_base_classes.js");

const ORIGINAL_TEST_ID = 101;
const MY_TEST_ID = "heatmap15";

var GUID_PREF_PREFIX = "extensions.testpilot.taskGUID.";
if (typeof ADDONPREFPREFIX != 'undefined') {
  GUID_PREF_PREFIX = ADDONPREFPREFIX + 'taskGUID.';
}

/* The multiple Firefox Beta 4 Interface Studies are longitudial.
 * The uploads need a shared GUID so we can match them up on the server.
 * This is not supported by the extension yet so we do a hack right here.
 * If there are multiple runs of the study, copy the
 * GUID from the ORIGINAL run into my GUID -- (it's all just prefs).
 * Now we can associate the different uploads with each other and with
 * the survey upload.*/
let prefs = require("preferences-service");
let guid = prefs.get(GUID_PREF_PREFIX + MY_TEST_ID, "");
if (guid == "") {
  let uuidGenerator =
    Cc["@mozilla.org/uuid-generator;1"].getService(Ci.nsIUUIDGenerator);
  guid = uuidGenerator.generateUUID().toString();
  // remove the brackets from the generated UUID
  if (guid.indexOf("{") == 0) {
    guid = guid.substring(1, (guid.length - 1));
  }
  prefs.set(GUID_PREF_PREFIX + MY_TEST_ID, guid);
}

/* Explanation of the schema:
 * Schema is highly generic so that it can handle everything from toolbar
 * customizations to mouse events to menu selections.
 *
 * Column name Meaning
 * Event = study metadata, customization, or action? (Int code)
 * Item = Top-level element: "File menu", "Url bar", "tab bar",
 * etc. (String)
 * Sub-item = Menu item name, or like "right scroll button", etc.
 * (String)
 * Interaction = Click, menu-pick, right-click, click-and-hold,
 * keyboard shortcut, etc. (String)
 * Timestamp = Milliseconds since epoch. (Long int)
 */

//TODO: update where this is stored, or don't bother. TP 2 can set this as a pref
const debug_logging = true;

const EVENT_CODES = {
  METADATA: 0,
  ACTION: 1,
  MENU_HUNT: 2,
  CUSTOMIZE: 3
};

var COMBINED_EXPERIMENT_COLUMNS = [
  {property: "event", type: BaseClasses.TYPE_INT_32, displayName: "Event",
   displayValue: ["Study Metadata", "Action", "Menu Hunt", "Customization"]},
  {property: "item", type: BaseClasses.TYPE_STRING, displayName: "Element"},
  {property: "sub_item", type: BaseClasses.TYPE_STRING,
   displayName: "Sub-Element"},
  {property: "interaction_type", type: BaseClasses.TYPE_STRING,
   displayName: "Interaction"},
  {property: "timestamp", type: BaseClasses.TYPE_DOUBLE, displayName: "Time",
   displayValue: function(value) {return new Date(value).toLocaleString();}}
];

exports.experimentInfo = {
  startDate: null, // Null start date means we can start immediately.
  duration: 7, // Days
  testName: "Desktop Heatmap 15",
  testId: MY_TEST_ID,
  testInfoUrl: "http://blog.mozilla.org/userresearch/",
  summary: "This study looks at how the usage patterns of the Firefox UI have changed since the last version.",
  thumbnail: null,
  optInRequired: false,
  recursAutomatically: false,
  recurrenceInterval: 0,
  versionNumber: 1,
  minTPVersion: "1.2",
  minFXVersion: "4.0",
  randomDeployment: { rolloutCode: "heatmap15", minRoll: 0, maxRoll: 11 }
};

exports.dataStoreInfo = {
  fileName: "heatmap15.sqlite",
  tableName: "heatmap15",
  columns: COMBINED_EXPERIMENT_COLUMNS
};


//TODO: add references to all listeners for unloading

// from http://mxr.mozilla.org/mozilla-central/source/browser/base/content/urlbarBindings.xml
var parseActionUrl = function(aUrl) {
    /*
        > parseActionUrl("moz-action:switchtab,http://blah")
        {"type": 'switchtab', "param": "http://blah" }
    */
    if (!/^moz-action:/.test(aUrl)) {
        return {type: null};
    }
    // url is in the format moz-action:ACTION,PARAM
    let [, action, param] = aUrl.match(/^moz-action:([^,]+),(.*)$/);
    return {type: action, param: param};
};

/* Window observer class - one is instantiated per window; most of what
 * we observe in this study is per-window, so this class registers a LOT
 * of listeners.
 */
function CombinedWindowObserver(window) {
  CombinedWindowObserver.baseConstructor.call(this, window);

  //Full list of gestures at https://developer.mozilla.org/En/DOM/Mouse_gesture_events. We cut out
  //all starts and updates
  var trackpad_swipes = ["MozSwipeGesture","MozMagnifyGesture","MozRotateGesture"];

  trackpad_swipes.forEach(
        function(etype,ii){
            let myetype = etype;
            window.addEventListener(etype,function(evt){
             var direction = "";
             var delta = "";
             if (etype == "MozSwipeGesture") {
             //SimpleGestureEvent constants defined here: https://developer.mozilla.org/En/NsIDOMSimpleGestureEvent
				switch(evt.direction) {
					case 4:
						direction = "left";
						break;
					case 8:
						direction = "right";
						break;
					case 1:
						direction = "up";
						break;
					case 2:
						direction = "down";
						break;
					default:
						direction = "undefined";
				}
			}
            else if (etype == "MozMagnifyGesture"){
	            if (evt.delta > 0) {
	            	direction = "out";
				} else {
					direction = "in";
				}
			}
			else {
				if (evt.direction == 1) {
					direction = "counterclockwise";
				} else {
					direction = "clockwise";
				}
			}
            exports.handlers.record(EVENT_CODES.ACTION, "window", myetype, direction);
            }
            ,true);
     }
    )
window.addEventListener("command", function(evt){exports.handlers.record(EVENT_CODES.ACTION, "command", evt.target.id, "");}, true);
};
BaseClasses.extend(CombinedWindowObserver,
                   BaseClasses.GenericWindowObserver);
// Window observer class, helper functions:
CombinedWindowObserver.prototype.compareSearchTerms = function(searchTerm,
                                                               searchEngine) {
  /* Are two successive searches done with the same search term?
   * Are they with the same search engine or not?
   * Don't record the search term or the search engine, just whether it's the
   * same or not. */
  if (searchTerm == this._lastSearchTerm) {
    if (searchEngine == this._lastSearchEngine) {
      exports.handlers.record(EVENT_CODES.ACTION, "searchbar", "",
                              "same search same engine");
    } else {
      exports.handlers.record(EVENT_CODES.ACTION, "searchbar", "",
                              "same search different engine");
    }
  }
  this._lastSearchTerm = searchTerm;
  this._lastSearchEngine = searchEngine;
};
CombinedWindowObserver.prototype.urlLooksMoreLikeSearch = function(url) {
  /* Trying to tell whether user is inputting searches in the URL bar.
   * Heuristic to tell whether a "url" is really a search term:
   * If there are spaces in it, and/or it has no periods in it.
   */
  return ( (url.indexOf(" ") > -1) || (url.indexOf(".") == -1));
};
CombinedWindowObserver.prototype.recordPanoramaState = function() {
  /* Record panorama state - Record number of panorama tab groups, then
   * record number of tabs in each group. */
  if (this.window.TabView._window) {
    let gi = this.window.TabView._window.GroupItems;
    exports.handlers.record(EVENT_CODES.CUSTOMIZE, "Panorama", "Num Groups:",
                gi.groupItems.length);
    for each (let g in gi.groupItems) {
      exports.handlers.record(EVENT_CODES.CUSTOMIZE, "Panorama",
                              "Num Tabs In Group:", g._children.length);
    }
    // some tabs not affiliated with any group (called "orphans")
    let numOrphans = gi.getOrphanedTabs().length;
    exports.handlers.record(EVENT_CODES.CUSTOMIZE, "Panorama",
                            "Num Orphaned Tabs", numOrphans);
  } else {
    // If TabView is uninitialized, just record total # of tabs
    // in the window instead.
    let tabCount = this.window.getBrowser().tabContainer.itemCount;
    exports.handlers.record(EVENT_CODES.CUSTOMIZE, "Window",
                            "Total Number of Tabs", tabCount);
  }
};

// Window observer class, main listener registration
CombinedWindowObserver.prototype.install = function() {
  let window = this.window;
  if (!window.gBrowser) {
    console.info("Not installing listeners. Not a browser window");
    this.is_real_window = false; // bookmarks/places, others. TODO: refactor to function?
    return false;
  } else {
    this.is_real_window = true;

	// Leo Code for bseg study
	// Track to see if the value in the URL bar changes
	// https://developer.mozilla.org/en-US/docs/Code_snippets/Progress_Listeners
	var myExt_urlBarListener = {
		QueryInterface: function(aIID) {
			if (aIID.equals(Components.interfaces.nsIWebProgressListener) ||
			aIID.equals(Components.interfaces.nsISupportsWeakReference) ||
			aIID.equals(Components.interfaces.nsISupports))
				return this;
		throw Components.results.NS_NOINTERFACE;
		},
		onLocationChange: function(aProgress, aRequest, aURI) {
		switchExtension.processNewURL(aURI);
		}
	};

	var switchExtension = {
		oldURL: null,
		init: function() {
			// Listen for webpage loads
			window.gBrowser.addProgressListener(myExt_urlBarListener);
		},
		uninit: function() {
			window.gBrowser.removeProgressListener(myExt_urlBarListener);
		},
		processNewURL: function(aURI) {
			//let record_switch = false;
			if (aURI.host == null || aURI.host == this.oldURL)
				return;
			// now we know the url is new...
			if (aURI.host != this.oldURL) {
				if (this.oldURL == null) {
					record("SwitchDiffHost", "fromNULL", "switch");
				}
				else {
					record("SwitchDiffHost", "normal", "switch");
				}
			}
			this.oldURL = aURI.host;
		}
	};
	// End Leo code for bseg study

    console.info("Starting to install listeners for combined window observer.");
  };

  // Helper function for recording actions
  //For sanity: this is one of TWO record methods; other is combinedwindowobserver

  let record = function( item, subItem, interaction ) {
   if (debug_logging) {
dump("* CombinedWindowObserver: " + EVENT_CODES.ACTION + "," + item + "," + subItem + "," +interaction+ "\n");
   }
    exports.handlers.record(EVENT_CODES.ACTION, item, subItem, interaction);
  };

  // register preference listeners
  var browser_pref_listener = new PrefListener("browser.",
			function(branch, name) {
			  switch (name) {
			      case "search.selectedEngine":
			    	  let search_engine = prefs.get("browser."+name, "");
			    	  record("browser."+name , "update_pref", search_engine);
			        break;
			      case "newtabpage.enabled":
			    	  let newtab_active = prefs.get("browser."+name, "");
			    	  record("browser."+name , "update_pref", newtab_active);
			        break;
			  }
		});
  browser_pref_listener.register(true);

  /* Register menu listeners:
   * 1. listen for mouse-driven command events on the main menu bar: */
  let mainMenuBar = window.document.getElementById("main-menubar");
  this._listen(mainMenuBar, "command", function(evt) {
    let node = evt.target;
    let menuItemName = node.id;
    if (!menuItemName) {
      menuItemName = "user-defined item";
    }
    let menuName = "unknown";
    while(node) {
      if (node.id == "main-menubar") {
         break;
      }
      if (node.tagName == "menu" && node.id) {
        menuName = node.id;
        break;
      }
      node = node.parentNode;
    }
    record(menuName, menuItemName, "mouse");
  }, true);

  /* 2. Listen for keyboard shortcuts and mouse command events on the
   * main command set: */
  let mainCommandSet = window.document.getElementById("mainCommandSet");
  this._listen(mainCommandSet, "command", function(evt) {
    let tag = evt.sourceEvent.target;
    if (tag.tagName == "menuitem") {
      let menuItemId = tag.id?tag.id:tag.command;
      let menuId = "unknown";
      let node = evt.sourceEvent.target;
      while(node) {
        if (node.tagName == "menupopup") {
          menuId = node.id;
          break;
        }
        node = node.parentNode;
      }
      record(menuId, menuItemId, "mouse");
    } else if (tag.tagName == "key") {
      record("menus", tag.command?tag.command:tag.id, "key shortcut");
    }},
    true);
  /* Intentionally omitted the code from the menu study that tracks
   * number of menus hunted through and time spent hunting */

  // Record clicks in tab bar right-click context menu:
  let tabContext = window.document.getElementById("tabContextMenu");
  this._listen(tabContext, "command", function(evt) {
                     if (evt.target && evt.target.id) {
                       record("tab context menu", evt.target.id, "click");
                       if (evt.target.id == "context_pinTab" ||
                           evt.target.id == "context_unpinTab") {
                         /* When you pin or unpin an app tab, record
                          * number of pinned tabs (number recorded is number
                          * BEFORE the change)*/
                         let change = 1;
                         if (evt.target.id != "context_pinTab" ) change = -1;
                         let numAppTabs = window.gBrowser._numPinnedTabs;
                         exports.handlers.record(EVENT_CODES.CUSTOMIZE,
                                                 "Tab Bar", "Num App Tabs",
                                                 numAppTabs + change);
                       }
                     }
                   }, true);


  // Record menu choices from right-click context menu
  // includes "search from right click which shows as "Search Google for <>"
  let contextMenu = window.document.getElementById("contentAreaContextMenu");
  this._listen(contextMenu, "command", function(evt) {
   if (evt.target && evt.target.id) {
	   record("contentAreaContextMenu", evt.target.id, "click");
   }
  }, true);


  // Observe searches coming from the about:home page
  // appcontent: https://developer.mozilla.org/en/Code_snippets/On_page_load
  // gbrowser: https://developer.mozilla.org/en/Code_snippets/Tabbed_browser#Getting_document_of_currently_selected_tab
  let appcontent = window.document.getElementById("appcontent");
  this._listen(appcontent, "DOMContentLoaded", function() {
   let url = window.gBrowser.contentDocument.location;
   if (url == "about:home") {
   record("about:home", "", "pageload");

   let searchForm = window.gBrowser.contentDocument.getElementById("searchForm");

   this._listen(searchForm, "submit", function() {
   record("about:home", "searchForm", "submit");
    }, true);

    let widget_ids = ["downloads", "bookmarks", "history", "addons", "sync", "settings"];

    for(let i = 0; i < widget_ids.length; i++) {
    let id = widget_ids[i];
    let widget = window.gBrowser.contentDocument.getElementById(id);
    this._listen(widget, "mouseup", function() {
   record("about:home", id, "click");
    }, true);

    }
   }
   if (url == "about:newtab") {
	   let toggle = window.gBrowser.contentDocument.getElementById("newtab-toggle");

	   this._listen(toggle, "mouseup", function() {
	   record("about:newtab", "newtab-toggle", "click");
	    }, true);
   }

   //example: http://www.mozilla.org/en-US/firefox/14.0.1/whatsnew/?oldversion=13.0.1
   //data below potentially useful for Holly Habstritt
   else if (url.toString().match(/www.mozilla.org.*firefox.*whatsnew/) != null) {
		let elem_ids = ["android-download", "video-player", "tabzilla", "colophon"];
		for (let i = 0; i < elem_ids.length; i++){
			let elem = window.gBrowser.contentDocument.getElementById(elem_ids[i]);
			this._listen(elem, "mouseup", function() {
				record("WhatsNewPage", elem.id, "click");
			}, true);
		}
   }
  //catch users who go directly to google.com. Why would you use this method instead of using searchbar/urlbar??
    else if (url.toString().match(/.*google.com/) != null) {
   record("google.com", "", "pageload");
    }
    else if (window.gBrowser.contentDocument.getElementById("errorPageContainer") != null) {
    	record("404 page", window.gBrowser.contentDocument.getElementById("errorTitleText").innerHTML, "pageload");
    }
  }, true);



  // Register listeners on all the main toolbar buttons we care about:
  let buttonIds = ["back-button", "forward-button", "reload-button",
                   "stop-button", "home-button", "feed-button", "star-button",
                   "identity-popup-more-info-button",
                   "back-forward-dropmarker", "security-button",
                   "downloads-button", "print-button", "bookmarks-button",
                   "history-button", "new-window-button", "tabview-button",
                   "cut-button", "copy-button", "paste-button",
                   "fullscreen-button", "urlbar-go-button", "urlbar-reload-button",
                   "urlbar-stop-button"];
  for (let i = 0; i < buttonIds.length; i++) {
    let id = buttonIds[i];
    let elem = window.document.getElementById(id);
    if (!elem) {
      // The element might not be there, if user customized it out
      console.info("Can't install listener: no element with id " + id);
      continue;
    }
    this._listen(elem, "mouseup",
                 function(evt) {
                   /* only count left button clicks and only on
                    * the element itself: */
                   if (evt.target == elem && evt.button == 0) {
                     let tagName = evt.target.tagName;
                     /* There are a lot of spacer elements in the toolbar
                      * that we don't care about tracking individually: */
                     if (tagName == "toolbarspacer" ||
                         tagName == "toolbarspring" ||
                         tagName == "toolbarseparator" ||
                         tagName == "splitter" ||
                         tagName == "hbox") {
                       id = "spacer";
                     } else {
                       id = evt.target.id;
                     }
                     record(id, "", "click");
                   }
                 }, false);
    /* LONGTERM TODO:
     * Problem with just listening for "mouseup" is that it triggers even
     * if you clicked a greyed-out button... we really want something more
     * like "button clicked". Try listening for "command"? */
  }

  /* Listen on site ID button, see if page is SSL, or extended validation,
   * or nothing. (TODO this is getting double-counted because it triggers
   * again if you click to close; should trigger on popupshown or something.)*/
  let idBox = window.document.getElementById("identity-box");
  this._listen(idBox, "mouseup", function(evt) {
                 let idBoxClass = idBox.getAttribute("class");
                 if (idBoxClass.indexOf("verifiedIdentity") > -1) {
                   record("site-id-button", "", "extended validation");
                 } else if (idBoxClass.indexOf("verifiedDomain") > -1) {
                   record("site-id-button", "", "SSL");
                 } else {
                   record("site-id-button", "", "none");
                 }
               }, false);

  // Helper function for listening miscellaneous toolbar interactions
  let self = this;
  let register = function(elemId, event, item, subItem, interactionName) {
    if (!self.window.document.getElementById(elemId)) {
      console.info("Can't register " + elemId + ", no such element.");
      return;
    }
    self._listen( self.window.document.getElementById(elemId), event,
                  function() {
                    record(item, subItem, interactionName);
                    if (item == "search engine dropdown" && event == "command") {
                     record(self.window.document.getElementById("searchbar").currentEngine.name, "", "select search engine");
                    }
                  }, false);
  };

  // Observe item selection in the RSS feed drop down menu:
  register( "feed-menu", "command", "rss icon", "menu item", "mouse pick");

  // Observe item selection in the search engine drop down menu:
  register( "search-container", "popupshown", "search engine dropdown",
            "menu item", "click");

  register( "search-container", "command", "search engine dropdown",
            "menu item", "menu pick");

  /* Observe item selection in recent history menu - which you can get by
   * clicking on the back button, forward button, and also (on Windows but
   * not on Mac) the back-forward-dropmarker. */
  register( "back-forward-dropmarker", "command", "recent page dropdown",
            "menu item", "mouse pick");
  this._listen(window.document.getElementById("back-button"),
               "mouseup", function(evt) {
                 if (evt.originalTarget.tagName == "menuitem") {
                   record("back-button", "dropdown menu", "mouse pick");
                 }
               }, false);
  this._listen(window.document.getElementById("forward-button"),
               "mouseup", function(evt) {
                 if (evt.originalTarget.tagName == "menuitem") {
                   record("forward-button", "dropdown menu", "mouse pick");
                 }
               }, false);

  // Observe clicks on bookmarks in the bookmarks toolbar
  let bkmkToolbar = window.document.getElementById("personal-bookmarks");
  this._listen(bkmkToolbar, "mouseup", function(evt) {
                 if (evt.button == 0 && evt.target.tagName == "toolbarbutton") {
                   if (evt.target.id == "bookmarks-menu-button") {
                     record("bookmarks-menu-button", "", "click");
                   } else {
                     record("bookmark toolbar", "personal bookmark", "click");
                   }
                 }}, false);

  // Observe clicks on the new unified Firefox menu button in the Windows beta
  let firefoxButton = window.document.getElementById("appmenu-button");
  this._listen(firefoxButton, "mouseup", function(evt) {
    let id = evt.target.id;
    /* If the target event (i.e. the menu item) has an ID, then easy; just
     * record that. The tricky part is all the elements with no ID... */
    if (!id) {
      /* figure out which menu we're a child of, then decide
       * what to record in place of the missing id.
       * Recurse upwards (we might be in a sub-sub-sub-folder)
       * until we hit something recognizable. */
      let parent = evt.target.parentNode;
      while (!parent.id) {
          parent = parent.parentNode;
          if (!parent) {
            record("appmenu-button", "unrecognized", "null");
            return;
          }
      }
      switch( parent.id) {
      case "appmenu_bookmarksMenupopup":
          id = "User boomark item";
          break;
      case "appmenu_historyMenupopup":
          id = "User history item";
          break;
      case "appmenu_recentlyClosedTabsMenupopup":
          id = "Recently closed tab item";
          break;
      case "appmenu_recentlyClosedWindowsMenupopup":
          id = "Recently closed window item";
          break;
      case "appmenu_developer_popup":
          id = evt.target.label;
          break;
      case "appmenu_customizeMenu":
          id = evt.target.label;
          break;
      default:
          record("appmenu-button", "unrecognized", parent.id);
          return;
      }
    }
    record("appmenu-button", id, "click");
  }, false);

  // Observe clicks on Feedback button
  // TODO can we fold this into the generic button observer?
  let feedbackToolbar = window.document.getElementById("feedback-menu-button");
  this._listen(feedbackToolbar, "mouseup", function(evt) {
    record("feedback-toolbar", evt.target.id, "click");
  }, false);

  /* Record clicks on new bookmark menu button; record "personal bookmark"
   * rather than the name of the item picked */
  let bmkButton = window.document.getElementById("bookmarks-menu-button");
  this._listen(bmkButton, "mouseup", function(evt) {
    record("bookmarks-menu-button", evt.target.id || "personal bookmark", "click");
  }, false);

  // Leo search from search bar to url bar code
  let justDidUrlBarSearch = false;
  let justDidUrlBarSearchWithThisTerm = "";

  // Listen on search bar ues by mouse and keyboard, including repeated
  // searches (same engine or different engine?)
  let searchBar = window.document.getElementById("searchbar");
  this._listen(searchBar, "keydown", function(evt) {
                 if (evt.keyCode == 13) { // Enter key
                   record("searchbar", "", "enter key");
                   self.compareSearchTerms(searchBar.value,
                                          searchBar.searchService.currentEngine.name);
						if (justDidUrlBarSearch) {
						if (searchBar.value == justDidUrlBarSearchWithThisTerm) {
						record("sameSearchFromUrlBarToSearchBar", "search term", "event");
						}
						justDidUrlBarSearch = false;
						justDidUrlBarSearchWithThisTerm = "";
						}
                 }
               }, false);

  this._listen(searchBar, "mouseup", function(evt) {
                 if (evt.originalTarget.getAttribute("anonid") == "search-go-button") {
                   record("searchbar", "go button", "click");
                   self.compareSearchTerms(searchBar.value,
                                          searchBar.searchService.currentEngine.name);
                   if (justDidUrlBarSearch) {
						if (searchBar.value == justDidUrlBarSearchWithThisTerm) {
							record("sameSearchFromUrlBarToSearchBar", "search term", "event");
						}
						justDidUrlBarSearch = false;
						justDidUrlBarSearchWithThisTerm = "";
                   }
                 }
               }, false);

  // Listen on URL bar:
  let urlBar = window.document.getElementById("urlbar");
  this._listen(urlBar, "change",function(evt){
                 console.log("URLBAR:",urlBar.value);}
  );

  this._listen(urlBar, "keydown", function(evt) {
                 if (evt.keyCode == 13) { // Enter key
                   // currentTarget moz-action:switchtab,http://www.mozilla.org/en-US/firefox/fx/
                   /* understand an log moz-actions */
                   var action;
                   if (evt['currentTarget']) {
                        action = parseActionUrl(evt['currentTarget'].value).type;
                   }
                   if (action) {
                        record("urlbar", "moz-action:"+action, "enter key");
                   } else {
						justDidUrlBarSearch = true;
						justDidUrlBarSearchWithThisTerm = evt.originalTarget.value;
                       if (self.urlLooksMoreLikeSearch(evt.originalTarget.value)) {
                         record("urlbar", "search term", "enter key");
                       } else {
                         record("urlbar", "url", "enter key");
                       }
                    }
                 }
               }, false);

  let urlGoButton = window.document.getElementById("urlbar-go-button");
  this._listen(urlGoButton, "mouseup", function(evt) {
               var action;
               if (evt['currentTarget']) {
                    action = parseActionUrl(evt['currentTarget'].value).type;
               }
               if (action) {
                    record("urlbar", "moz-action:"+action, "go button click");
               } else {
				justDidUrlBarSearch = true;
				justDidUrlBarSearchWithThisTerm = urlBar.value;
                 if (self.urlLooksMoreLikeSearch(urlBar.value)) {
                   record("urlbar", "search term", "go button click");
                 } else {
                   record("urlbar", "url", "go button click");
                 }
               }
            }, false);

  /* Intentionally omitted: Code for observing individual mouseup/mousedown
   * /change/select events in URL bar to distinguish click-and-insert,
   * select-and-replace, or replace-all URL editing actions. */

  // Observe when the most-frequently-used menu in the URL bar is opened
  this._listen(urlBar, "command", function(evt) {
                 if (evt.originalTarget.getAttribute("anonid") == "historydropmarker") {
                   record("urlbar", "most frequently used menu", "open");
                 }
               }, false);


  // Catch the 'search from the home page' stuff...
  /*
    if it's about:home && the "#searchForm" is submitted
  */
  // let aboutHomeSearch = window.document.get


  // Record Clicks on Scroll Buttons
  let content = window.document.getElementById("content");
  this._listen(content, "mouseup", function(evt) {
                 if (evt.button == 0) {
                   let parent = evt.originalTarget.parentNode;
                   if (parent.tagName == "scrollbar") {
                     if (parent.parentNode.tagName == "HTML") {
                       let orientation = parent.getAttribute("orient");
                       let widgetName = orientation + " scrollbar";
                       let part = evt.originalTarget.tagName;
                       if (part == "xul:slider") {
                         // TODO can't distinguish slider from track...
                         record(widgetName, "slider", "drag");
                       } else if (part == "xul:scrollbarbutton") {
                         let type = evt.originalTarget.getAttribute("type");
                         if (type == "increment") { // vs. "decrement"
                           record(widgetName, "up scroll button", "click");
                         } else {
                           record(widgetName, "down scroll button", "click");
                         }
                       }
                     }
                   }
                 }
               }, false);

    // Record tab bar interactions
    let tabBar = window.document.getElementById("TabsToolbar");
    this._listen(tabBar, "mouseup", function(evt) {
                   if (evt.button == 0) {
                     let targ = evt.originalTarget;
                     if (targ.id == "new-tab-button") {
                       record("tabbar", "new tab button", "click");
                     } else if (targ.className == "tabs-newtab-button") {
                       record("tabbar", "new tab button", "click");
                     } else if (targ.id == "alltabs-button") {
                       record("tabbar", "drop down menu", "click");
                     } else {
                       switch (targ.getAttribute("anonid")) {
                       case "scrollbutton-up":
                         record("tabbar", "left scroll button", "mouseup");
                         break;
                       case "scrollbutton-down":
                         record("tabbar", "right scroll button", "mouseup");
                         break;
                       }
                     }
                   }
                 }, false);
  // Record mouse-up and mouse-down on tab scroll buttons separately
  // so that we can tell the difference between click vs click-and-hold
    this._listen(tabBar, "mousedown", function(evt) {
                   if (evt.button == 0) {
                     let anonid = evt.originalTarget.getAttribute("anonid");
                     if (anonid == "scrollbutton-up") {
                         record("tabbar", "left scroll button", "mousedown");
                     }
                     if (anonid == "scrollbutton-down") {
                         record("tabbar", "right scroll button", "mousedown");
                     }
                   }
                 }, false);
    // Record picking an item from the tab drop down menu
    this._listen(tabBar, "command", function(evt) {
                   if (evt.originalTarget.tagName == "menuitem") {
                     /* TODO this seems to get triggered when you edit
                      * something in about:config and click OK or cancel
                      * -- weird. */
                     record("tabbar", "drop down menu", "menu pick");
                   }
               }, false);
  /* LONGTERM TODO:
   * Note we also get command events when you hit the tab scroll bars and
   * they actually scroll (the tagName will be "xul:toolbarbutton") -- as
   * opposed to moseup which triggers even if there's nowhere to scroll, this
   * might be a more precise way to get that event. In fact look at using
   * more command events on all the toolbar buttons...*/

  // Record opening of bookmark panel
  let bkmkPanel = window.document.getElementById("editBookmarkPanel");
  this._listen(bkmkPanel, "popupshown", function(evt) {
                 record( "star-button", "edit bookmark panel", "panel open");
               }, false);

  // Record clicks on "remove bookmark" button in bookmark panel:
  this._listen(bkmkPanel, "command", function(evt) {
                 switch (evt.originalTarget.getAttribute("id")) {
                 case "editBookmarkPanelRemoveButton":
                   record( "star-button", "remove bookmark button", "click");
                   break;
                 }
               }, false);

  // Record Tab view / panorama being shown/hidden:
  // Try tabviewshown and tabviewhidden
  this._listen(window, "tabviewshown", function(evt) {
                 record("Panorama", "Tab View Interface", "Opened");
               }, false);
  let deck = window.document.getElementById("tab-view-deck");
  this._listen(deck, "tabviewhidden", function(evt) {
                 record("Panorama", "Tab View Interface", "Closed");
                 // User has just finished interacting with Panorama,
                 // so record new number of tabs per group
                 self.recordPanoramaState();
               }, false);

  // Record per-window customizations (tab-related):
  record("window", exports.handlers.getNumWindows(), "new window opened");
  // Record number of app tabs:
  exports.handlers.record(EVENT_CODES.CUSTOMIZE, "Tab Bar", "Num App Tabs",
                          window.gBrowser._numPinnedTabs);

  // Record Panorama info - how many groups do you have right now, and how
  // many tabs in each group?
  this.recordPanoramaState();

  console.trace("Registering listeners complete.\n");

  // Leo's code: Register the URL bar switching function
  switchExtension.init();
};

CombinedWindowObserver.prototype.uninstall = function() {
  CombinedWindowObserver.superClass.uninstall.call(this);
  if (! this.is_real_window){ return; }; // bookmarks/places and such
  exports.handlers.record(EVENT_CODES.ACTION, "window",
                          exports.handlers.getNumWindows(),
                          "window closed");
};

function PrefListener(branch_name, callback) {
	  // Keeping a reference to the observed preference branch or it will get
	  // garbage collected.
	  var prefService = Components.classes["@mozilla.org/preferences-service;1"]
	    .getService(Components.interfaces.nsIPrefService);
	  this._branch = prefService.getBranch(branch_name);
	  this._branch.QueryInterface(Components.interfaces.nsIPrefBranch2);
	  this._callback = callback;
	}

PrefListener.prototype.observe = function(subject, topic, data) {
	  if (topic == 'nsPref:changed')
	    this._callback(this._branch, data);
};

PrefListener.prototype.register = function(trigger) {
this._branch.addObserver('', this, false);
if (trigger) {
let that = this;
this._branch.getChildList('', {}).
  forEach(function (pref_leaf_name)
    { that._callback(that._branch, pref_leaf_name); });
}
};

PrefListener.prototype.unregister = function() {
if (this._branch)
this._branch.removeObserver('', this);
};

/* The global observer class, for things that we only want to observe once,
 * rather than once-per-window. That mostly means observing toolbar
 * customizations and other customizations and prefs.
 */
function GlobalCombinedObserver() {
  GlobalCombinedObserver.baseConstructor.call(this, CombinedWindowObserver);
}
BaseClasses.extend(GlobalCombinedObserver, BaseClasses.GenericGlobalObserver);

GlobalCombinedObserver.prototype.onExperimentStartup = function(store) {
  GlobalCombinedObserver.superClass.onExperimentStartup.call(this, store);

  // Record study version number.
  this.record(EVENT_CODES.METADATA, "exp startup", "study version",
              exports.experimentInfo.versionNumber);

  // Get the front browser window, use it to record customizations!
  let wm = Cc["@mozilla.org/appshell/window-mediator;1"]
                        .getService(Ci.nsIWindowMediator);
  let frontWindow = wm.getMostRecentWindow("navigator:browser");

  // Are tabs on top?
  let toolbox = frontWindow.document.getElementById("navigator-toolbox");
  let tabPosition = (toolbox.getAttribute("tabsontop") == "true")?"true":"false";
  this.record(EVENT_CODES.CUSTOMIZE, "tab bar", "tabs on top?", tabPosition);

  // Is the main menu bar hidden? (for unified Firefox Menu Bar on Windows)
  let toolbarMenubar = frontWindow.document.getElementById("toolbar-menubar");
  let autohide = toolbarMenubar.getAttribute("autohide");
  this.record(EVENT_CODES.CUSTOMIZE, "menu bar", "hidden?",
              (autohide == "true")?"true":"false");

  // How many bookmarks in bookmark toolbar? Is bookmark toolbar shown?
  let bkmks = frontWindow.document.getElementById("PlacesToolbarItems").childNodes;
  this.record(EVENT_CODES.CUSTOMIZE, "bookmark bar", "num. bookmarks",
              bkmks.length);
  let bkmkToolbar = frontWindow.document.getElementById("personal-bookmarks");
  this.record(EVENT_CODES.CUSTOMIZE, "bookmark bar", "hidden?",
              "" + !!bkmkToolbar.parentNode.collapsed);

  // Is addon bar shown?
  let addonBar = frontWindow.document.getElementById("addon-bar");
  this.record(EVENT_CODES.CUSTOMIZE, "addon bar", "hidden?", addonBar.collapsed);

  // TODO Any change to toolbar buttons? (Copy code from toolbar study
  // and see if user has added/removed/reoredered)


  // Is Sync set up? What's the last time it synced?
  let syncName = prefs.get("services.sync.username", "");
  this.record(EVENT_CODES.CUSTOMIZE, "Sync", "Configured?",
              (syncName == "")?"False":"True");
  let lastSync = prefs.get("services.sync.lastSync", 0);
  this.record(EVENT_CODES.CUSTOMIZE, "Sync", "Last Sync Time", lastSync);

  // What search engine is set in the search bar?
  let searchbarengine = frontWindow.document.getElementById("searchbar").currentEngine.name;
  this.record(EVENT_CODES.CUSTOMIZE, "Search Bar", "Search Engine", searchbarengine);

  let newtabenabled = prefs.get("browser.newtabpage.enabled", true);
  this.record(EVENT_CODES.CUSTOMIZE, "newtab page", "Enabled?", newtabenabled);

  // Count uses of search bar suggestions and awesomebar suggestions/autocompletion:
  this._obsSvc = Cc["@mozilla.org/observer-service;1"]
                      .getService(Ci.nsIObserverService);
  let self = this;
  this.autocompleteObserver = { observe: function(subject, topic, data) {
                         if (subject.getAttribute("class") == "searchbar-textbox") {
                           if (!(subject.valueIsTyped && subject.mEnterEvent) ) {
                             self.record(EVENT_CODES.ACTION, "searchbar", "",
                             "choose suggestion");
                           } else {
                             self.record(EVENT_CODES.ACTION, "searchbar", "",
                             "no suggestion");
                           }
                         }
                         if (subject.getAttribute("id") == "urlbar") {
                         if (!(subject.valueIsTyped && subject.mEnterEvent) ) {
                                 self.record(EVENT_CODES.ACTION, "urlbar", "",
                                 "choose suggestion");
                               } else {
                                 self.record(EVENT_CODES.ACTION, "urlbar", "",
                                 "no suggestion");
                               }
                         }
                                }};
  //See mxr.mozilla.org/mozilla-central/source/toolkit/components/autocomplete/nsAutoCompleteController.cpp#1253
  this._obsSvc.addObserver(this.autocompleteObserver, "autocomplete-will-enter-text", false);
};

GlobalCombinedObserver.prototype.onExperimentShutdown = function() {
  GlobalCombinedObserver.superClass.onExperimentShutdown.call(this);
  this._obsSvc.removeObserver( this.autocompleteObserver, "autocomplete-will-enter-text");
};

GlobalCombinedObserver.prototype.getNumWindows = function() {
  return this._windowObservers.length;
};

// Record app startup and shutdown events:
GlobalCombinedObserver.prototype.onAppStartup = function() {
  GlobalCombinedObserver.superClass.onAppStartup.call(this);
  this.record(EVENT_CODES.METADATA, "app", "", "startup");
};

GlobalCombinedObserver.prototype.onAppShutdown = function() {
  GlobalCombinedObserver.superClass.onAppShutdown.call(this);
  this.record(EVENT_CODES.METADATA, "app", "", "shutdown");
};

// Utility function for recording events:
//For sanity: this is one of TWO record methods; other is combinedwindowobserver
GlobalCombinedObserver.prototype.record = function(event, item, subItem,
                                                  interactionType) {
  ///TODO: make less janky- unify logging as in thunderbird
  if (debug_logging) {
	  dump("* GlobalCombinedObserver: " + EVENT_CODES.ACTION + "," + item + "," + subItem + "," +interactionType+ "\n");
  }
  if (!this.privateMode) {
    // Make sure string columns are strings
    if (typeof item != "string") {
      item = item.toString();
    }
    if (typeof subItem != "string") {
      subItem = subItem.toString();
    }
    if (typeof interactionType != "string") {
      interactionType = interactionType.toString();
    }
    // For debugging:
    this._store.storeEvent({
      event: event,
      item: item,
      sub_item: subItem,
      interaction_type: interactionType,
      timestamp: Date.now()
    });
    // storeEvent can also take a callback, which we're not using here.
  }
};

exports.handlers = new GlobalCombinedObserver();

// Web content
function CombinedStudyWebContent() {
  CombinedStudyWebContent.baseConstructor.call(this, exports.experimentInfo);
}
BaseClasses.extend(CombinedStudyWebContent, BaseClasses.GenericWebContent);
CombinedStudyWebContent.prototype.__defineGetter__("dataViewExplanation",
  function() {
    return "This bar chart shows how often you used your 15 most frequently"
           + " used Firefox interface items.";
  });
CombinedStudyWebContent.prototype.__defineGetter__("dataCanvas",
  function() {
      return '<div class="dataBox"><h3>View Your Data:</h3>' +
      this.dataViewExplanation +
      this.rawDataLink +
      '<div id="data-plot-div" style="width:480x;height:800px"></div>' +
      this.saveButtons + '</div>';
  });
CombinedStudyWebContent.prototype.__defineGetter__("inProgressHtml",
  function() {
    return '<h2>Thank you, Test Pilot!</h2>' +
      '<p>The ' + this.titleLink + ' study is currently in progress.</p>' +
    '<p>' + this.expInfo.summary + '</p>' +
    '<p> The study will end in ' + this.expInfo.duration + ' days. ' +
    '<ul><li>You can save your test graph or export the raw data now, or after you \
submit your data.</li>' + this.thinkThereIsAnError +
      '<li>If you don\'t want to submit your data this time, ' +
      this.optOutLink + '.</li></ul>' + this.dataCanvas;
  });

/* Produce bar chart using flot lobrary; show 15 most frequently used items,
 * sorted, in a bar chart. */
CombinedStudyWebContent.prototype.onPageLoad = function(experiment,
                                                       document,
                                                       graphUtils) {
  experiment.getDataStoreAsJSON(function(rawData) {
    if (rawData.length == 0) {
      return;
    }

    let stats = [];
    let item;
    let lastActionId;
    for each( let row in rawData) {
      if (row.event != EVENT_CODES.ACTION) {
        continue;
      }
      // Skip the text selection events, they're not interesting
      if (row.item == "urlbar" && row.sub_item == "text selection") {
        continue;
      }
      // for window open/close we care about the interaction type more
      // than the sub item.
      if (row.item == "window") {
        row.sub_item = row.interaction_type;
      }
      let match = false;
      for (let x in stats) {
        if (stats[x].item == row.item && stats[x].sub_item == row.sub_item) {
          match = true;
          stats[x].quantity ++;
          break;
        }
      }
      if (!match) {
        stats.push( {item: row.item, sub_item: row.sub_item, quantity: 1} );
      }
    }

    let numItems = stats.length<15?stats.length:15;
    let d1 = [];
    let yAxisLabels = [];
    for (let i = 0; i < numItems; i++) {
      let item = stats[i];
      d1.push([item.quantity, i - 0.5]);
      let labelText = (item.item + ": <br/>" + item.sub_item).toLowerCase();
      yAxisLabels.push([i, labelText]);
    }
    try {
      let plotDiv = document.getElementById("data-plot-div");
      if (plotDiv == null)
        return;
      graphUtils.plot(plotDiv, [{data: d1}],
                      {series: {bars: {show: true, horizontal: true}},
                       yaxis: {ticks: yAxisLabels},
                       xaxis: {tickDecimals: 0}});
    } catch(e) {
      console.warn("Problem with graphutils: " + e + "\n");
    }
  });
};
exports.webContent = new CombinedStudyWebContent();

// Cleanup
require("unload").when(
  function myDestructor() {
    console.info("Combined study destructor called.");
    exports.handlers.uninstallAll();
  });