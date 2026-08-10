export const isSmartPhone = (): boolean => {
  const agent = navigator.userAgent;
  return (
    agent.indexOf("iPhone") > 0 ||
    agent.indexOf("iPad") > 0 ||
    agent.indexOf("ipod") > 0 ||
    agent.indexOf("Android") > 0
  );
};

function deepExtend(
  out: Record<string, unknown>,
  ...args: unknown[]
): Record<string, unknown> {
  out = out || {};

  for (let i = 0; i < args.length; i++) {
    const obj = args[i] as Record<string, unknown> | null | undefined;
    if (!obj) {
      continue;
    }

    for (const key in obj) {
      if (Object.hasOwn(obj, key)) {
        const value = obj[key];
        if (value && typeof value === "object") {
          out[key] = deepExtend(
            (out[key] as Record<string, unknown>) ?? {},
            value,
          );
        } else {
          out[key] = value;
        }
      }
    }
  }

  return out;
}

export const extend = deepExtend;

export const triggerEvent = (
  el: Element,
  eventName: string,
  options?: unknown,
): void => {
  let event: Event;
  if (window.CustomEvent) {
    event = new CustomEvent(eventName, { cancelable: true });
  } else {
    event = document.createEvent("CustomEvent");
    (event as CustomEvent).initCustomEvent(eventName, false, false, options);
  }
  el.dispatchEvent(event);
};

export const parseQuery = (query: string): Record<string, string> => {
  const data: Record<string, string> = {};
  for (const pair of query.split("&")) {
    // String.split() は常に長さ1以上の配列を返すため param[0] は必ず定義される
    const param = pair.split("=");
    const key = param[0] as string;
    const value = param.length > 1 ? param.slice(1).join("=") : key;
    data[key] = decodeURIComponent(value);
  }
  return data;
};

export const getViewPos = (element: Element): { left: number; top: number } => {
  return {
    left: element.getBoundingClientRect().left,
    top: element.getBoundingClientRect().top,
  };
};

export const removeElement = (element?: Element | null): void => {
  if (element?.parentNode) {
    element.parentNode.removeChild(element);
  }
};
