"use strict";

let {Cc,Ci,Cr,Cs, component} = require("chrome");

let { Loader, Require, Sandbox, load, Module, main, resolveURI, resolve,
      unload, descriptor, override } = require('toolkit/loader')
let { env, pathFor } = require('api-utils/system');

// TODO, ugh, we can be simpler than this
function uriFor(id) {
  let file = Cc["@mozilla.org/file/directory_service;1"].
             getService(Ci.nsIProperties).
             get(id, Ci.nsIFile);

  let ios = Cc["@mozilla.org/network/io-service;1"].
            getService(Ci.nsIIOService);

  return ios.newFileURI(file).spec
}

// workaround for big, chrome -> FILES/chrome and such. bug #818186
let resolve1 = function(id, requirer) {
    let ans = id[0] === "." ? resolve(id, requirer) : id
    return ans
}


/**
 *  tploader, which creates the environment *as seen by an experiment*
 *
 */
function tploader(pathforfiles,options){
	// for now, options is empty, but should get 'extra_modules','overridden_paths', etc

	pathforfiles = pathforfiles === undefined ?  uriFor('ProfD') : pathforfiles;

    /**
      * modules callable by the experiement
      *
      */
    let Mods = function(){
    	let passed_modules = {};
    	// must be explicit for cfx manifest to find and link them!
    	// https://addons.mozilla.org/en-US/developers/docs/sdk/latest/dev-guide/tutorials/chrome.html
    	//passed_modules["testpilot"] = testpilotpseudo  // TODO
		passed_modules["preferences-service"] = require("preferences-service")
		passed_modules["request"] = require("request")
		//passed_modules["selection"] = require("selection") // selection doesn't pass through correctly
		passed_modules["tabs"] = require("tabs")
		passed_modules["timers"] = require("timers")
		passed_modules['uuid'] = require("sdk/util/uuid");
		passed_modules["widget"] = require("widget")
		passed_modules["windows"] = require("windows")
		passed_modules["window/utils"] = require("window/utils")
		passed_modules["window-utils"] = require("window-utils")
		passed_modules["xul-app"] = require("xul-app")
		passed_modules["xpcom"] = require("xpcom")
		return passed_modules
    }

    let mods = Mods();
	let loader = Loader({
	    modules: mods,
	    globals:{
	    	ALLOWED: Object.keys(mods)
	    },
	    paths: {
	      "": "resource:///modules",
	      '/': 'file:///',
	      'jar':'jar',  // for rooted jar paths
	 	  'FILES/': pathforfiles
	    },
	    resolve: resolve1
	  })

	console.log(JSON.stringify(loader.mapping,null,2));

	// Override globals to make `console` available, from gozala/scratch-kit:core.js
  	let globals = require('sdk/system/globals');
	Object.defineProperties(loader.globals, descriptor(globals));

	return loader
}

exports.tploader = tploader


