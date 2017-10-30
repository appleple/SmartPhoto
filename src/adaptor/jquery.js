'use strict';

const SmartPhoto = require('../index');

const applyJQuery = (jQuery) => {
  jQuery.fn.SmartPhoto = function(settings) {
    if (typeof settings === 'strings'){
    } else {
      new SmartPhoto(this, settings);
    }
    return this;
  }
}

if (typeof define === 'function' && define.amd) {
  define(['jquery'], applyJQuery);
} else {
  var jq = window.jQuery ? window.jQuery : window.$;
  if (typeof jq !== 'undefined') {
    applyJQuery(jq);
  }
}

module.exports = applyJQuery;
