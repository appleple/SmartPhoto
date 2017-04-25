module.exports.isSmartPhone = () => {
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

module.exports.extend = deepExtend;

module.exports.triggerEvent = (el, eventName, options) => {
  let event;
  if (window.CustomEvent) {
    event = new CustomEvent(eventName, {cancelable:true});
  } else {
    event = document.createEvent('CustomEvent');
    event.initCustomEvent(eventName, false, false, options);
  }
  el.dispatchEvent(event);
}

module.exports.parseQuery = (query) => {    
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

module.exports.getViewPos = (element) => {
  return {
    left: element.getBoundingClientRect().left,
    top: element.getBoundingClientRect().top,
  }
}

module.exports.removeElement = (element) => {
  if(element && element.parentNode) {
    element.parentNode.removeChild(element);
  }
}

module.exports.append = (element,string) => {
  const parser = new DOMParser();
  const doc = parser.parseFromString(string, 'text/html');
  element.appendChild(doc.querySelector('body').childNodes[0]);
}

module.exports.addClass = (element,className) => {
  if (element.classList) {
    element.classList.add(className);
  } else {
    element.className += ` ${className}`;
  }
}

module.exports.removeClass = (element,className) => {
  if (element.classList) {
    element.classList.remove(className);
  } else {
    element.className = element.className.replace(new RegExp('(^|\\b)' + className.split(' ').join('|') + '(\\b|$)', 'gi'), ' ');
  }
}
