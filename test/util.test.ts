import { afterEach, describe, expect, it } from "vitest";
import * as util from "../src/lib/util";

const stubUserAgent = (value: string) => {
  Object.defineProperty(window.navigator, "userAgent", {
    value,
    configurable: true,
  });
};

describe("util", () => {
  const originalUserAgent = window.navigator.userAgent;

  afterEach(() => {
    stubUserAgent(originalUserAgent);
  });

  describe("isSmartPhone", () => {
    it.each([
      ["iPhone", "Mozilla/5.0 (iPhone; CPU iPhone OS 15_0)"],
      ["iPad", "Mozilla/5.0 (iPad; CPU OS 15_0)"],
      ["ipod", "Mozilla/5.0 (ipod; CPU iPhone OS 15_0)"],
      ["Android", "Mozilla/5.0 (Linux; Android 12)"],
    ])("%s を含む User-Agent では true を返す", (_label, ua) => {
      stubUserAgent(ua);
      expect(util.isSmartPhone()).toBe(true);
    });

    it("スマートフォン系の文字列を含まない User-Agent では false を返す", () => {
      stubUserAgent("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15)");
      expect(util.isSmartPhone()).toBe(false);
    });
  });

  describe("extend", () => {
    it("複数オブジェクトを再帰的にマージする", () => {
      const result = util.extend(
        {},
        { a: 1, nested: { x: 1 } },
        { b: 2, nested: { y: 2 } },
      );
      expect(result).toEqual({ a: 1, b: 2, nested: { x: 1, y: 2 } });
    });

    it("falsy な引数はスキップする", () => {
      const result = util.extend({}, null, undefined, { a: 1 });
      expect(result).toEqual({ a: 1 });
    });

    it("out が未指定でも空オブジェクトとして扱う", () => {
      const result = util.extend(undefined, { a: 1 });
      expect(result).toEqual({ a: 1 });
    });

    it("継承された(自身のプロパティでない)列挙可能プロパティは取り込まない", () => {
      const proto = { inherited: "should-not-be-copied" };
      const source = Object.create(proto);
      source.own = "copied";
      const result = util.extend({}, source);
      expect(result).toEqual({ own: "copied" });
      expect((result as { inherited?: string }).inherited).toBeUndefined();
    });
  });

  describe("triggerEvent", () => {
    it("window.CustomEvent がある場合はそれでイベントを発火する", () => {
      const el = document.createElement("div");
      let received: Event | undefined;
      el.addEventListener("myevent", (e) => {
        received = e;
      });
      util.triggerEvent(el, "myevent");
      expect(received).toBeInstanceOf(CustomEvent);
    });

    it("window.CustomEvent が無い場合は document.createEvent にフォールバックする", () => {
      const originalCustomEvent = window.CustomEvent;
      // @ts-expect-error テスト用に一時的に削除する
      delete window.CustomEvent;
      try {
        const el = document.createElement("div");
        let received: Event | undefined;
        el.addEventListener("myevent", (e) => {
          received = e;
        });
        util.triggerEvent(el, "myevent", { detail: 1 });
        expect(received).toBeTruthy();
        expect(received?.type).toBe("myevent");
      } finally {
        window.CustomEvent = originalCustomEvent;
      }
    });
  });

  describe("parseQuery", () => {
    it("key=value の並びをオブジェクトへ変換する", () => {
      expect(util.parseQuery("group=test&photo=1")).toEqual({
        group: "test",
        photo: "1",
      });
    });

    it("値に = が含まれる場合は残り全体を値として結合する", () => {
      expect(util.parseQuery("data=a=b=c")).toEqual({ data: "a=b=c" });
    });

    it("= を含まない単独の key はキーと値の両方に同じ文字列を使う", () => {
      expect(util.parseQuery("standalone")).toEqual({
        standalone: "standalone",
      });
    });

    it("URL エンコードされた値をデコードする", () => {
      expect(
        util.parseQuery("caption=%E3%83%A9%E3%82%A4%E3%82%AA%E3%83%B3"),
      ).toEqual({
        caption: "ライオン",
      });
    });
  });

  describe("getViewPos", () => {
    it("要素の位置情報を left/top で返す", () => {
      const el = document.createElement("div");
      el.getBoundingClientRect = () => ({ left: 10, top: 20 }) as DOMRect;
      expect(util.getViewPos(el)).toEqual({ left: 10, top: 20 });
    });
  });

  describe("removeElement", () => {
    it("親要素があれば DOM から取り除く", () => {
      const parent = document.createElement("div");
      const child = document.createElement("span");
      parent.appendChild(child);
      util.removeElement(child);
      expect(parent.children.length).toBe(0);
    });

    it("親要素が無い場合は何もしない (例外を投げない)", () => {
      const el = document.createElement("div");
      expect(() => util.removeElement(el)).not.toThrow();
    });

    it("要素自体が null/undefined でも例外を投げない", () => {
      expect(() => util.removeElement(null)).not.toThrow();
      expect(() => util.removeElement(undefined)).not.toThrow();
    });
  });
});
