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

const parseRgb = (value: string): [number, number, number] | null => {
  const match = value.match(
    /rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*[\d.]+\s*)?\)/,
  );
  if (!match) {
    return null;
  }
  return [Number(match[1]), Number(match[2]), Number(match[3])];
};

// WCAG の相対輝度(sRGB)。閾値 0.179 は「白とのコントラスト比」と「黒との
// コントラスト比」が釣り合う輝度(sqrt(1.05 * 0.05) - 0.05 の近似値)で、
// 0.5 を使うより中間色(グレー等)でも人間の見た目に近い側へ倒れる
const CONTRAST_LUMINANCE_THRESHOLD = 0.179;

const relativeLuminance = ([r, g, b]: [number, number, number]): number => {
  const [rl, gl, bl] = [r, g, b].map((c) => {
    const v = c / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  });
  return (
    0.2126 * (rl as number) + 0.7152 * (gl as number) + 0.0722 * (bl as number)
  );
};

// 任意の CSS カラー表記(#hex/rgb()/named color 等)から、それを背景色とした
// ときにコントラストが高い方の文字色(#000/#fff)を返す。hex/named color は
// ブラウザの色解決に委ね(一時要素へ代入して getComputedStyle で rgb() へ
// 正規化)、rgb()/rgba() は正規表現で直接読み取る
export const getContrastColor = (colorValue: string): string => {
  const trimmed = colorValue.trim();
  let rgb = parseRgb(trimmed);
  if (!rgb) {
    const probe = document.createElement("div");
    probe.style.color = trimmed;
    if (!probe.style.color) {
      // 無効な値は代入が無視されて空文字のままになる(CSSOM の仕様)
      return "#fff";
    }
    document.body.appendChild(probe);
    rgb = parseRgb(getComputedStyle(probe).color);
    document.body.removeChild(probe);
  }
  if (!rgb) {
    return "#fff";
  }
  return relativeLuminance(rgb) > CONTRAST_LUMINANCE_THRESHOLD
    ? "#000"
    : "#fff";
};
