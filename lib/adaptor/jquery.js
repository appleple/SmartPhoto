'use strict';

var smartPhoto = require('../index');

var applyJQuery = function applyJQuery(jQuery) {
  jQuery.fn.smartPhoto = function (settings) {
    if (typeof settings === 'strings') {} else {
      new smartPhoto(this.selector, settings);
    }
    return this;
  };
};

if (typeof define === 'function' && define.amd) {
  define(['jquery'], applyJQuery);
} else {
  var jq = window.jQuery ? window.jQuery : window.$;
  if (typeof jq !== 'undefined') {
    applyJQuery(jq);
  }
}

module.exports = applyJQuery;