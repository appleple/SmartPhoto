'use strict';

const coolPhoto = require('../index');
console.log(coolPhoto);

const applyJQuery = (jQuery) => {
	jQuery.fn.coolPhoto = function(settings) {
		return this.each(function () {
			if (typeof settings === 'strings'){
				if (settings === 'destroy'){
				}
			} else {
				new coolPhoto(this,settings);
			}
		});
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
