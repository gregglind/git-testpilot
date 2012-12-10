"use strict";

exports.surveyInfo = {
  surveyId: "survey1",
  surveyName: "survey1",
  surveyUrl: "http://some/where",
  summary: "An Example Survey",
  thumbnail: "https://testpilot.mozillalabs.com/testcases/pilot-survey-thumbnail.png",
  randomDeployment: {
    minRoll: 0,
    maxRoll: 100,
    rolloutCode: "survey1"
  }
};


console.log("inside:",exports.surveyInfo.surveyId);

