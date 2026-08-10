import SmartPhoto from "../index";

// biome-ignore lint/suspicious/noExplicitAny: jQuery 自体の型を持ち込まないための最小限の any
type JQueryLike = { fn: Record<string, any> };

const applyJQuery = (jQuery: JQueryLike): void => {
  // biome-ignore lint/suspicious/noExplicitAny: jQuery 自体の型を持ち込まないための最小限の any
  jQuery.fn.SmartPhoto = function (this: any, settings?: any) {
    if (typeof settings === "string") {
      // 将来のメソッド呼び出し用に予約(現状は何もしない)
    } else {
      new SmartPhoto(this, settings);
    }
    return this;
  };
};

declare const define:
  | (((deps: string[], factory: (jQuery: JQueryLike) => void) => void) & {
      amd?: boolean;
    })
  | undefined;

if (typeof define === "function" && define.amd) {
  define(["jquery"], applyJQuery);
} else {
  const win = window as unknown as { jQuery?: JQueryLike; $?: JQueryLike };
  const jq = win.jQuery ? win.jQuery : win.$;
  if (typeof jq !== "undefined") {
    applyJQuery(jq);
  }
}

export default applyJQuery;
