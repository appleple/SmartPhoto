const SmartPhoto = require("../index");

let jq;

const applyJQuery = (jQuery) => {
  jQuery.fn.SmartPhoto = function (settings) {
    if (typeof settings === "string") {
    } else {
      new SmartPhoto(this, settings);
    }
    return this;
  };
};

if (typeof define === "function" && define.amd) {
  define(["jquery"], applyJQuery);
} else {
  jq = window.jQuery ? window.jQuery : window.$;
  if (typeof jq !== "undefined") {
    applyJQuery(jq);
  }
}

module.exports = applyJQuery;
