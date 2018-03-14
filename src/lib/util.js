export const isSmartPhone = () => {
  const agent = navigator.userAgent
  if (agent.indexOf('iPhone') > 0 || agent.indexOf('iPad') > 0
      || agent.indexOf('ipod') > 0 || agent.indexOf('Android') > 0) {
    return true
  } else {
    return false
  }
}

function deepExtend(out){
  out = out || {};

  for (var i = 1; i < arguments.length; i++) {
    var obj = arguments[i];
    if (!obj) {
      continue;
    }

    for (var key in obj) {
      if (obj.hasOwnProperty(key)) {
        if (typeof obj[key] === 'object')
          out[key] = deepExtend(out[key], obj[key]);
        else
          out[key] = obj[key];
      }
    }
  }

  return out;
};

export const extend = deepExtend;

export const triggerEvent = (el, eventName, options) => {
  let event;
  if (window.CustomEvent) {
    event = new CustomEvent(eventName, {cancelable:true});
  } else {
    event = document.createEvent('CustomEvent');
    event.initCustomEvent(eventName, false, false, options);
  }
  el.dispatchEvent(event);
}

export const parseQuery = (query) => {    
  var s = query.split('&'),
      data = {},
      i = 0,
      iz = s.length,
      param, key, value;
  for (; i < iz; i++) {
      param = s[i].split('=');
      if (param[0] !== void 0) {
          key = param[0];
          value = (param[1] !== void 0) ? param.slice(1).join('=') : key;
          data[key] = decodeURIComponent(value);
      }
  }
  return data;
}

export const getViewPos = (element) => {
  return {
    left: element.getBoundingClientRect().left,
    top: element.getBoundingClientRect().top,
  }
}

export const removeElement = (element) => {
  if(element && element.parentNode) {
    element.parentNode.removeChild(element);
  }
}

export const append = (element,　string) => {
  const div = document.createElement('div');
  div.innerHTML = string;
  while (div.children.length > 0) {
    element.appendChild(div.children[0]);
  }
}

export const addClass = (element,className) => {
  if (element.classList) {
    element.classList.add(className);
  } else {
    element.className += ` ${className}`;
  }
}

export const removeClass = (element,className) => {
  if (element.classList) {
    element.classList.remove(className);
  } else {
    element.className = element.className.replace(new RegExp('(^|\\b)' + className.split(' ').join('|') + '(\\b|$)', 'gi'), ' ');
  }
}

export const getBrowser = () => {
  const ua = window.navigator.userAgent.toLowerCase();
  const ver = window.navigator.appVersion.toLowerCase();
  let name = 'unknown';

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
}

export const isOldIE = () => {
  const browser = getBrowser();
  if (browser.indexOf('ie') !== -1) {
    if (parseInt(browser.replace(/[^0-9]/g, '')) <= 10 ) {
      return true;
    }
  }
  return false;
}