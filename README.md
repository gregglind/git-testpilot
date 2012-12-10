Test Pilot (Restartless)
==========================

This is a Work-in-Progress (WIP) branch of the Test Pilot Code Base.

Goals:
* jetpack  (done!)
* restartless  (done!)
* easier study debugging
* clearer semantics.

TBD:
* get all ui working right.
  - menus
  - debug page
  - feedback button
* showNotification still needs a lot of work / refactoring / finishing
* testing!


Debug Several Local Experiments
---------------------------------

Several sharp edges.

1.  inside experiments, use:

    if (typeof Cc == "undefined") {
	  var {Cc,Ci,Cu} = require("chrome");
	}

2.  `console` is still undefined.  Use `dump`
3.  "real" Test Pilot has a different modules list.

	a.  `require('preferences-service')`, `timers` work in both

4.  Use `require('./study_base_classes')` for maximal portability between 1.2, 1.3
5.  Use the 'local' form `require('./neighbor')` for any files in the same jar.
6.  `experiments` will check that requirements are met, and log about it, but actually doesn't care.
7.  After you get it right, DO AN ACTUAL INDEX.JSON test.


There are several Jar Files in `testcases` that simulate survey / experiments.

To call each (edit for full-path-iness, SORRY!):

    rm -rf prof && cfx run --profiledir prof --static-args '{
    	"debugprefs": true,
    	"debugpages":true,
        "local":true,
        "experiments": [
        	"jar:file:///Users/glind/gits/git-testpilot/extension/testcases/heatmap15/heatmap15.jar!/heatmap15.js",
        	"file:///Users/glind/gits/git-testpilot/extension/testcases/survey1/survey1.js"
        ] }' 2>&1 | less -S


The 'experiments' argument completely ignores any `index.json` / remote loading activity

Experiments it understands:

* rooted jar path to 'main'

  `jar:file:///Users/glind/gits/git-testpilot/extension/testcases/heatmap15/heatmap15.jar!/heatmap15.js`

* rooted file path to 'main'

  `file:///Users/glind/gits/git-testpilot/extension/testcases/survey1/survey1.js`

* rooted file path (transforms to fie)

  `/Users/glind/gits/git-testpilot/extension/testcases/survey1/survey1.js`


If you need to re-jar:

 	(cd testcases/heatmap15/ && jar -cf heatmap15.jar * )  # grouped so cd doesn't pollute.


