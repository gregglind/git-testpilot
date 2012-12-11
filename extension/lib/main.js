"use strict";
const self=require('self');
const data=self.data;
const tabs=require('tabs');
const preferences = require('preferences-service');
const myprefs = require('simple-prefs').prefs;
let {pathFor} = require('sdk/system');

let helper_prefs = {
    "general.warnOnAboutConfig": false,
    "browser.dom.window.dump.enabled": true,
    "+popup.delayAfterStartup": 2000,
    "+runStudies": true,
    "+popup.timeBetweenChecks": 60000, //used to be one day
    "+popup.showOnNewStudy": true,
    "+popup.showOnStudyFinished": true,
};

let local_prefs = {
    "+ssldownloadrequired":false,
    "+indexFileName":"index-my.json",
    "+indexBaseURL":"http://localhost:8000/testcases/",
};

function onPrefChange(prefName) {
    console.log("PREF:",prefName, "=>", myprefs[prefName] );
}

require('simple-prefs').on("", onPrefChange);

let opentab = function(url){
    if (url){
        console.log("opening", url);
        tabs.open(url);
    }
}

let setprefs = function (prefs,prefix) {
    prefix = prefix || "+";
    if (! prefs) {return};
    var n = prefix.length;
    Object.keys(prefs).forEach(
        function(k){
            let v = prefs[k];
            console.log('setting:', k, '=>', v);
            if (k.indexOf(prefix) == 0) { //
                myprefs[k.slice(n)] = v
            } else {  // regular pref
                preferences.set(k,v);
            }
        }
    );
};

console.log(Object.keys(module));

//console.log(require('also').a);
//require("setup").TestPilotSetup.globalStartup();
console.log('I can run');

var menuitem = require("menuitems").Menuitem({
  id: "pilot-menu",
  menuid: "menu_ToolsPopup",
  label: "Test Pilot",
  onCommand: function() {
    console.log("clicked");
  },
  insertafter: "menu_addonsManager",
  className: "menu-iconic"
});


let _logrepo = function(){
  let {Log4Moz} = require("log4moz");
  let formatter = new Log4Moz.BasicFormatter;
  let root = Log4Moz.repository.rootLogger;
  root.level = Log4Moz.Level["All"];
  root.addAppender(new Log4Moz.ConsoleAppender(formatter));
  return Log4Moz.repository;
}

exports.main = function main(options,callback){
    /*let notice = require("panel").Panel({
        contentURL: data.url("tp-browser-notification.html")
    });*/

    const { EventTarget } = require('sdk/event/target');
    let target = EventTarget({
        'onClose': function(data){
            console.log("Target got data:", JSON.stringify(data));
        },
        'onYes': function(data){
            opentab("http://zooborns.com");
            notice.destroy();
        },
        'onNo': function(data){
            console.log("BURN IN HECK!");
            notice.destroy();
        }
    });

    let notice = require("interface").tpdialogue(target);

    notice.port.on("jqready", function() {
        console.log('got ready');
        notice.port.emit('customize',{title: "Cuteness Survey", text: "Can You Stand The Cuteness?", linkText: 'take survey'});
        console.log("emitted!");
    });

    /*
    notice.on("show", function() {
        console.log('show');
        notice.port.emit('customize',{title: "Cuteness Survey", text: "Can You Stand The Cuteness?", linkText: 'take survey'});
        console.log("emitted!");
    });*/

    //notice.show(require('interface').anchorit(),{persistent:true});
    //opentab("chrome://global/content/console.xul");
    //opentab(data.url("tp-browser-notification.html"));

    /*
    let l10n = require('l10n').get;
    let task = {title: "Clean Aegean Stables"};
    console.log(l10n("testpilot.notification.readyToSubmit.message", task.title));

    let notice = require("interface").tpdialogue();
    notice.on("show", function() {
        notice.port.emit('customize',{title: "Our title", message: "our message"});
        console.log("emitted!");
    });
    notice.show(require('interface').anchorit(),{persistent:true});
    */

    //return true;
    // break!

	//opentab(data.url('debug.html'));
    let staticargs = options.staticArgs;
    // debug mode
    console.log("static args:",JSON.stringify(staticargs));

    if (staticargs.debugprefs) {
        setprefs(helper_prefs);
    }
    if (staticargs.local) {
        setprefs(local_prefs)
    }

    setprefs(staticargs.prefs);
    if (staticargs.urls) {
        staticargs.urls.forEach(opentab);
    }

    if (staticargs.debugpages) {
        ["about:config", //self.data.url("debug.html"),
          "about:addons",
          //self.data.url("welcome.html"),
          //myprefs["indexBaseURL"],
          pathFor('ProfD') + "/" + require("self").id + '-' + myprefs['jarfiledir'],
          "chrome://global/content/console.xul"].forEach(opentab);
    }

    // actually run, from the top, getting index.json, etc.
    // TODO:  make simpler entries for "seriously, run this exp."
    if (staticargs.experiments) {
        // always just run it
        // TODO, needs rooted path, but shouldn't!
        console.log("FORCE RUN EXPERIMENT");
        // controller is a singleton
        let controller = require("setup").TestPilotSetup;
        controller.globalStartup({"noremoteloading":true});
        staticargs.experiments.forEach(function(mainfile){
            let FILESPATH = "" // "/FILES/ isn't available in htis."
            let tploader = require('tploader').tploader(FILESPATH);
            console.log("Main file will be!", mainfile);
            opentab(mainfile);
            let mod = require('toolkit/loader').main(tploader,mainfile);
            console.log("modules has:", Object.keys(mod));
            controller._checkExperimentRequirements(mod,function(ok){
                console.log("REQUIREMENTS MET?", ok)})
            let task = controller.makeExperimentOrSurvey(mod);
            let {TaskConstants} = require('tasks');
            switch (task.taskType){
                case TaskConstants.TYPE_EXPERIMENT:
                    // it's a pain to untangle the opt-in from the download / restart stuff.
                    let msg = "EXPERIMENT:  skipping over opt-in, just starting";
                    console.log(msg);
                    require("panel").Panel({contentURL: data.url("forcerunning.html")}).show();
                    console.log("EXPERIMENT:  skipping over opt-in, just starting");
                    task.changeStatus(require('tasks').TaskConstants.STATUS_STARTING, false);
                    break;
                default:
                    console.log("non-experiment (",task.taskType,"): going through normal opt-in");
                    break;
            };
            console.log("TASK made");
            controller.addTask(task);
            console.log("TASK added");
        })
        controller._doHousekeeping();

    } else {
        require("setup").TestPilotSetup.globalStartup();
    }
    return false
};


require('api-utils/unload').when(function(reason){
    }
);
