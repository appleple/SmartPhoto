'use strict';

const coolPhoto = require('../index');

const applyJQuery = (jQuery) => {
	jQuery.fn.coolPhoto = function(settings) {
		if (typeof settings === 'strings'){
		} else {
			new coolPhoto(this.selector,settings);
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
