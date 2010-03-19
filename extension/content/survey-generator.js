const MULTIPLE_CHOICE = 0;
const CHECK_BOXES_WITH_FREE_ENTRY = 1;
const SCALE = 2;
const FREE_ENTRY = 3;
const CHECK_BOXES = 4;
const MULTIPLE_CHOICE_WITH_FREE_ENTRY = 5;

function onBuiltinSurveyLoad() {
  Components.utils.import("resource://testpilot/modules/setup.js");
  Components.utils.import("resource://testpilot/modules/tasks.js");
  let eid = getUrlParam("eid");
  let task = TestPilotSetup.getTaskById(eid);
  let contentDiv = document.getElementById("survey-contents");
  if (!task) {
    // Tasks haven't all loaded yet.  Try again in a few seconds.
    contentDiv.innerHTML = "Loading, please wait a moment...";
     window.setTimeout(function() { onBuiltinSurveyLoad(); }, 2000);
    return;
  } else {
    contentDiv.innerHTML = "";
  }

  let title = document.getElementById("survey-title");
  title.innerHTML = task.title;
  let explanation = document.getElementById("survey-explanation");
  if (task.surveyExplanation) {
    explanation.innerHTML = task.surveyExplanation;
  }

  if (task.status == TaskConstants.STATUS_SUBMITTED) {
    contentDiv.innerHTML = "<p>Thank you for finishing this survey. Your " +
    "answers will be uploaded along with the next set of experimental data.</p>" +
    "<p>If you would like to review or change your answers, you can do so at " +
    "any time using the button below.</p>";
    let submitButton = document.getElementById("survey-submit");
    submitButton.setAttribute("style", "display:none");
    let changeButton = document.getElementById("change-answers");
    changeButton.setAttribute("style", "");
  } else {
    drawSurveyForm(task, contentDiv);
  }
}

function drawSurveyForm(task, contentDiv) {
  let oldAnswers = task.oldAnswers;
  let surveyQuestions = task.surveyQuestions;

  let submitButton = document.getElementById("survey-submit");
  submitButton.setAttribute("style", "");
  let changeButton = document.getElementById("change-answers");
  changeButton.setAttribute("style", "display:none");
  // Loop through questions and render html form input elements for each
  // one.
  for (let i = 0; i < surveyQuestions.length; i++) {
    let question = surveyQuestions[i].question;
    let explanation = surveyQuestions[i].explanation;
    let elem;

    elem = document.createElement("h3");
    elem.innerHTML = (i+1) + ". " + question;
    contentDiv.appendChild(elem);
    if (explanation) {
      elem = document.createElement("p");
      elem.setAttribute("class", "survey-question-explanation")
      elem.innerHTML = explanation;
      contentDiv.appendChild(elem);
    }
    // If you've done this survey before, preset all inputs using old answers
    let j;
    let choices = surveyQuestions[i].choices;
    switch (surveyQuestions[i].type) {
    case MULTIPLE_CHOICE:
      for (j = 0; j < choices.length; j++) {
        let newRadio = document.createElement("input");
        newRadio.setAttribute("type", "radio");
        newRadio.setAttribute("name", "answer_to_" + i);
        newRadio.setAttribute("value", j);
        if (oldAnswers && oldAnswers[i] == String(j)) {
          newRadio.setAttribute("checked", "true");
        }
        let label = document.createElement("span");
        label.innerHTML = choices[j];
        contentDiv.appendChild(newRadio);
        contentDiv.appendChild(label);
        contentDiv.appendChild(document.createElement("br"));
      }
      break;
    case CHECK_BOXES_WITH_FREE_ENTRY:
      // Check boxes:
      for (j = 0; j < choices.length; j++) {
        let newCheck = document.createElement("input");
        newCheck.setAttribute("type", "checkbox");
        newCheck.setAttribute("name", "answer_to_" + i);
        newCheck.setAttribute("value", j);
        if (oldAnswers && oldAnswers[i]) {
          for each (let an in oldAnswers[i]) {
            if (an == String(j)) {
              newCheck.setAttribute("checked", "true");
            }
          }
        }
        let label = document.createElement("span");
        label.innerHTML = choices[j];
        contentDiv.appendChild(newCheck);
        contentDiv.appendChild(label);
        contentDiv.appendChild(document.createElement("br"));
      }
      // Text area:
      if (surveyQuestions[i].free_entry) {
        let label = document.createElement("span");
        label.innerHTML = surveyQuestions[i].free_entry + "&nbsp";
        contentDiv.appendChild(label);
        let inputBox = document.createElement("textarea");
        inputBox.setAttribute("id", "freeform_" + i);
        contentDiv.appendChild(inputBox);
        if (oldAnswers && oldAnswers[i]) {
          for each (let an in oldAnswers[i]) {
            if (isNaN(parseInt(an))) {
              inputBox.value = an;
              break;
            }
          }
        }
      }
      break;
    case SCALE:
      let label = document.createElement("span");
      label.innerHTML = surveyQuestions[i].min_label;
      contentDiv.appendChild(label);
      for (j = surveyQuestions[i].scale_minimum;
           j <= surveyQuestions[i].scale_maximum;
           j++) {
        let newRadio = document.createElement("input");
        newRadio.setAttribute("type", "radio");
        newRadio.setAttribute("name", "answer_to_" + i);
        newRadio.setAttribute("value", j);
        if (oldAnswers && oldAnswers[i] == String(j)) {
          newRadio.setAttribute("checked", "true");
        }
        contentDiv.appendChild(newRadio);
      }
      label = document.createElement("span");
      label.innerHTML = surveyQuestions[i].max_label;
      contentDiv.appendChild(label);
      break;
    case FREE_ENTRY:
      // TODO LATER - kind of redundant since it's just the
      // check-box-plus-free-entry case with zero check boxes.
      break;
    case CHECK_BOXES:
      // TODO LATER - kind of redundant since it's just the
      // check-box-plus-free-entry case without the free entry.
      break;
    case MULTIPLE_CHOICE_WITH_FREE_ENTRY:
      let checked = false;
      let freeformId = "freeform_" + i;

      for (j = 0; j < choices.length; j++) {
        let newRadio = document.createElement("input");
        newRadio.setAttribute("type", "radio");
        newRadio.setAttribute("name", "answer_to_" + i);
        newRadio.setAttribute("value", j);
        newRadio.addEventListener(
          "click", function() {
            let inputBox = document.getElementById(freeformId);
            if (inputBox) {
              inputBox.value = "";
            }
          }, false);
        let label = document.createElement("span");
        label.innerHTML = choices[j];
        if (oldAnswers && oldAnswers[i] == String(j)) {
          newRadio.setAttribute("checked", "true");
          checked = true;
        }
        contentDiv.appendChild(newRadio);
        contentDiv.appendChild(label);
        contentDiv.appendChild(document.createElement("br"));
      }

      // Text area:
      if (surveyQuestions[i].free_entry) {
        let radioName = "answer_to_" + i;
        let newRadio = document.createElement("input");
        newRadio.setAttribute("type", "radio");
        newRadio.setAttribute("name", radioName);
        newRadio.setAttribute("value", freeformId);
        let label = document.createElement("span");
        label.innerHTML = surveyQuestions[i].free_entry + "&nbsp:&nbsp";
        let inputBox = document.createElement("input");
        inputBox.setAttribute("type", "text");
        inputBox.setAttribute("id", freeformId);
        inputBox.addEventListener(
          "keypress", function() {
            let elements = document.getElementsByName(radioName);
            for (let k = 0; k < elements.length; k++) {
              if (elements[k].value == freeformId) {
                elements[k].checked = true;
              } else {
                elements[k].checked = false;
              }
            }
          }, false);
       if (oldAnswers && oldAnswers[i] && (oldAnswers[i].length > 0) &&
            !checked) {
          newRadio.setAttribute("checked", "true");
          inputBox.value = oldAnswers[i];
        }
        contentDiv.appendChild(newRadio);
        contentDiv.appendChild(label);
        contentDiv.appendChild(inputBox);
      }
      break;
    }
  }
}

function onBuiltinSurveySubmit() {
  dump("Submitting survey...\n");
  Components.utils.import("resource://testpilot/modules/setup.js");
  let eid = getUrlParam("eid");
  let task = TestPilotSetup.getTaskById(eid);

  // Read all values from form...
  let answers = [];
  let surveyQuestions = task.surveyQuestions;
  let i;
  for (i = 0; i < surveyQuestions.length; i++) {
    let elems = document.getElementsByName("answer_to_" + i);
    let anAnswer = [];
    for each (let elem in elems) {
      if (elem.checked && elem.value != ("freeform_" + i)) {
        anAnswer.push(elem.value);
      }
    }
    let freeEntry = document.getElementById("freeform_" + i);
    if (freeEntry && freeEntry.value) {
      anAnswer.push(freeEntry.value);
    }
    answers.push(anAnswer);
  }
  dump("Answers is " + answers + "\n");
  dump("Answers as json is " + JSON.stringify(answers) + "\n");
  task.store(answers);
  // Reload page to show submitted status:
  onBuiltinSurveyLoad();
}

function onBuiltinSurveyChangeAnswers() {
  let eid = getUrlParam("eid");
  let task = TestPilotSetup.getTaskById(eid);
  let contentDiv = document.getElementById("survey-contents");

  drawSurveyForm(task, contentDiv);
}
