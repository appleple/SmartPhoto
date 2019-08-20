"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.isOldIE = exports.getBrowser = exports.removeClass = exports.addClass = exports.append = exports.removeElement = exports.getViewPos = exports.parseQuery = exports.triggerEvent = exports.extend = exports.isSmartPhone = void 0;

function _typeof(obj) { if (typeof Symbol === "function" && typeof Symbol.iterator === "symbol") { _typeof = function _typeof(obj) { return typeof obj; }; } else { _typeof = function _typeof(obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; }; } return _typeof(obj); }

var isSmartPhone = function isSmartPhone() {
  var agent = navigator.userAgent;

  if (agent.indexOf('iPhone') > 0 || agent.indexOf('iPad') > 0 || agent.indexOf('ipod') > 0 || agent.indexOf('Android') > 0) {
    return true;
  } else {
    return false;
  }
};

exports.isSmartPhone = isSmartPhone;

function deepExtend(out) {
  out = out || {};

  for (var i = 1; i < arguments.length; i++) {
    var obj = arguments[i];

    if (!obj) {
      continue;
    }

    for (var key in obj) {
      if (obj.hasOwnProperty(key)) {
        if (_typeof(obj[key]) === 'object') out[key] = deepExtend(out[key], obj[key]);else out[key] = obj[key];
      }
    }
  }

  return out;
}

;
var extend = deepExtend;
exports.extend = extend;

var triggerEvent = function triggerEvent(el, eventName, options) {
  var event;

  if (window.CustomEvent) {
    event = new CustomEvent(eventName, {
      cancelable: true
    });
  } else {
    event = document.createEvent('CustomEvent');
    event.initCustomEvent(eventName, false, false, options);
  }

  el.dispatchEvent(event);
};

exports.triggerEvent = triggerEvent;

var parseQuery = function parseQuery(query) {
  var s = query.split('&'),
      data = {},
      i = 0,
      iz = s.length,
      param,
      key,
      value;

  for (; i < iz; i++) {
    param = s[i].split('=');

    if (param[0] !== void 0) {
      key = param[0];
      value = param[1] !== void 0 ? param.slice(1).join('=') : key;
      data[key] = decodeURIComponent(value);
    }
  }

  return data;
};

exports.parseQuery = parseQuery;

var getViewPos = function getViewPos(element) {
  return {
    left: element.getBoundingClientRect().left,
    top: element.getBoundingClientRect().top
  };
};

exports.getViewPos = getViewPos;

var removeElement = function removeElement(element) {
  if (element && element.parentNode) {
    element.parentNode.removeChild(element);
  }
};

exports.removeElement = removeElement;

var append = function append(element, string) {
  var div = document.createElement('div');
  div.innerHTML = string;

  while (div.children.length > 0) {
    element.appendChild(div.children[0]);
  }
};

exports.append = append;

var addClass = function addClass(element, className) {
  if (element.classList) {
    element.classList.add(className);
  } else {
    element.className += " ".concat(className);
  }
};

exports.addClass = addClass;

var removeClass = function removeClass(element, className) {
  if (element.classList) {
    element.classList.remove(className);
  } else {
    element.className = element.className.replace(new RegExp('(^|\\b)' + className.split(' ').join('|') + '(\\b|$)', 'gi'), ' ');
  }
};

exports.removeClass = removeClass;

var getBrowser = function getBrowser() {
  var ua = window.navigator.userAgent.toLowerCase();
  var ver = window.navigator.appVersion.toLowerCase();
  var name = 'unknown';

  if (ua.indexOf('msie') != -1) {
    if (ver.indexOf('msie 6.') != -1) {
      name = 'ie6';
    } else if (ver.indexOf('msie 7.') != -1) {
      name = 'ie7';
    } else if (ver.indexOf('msie 8.') != -1) {
      name = 'ie8';
    } else if (ver.indexOf('msie 9.') != -1) {
      name = 'ie9';
    } else if (ver.indexOf('msie 10.') != -1) {
      name = 'ie10';
    } else {
      name = 'ie';
    }
  } else if (ua.indexOf('trident/7') != -1) {
    name = 'ie11';
  } else if (ua.indexOf('chrome') != -1) {
    name = 'chrome';
  } else if (ua.indexOf('safari') != -1) {
    name = 'safari';
  } else if (ua.indexOf('opera') != -1) {
    name = 'opera';
  } else if (ua.indexOf('firefox') != -1) {
    name = 'firefox';
  }

  return name;
};

exports.getBrowser = getBrowser;

var isOldIE = function isOldIE() {
  var browser = getBrowser();

  if (browser.indexOf('ie') !== -1) {
    if (parseInt(browser.replace(/[^0-9]/g, '')) <= 10) {
      return true;
    }
  }

  return false;
};

exports.isOldIE = isOldIE;