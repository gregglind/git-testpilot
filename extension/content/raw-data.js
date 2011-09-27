
function showDbContentsHtml() {
  Components.utils.import("resource://testpilot/modules/setup.js");
  var experimentId = getUrlParam("eid");
  var experiment = TestPilotSetup.getTaskById(experimentId);
  var dataStore = experiment.dataStore;
  var table = document.getElementById("raw-data-table");
  var columnNames = dataStore.getHumanReadableColumnNames();
  var propertyNames = dataStore.getPropertyNames();

  // TODO l10n
  var stringBundle =
      Components.classes["@mozilla.org/intl/stringbundle;1"].
        getService(Components.interfaces.nsIStringBundleService).
	  createBundle("chrome://testpilot/locale/main.properties");

  var title = stringBundle.formatStringFromName(
	"testpilot.statusPage.rawDataTitle", [experiment.title], 1);

  $("title").html(title);

  var headerRow = $("#raw-data-header-row");

  var i, j;
  for (j = 0; j < columnNames.length; j++) {
    headerRow.append($("<th></th>").html(columnNames[j]));
  }

  dataStore.getAllDataAsJSON(true, function(rawData) {
    // Convert each object in the JSON into a row of the table.
    for (i = 0; i < rawData.length; i++) {
      var row = $("<tr></tr>");
      for (j = 0; j < columnNames.length; j++) {
        row.append($("<td></td>").html(rawData[i][propertyNames[j]]));
      }
      $("#raw-data-table").append(row);
    }
  });

}
