import { describe, expect, it } from "vitest";
import * as state from "../../src/core/state";

describe("state", () => {
  describe("createState", () => {
    it("既定値をオプションとして凍結して持つ", () => {
      const s = state.createState({});
      expect(s.options.arrows).toBe(true);
      expect(s.options.nav).toBe(true);
      expect(s.options.resizeStyle).toBe("fit");
      expect(s.options.useOrientationApi).toBe(false);
      expect(s.options.animationSpeed).toBe(450);
      expect(Object.isFrozen(s.options)).toBe(true);
      expect(Object.isFrozen(s.options.classNames)).toBe(true);
    });

    it("settings でデフォルトを上書きできる", () => {
      const s = state.createState({ arrows: false, animationSpeed: 800 });
      expect(s.options.arrows).toBe(false);
      expect(s.options.animationSpeed).toBe(800);
    });

    it("viewer の初期状態を持つ", () => {
      const s = state.createState({});
      expect(s.viewer.isOpen).toBe(false);
      expect(s.viewer.currentIndex).toBe(0);
      expect(s.viewer.scaleSize).toBe(1);
      expect(s.viewer.showPrevArrow).toBe(false);
      expect(s.viewer.showNextArrow).toBe(false);
    });

    it("groups は空の Map を持つ", () => {
      const s = state.createState({});
      expect(s.groups).toBeInstanceOf(Map);
      expect(s.groups.size).toBe(0);
    });
  });

  describe("itemFromElement", () => {
    const options = { lazyAttribute: "data-src" };

    it("href/img/data-* から Item を生成する", () => {
      const el = document.createElement("a");
      el.setAttribute("href", "/large.jpg");
      el.setAttribute("data-caption", "caption");
      el.setAttribute("data-group", "g1");
      el.setAttribute("data-id", "photo1");
      const img = document.createElement("img");
      img.setAttribute("src", "/thumb.jpg");
      img.setAttribute("alt", "alt text");
      el.appendChild(img);

      const item = state.itemFromElement(el, options, 2, 1000);

      expect(item.src).toBe("/large.jpg");
      expect(item.caption).toBe("caption");
      expect(item.alt).toBe("alt text");
      expect(item.groupId).toBe("g1");
      expect(item.id).toBe("photo1");
      expect(item.index).toBe(2);
      expect(item.translateX).toBe(2000);
      expect(item.loaded).toBe(false);
      expect(item.processed).toBe(false);
      expect(item.element).toBe(el);
    });

    it("data-group が無ければ nogroup になる", () => {
      const el = document.createElement("a");
      el.setAttribute("href", "/large.jpg");
      const item = state.itemFromElement(el, options, 0, 500);
      expect(item.groupId).toBe("nogroup");
    });

    it("data-id が無ければ index を使う", () => {
      const el = document.createElement("a");
      el.setAttribute("href", "/large.jpg");
      const item = state.itemFromElement(el, options, 3, 500);
      expect(item.id).toBe(3);
    });

    it("lazyAttribute があればそれを thumb に採用する", () => {
      const el = document.createElement("a");
      el.setAttribute("href", "/large.jpg");
      const img = document.createElement("img");
      img.setAttribute("data-src", "/lazy-thumb.jpg");
      el.appendChild(img);
      const item = state.itemFromElement(el, options, 0, 500);
      expect(item.thumb).toBe("/lazy-thumb.jpg");
    });

    it("lazyAttribute が無く currentSrc があればそれを thumb に採用する", () => {
      const el = document.createElement("a");
      el.setAttribute("href", "/large.jpg");
      const img = document.createElement("img");
      Object.defineProperty(img, "currentSrc", {
        value: "/current.jpg",
        configurable: true,
      });
      el.appendChild(img);
      const item = state.itemFromElement(el, options, 0, 500);
      expect(item.thumb).toBe("/current.jpg");
    });

    it("img が無ければ thumb は src と同じになる", () => {
      const el = document.createElement("a");
      el.setAttribute("href", "/large.jpg");
      const item = state.itemFromElement(el, options, 0, 500);
      expect(item.thumb).toBe("/large.jpg");
    });

    it("alt が無く data-caption があればそれを alt に使う", () => {
      const el = document.createElement("a");
      el.setAttribute("href", "/large.jpg");
      el.setAttribute("data-caption", "cap");
      const img = document.createElement("img");
      el.appendChild(img);
      const item = state.itemFromElement(el, options, 0, 500);
      expect(item.alt).toBe("cap");
    });

    it("alt も data-caption も無ければ src を alt に使う", () => {
      const el = document.createElement("a");
      el.setAttribute("href", "/large.jpg");
      const item = state.itemFromElement(el, options, 0, 500);
      expect(item.alt).toBe("/large.jpg");
    });

    it("href すら無い場合 alt は空文字になる", () => {
      const el = document.createElement("a");
      const item = state.itemFromElement(el, options, 0, 500);
      expect(item.alt).toBe("");
      expect(item.src).toBeNull();
    });
  });

  describe("itemFromSlide", () => {
    it("slide オブジェクトから Item を生成する", () => {
      const slide = {
        src: "/large.jpg",
        thumb: "/thumb.jpg",
        caption: "cap",
        id: "camel",
        group: "animals",
      };
      const item = state.itemFromSlide(slide, 1, 1000);
      expect(item.src).toBe("/large.jpg");
      expect(item.thumb).toBe("/thumb.jpg");
      expect(item.caption).toBe("cap");
      expect(item.id).toBe("camel");
      expect(item.groupId).toBe("animals");
      expect(item.index).toBe(1);
      expect(item.translateX).toBe(1000);
      expect(item.element).toBeNull();
    });

    it("thumb 省略時は src をフォールバックに使う", () => {
      const item = state.itemFromSlide({ src: "/large.jpg" }, 0, 500);
      expect(item.thumb).toBe("/large.jpg");
    });

    it("group 省略時は nogroup になる", () => {
      const item = state.itemFromSlide({ src: "/large.jpg" }, 0, 500);
      expect(item.groupId).toBe("nogroup");
    });

    it("id 省略時は index になる", () => {
      const item = state.itemFromSlide({ src: "/large.jpg" }, 5, 500);
      expect(item.id).toBe(5);
    });

    it("alt 省略時は caption→src の順にフォールバックする", () => {
      const withCaption = state.itemFromSlide(
        { src: "/large.jpg", caption: "cap" },
        0,
        500,
      );
      expect(withCaption.alt).toBe("cap");
      const withoutCaption = state.itemFromSlide({ src: "/large.jpg" }, 0, 500);
      expect(withoutCaption.alt).toBe("/large.jpg");
    });

    it("width/height 指定時は計測をスキップして loaded になる", () => {
      const item = state.itemFromSlide(
        { src: "/large.jpg", width: 1200, height: 800 },
        0,
        500,
      );
      expect(item.width).toBe(1200);
      expect(item.height).toBe(800);
      expect(item.loaded).toBe(true);
    });

    it("width/height 未指定時は loaded にならない", () => {
      const item = state.itemFromSlide({ src: "/large.jpg" }, 0, 500);
      expect(item.loaded).toBe(false);
    });
  });

  describe("addItemToGroup / currentItems / currentItem", () => {
    it("グループに Item を追加し currentGroup を更新する", () => {
      const s = state.createState({});
      const item1 = state.itemFromSlide({ src: "a.jpg", group: "g1" }, 0, 500);
      const item2 = state.itemFromSlide({ src: "b.jpg", group: "g1" }, 1, 500);
      state.addItemToGroup(s, item1);
      state.addItemToGroup(s, item2);
      expect(s.viewer.currentGroup).toBe("g1");
      expect(state.currentItems(s)).toHaveLength(2);
      expect(state.currentItem(s)).toBe(item1);
      s.viewer.currentIndex = 1;
      expect(state.currentItem(s)).toBe(item2);
    });

    it("最後に追加したアイテムのグループが currentGroup になる", () => {
      const s = state.createState({});
      state.addItemToGroup(
        s,
        state.itemFromSlide({ src: "a.jpg", group: "g1" }, 0, 500),
      );
      state.addItemToGroup(
        s,
        state.itemFromSlide({ src: "b.jpg", group: "g2" }, 0, 500),
      );
      expect(s.viewer.currentGroup).toBe("g2");
    });

    it("currentGroup が無い場合 currentItems は null を返す", () => {
      const s = state.createState({});
      expect(state.currentItems(s)).toBeNull();
      expect(state.currentItem(s)).toBeNull();
    });

    it("currentGroup があっても groups に存在しない場合は null を返す", () => {
      const s = state.createState({});
      s.viewer.currentGroup = "ghost";
      expect(state.currentItems(s)).toBeNull();
    });

    it("currentIndex が範囲外の場合 currentItem は null を返す", () => {
      const s = state.createState({});
      state.addItemToGroup(
        s,
        state.itemFromSlide({ src: "a.jpg", group: "g1" }, 0, 500),
      );
      s.viewer.currentIndex = 5;
      expect(state.currentItem(s)).toBeNull();
    });
  });

  describe("setArrow", () => {
    const buildState = (length, currentIndex) => {
      const s = state.createState({});
      for (let i = 0; i < length; i++) {
        state.addItemToGroup(
          s,
          state.itemFromSlide({ src: `${i}.jpg` }, i, 500),
        );
      }
      s.viewer.currentIndex = currentIndex;
      return s;
    };

    it("先頭では prev 矢印を表示しない", () => {
      const s = buildState(3, 0);
      state.setArrow(s);
      expect(s.viewer.showPrevArrow).toBe(false);
      expect(s.viewer.showNextArrow).toBe(true);
      expect(s.viewer.next).toBe(1);
    });

    it("末尾では next 矢印を表示しない", () => {
      const s = buildState(3, 2);
      state.setArrow(s);
      expect(s.viewer.showNextArrow).toBe(false);
      expect(s.viewer.showPrevArrow).toBe(true);
      expect(s.viewer.prev).toBe(1);
    });

    it("中間では両方の矢印を表示する", () => {
      const s = buildState(3, 1);
      state.setArrow(s);
      expect(s.viewer.showPrevArrow).toBe(true);
      expect(s.viewer.showNextArrow).toBe(true);
    });

    it("currentItems が無い場合は何もしない", () => {
      const s = state.createState({});
      expect(() => state.setArrow(s)).not.toThrow();
    });
  });

  describe("resetTranslate", () => {
    it("index * winWidth で translateX を再計算する", () => {
      const items = [{ translateX: 0 }, { translateX: 0 }, { translateX: 0 }];
      items.forEach((item, index) => {
        item.index = index;
      });
      state.resetTranslate(items, 400);
      expect(items.map((i) => i.translateX)).toEqual([0, 400, 800]);
    });
  });

  describe("scaleBorder", () => {
    it("PC では 1 / item.scale を返す", () => {
      const item = { scale: 0.5, width: 100, height: 100 };
      expect(state.scaleBorder(item, 1000, 800, false)).toBe(2);
    });

    it("スマホで横長画像は windowHeight 基準", () => {
      const item = { scale: 1, width: 200, height: 100 };
      expect(state.scaleBorder(item, 1000, 800, true)).toBe(8);
    });

    it("スマホで縦長画像は windowWidth 基準", () => {
      const item = { scale: 1, width: 100, height: 200 };
      expect(state.scaleBorder(item, 1000, 800, true)).toBe(10);
    });
  });

  describe("makeBound", () => {
    it("画像が画面より小さい場合の境界を計算する", () => {
      const item = { width: 100, height: 100, scale: 1 };
      const viewer = { scaleSize: 1 };
      const bound = state.makeBound(item, viewer, 1000, 800);
      expect(bound.maxX).toBe(450);
      expect(bound.minX).toBe(-450);
      expect(bound.maxY).toBe(350);
      expect(bound.minY).toBe(-350);
    });

    it("画像が画面より大きい場合の境界を計算する", () => {
      const item = { width: 2000, height: 2000, scale: 1 };
      const viewer = { scaleSize: 1 };
      const bound = state.makeBound(item, viewer, 1000, 800);
      expect(bound.maxX).toBe(500);
      expect(bound.maxY).toBe(600);
    });

    it("scaleSize を反映する", () => {
      const item = { width: 100, height: 100, scale: 1 };
      const viewer = { scaleSize: 2 };
      const bound = state.makeBound(item, viewer, 1000, 800);
      expect(bound.maxX).toBe(800);
    });
  });

  describe("sizeItems", () => {
    it("未ロードのアイテムはスキップする", () => {
      const items = [{ loaded: false, processed: false }];
      state.sizeItems(items, 1000, 800, 60, 60);
      expect(items[0].processed).toBe(false);
    });

    it("画面より小さい画像は scale=1 で中央配置する", () => {
      const items = [
        { loaded: true, width: 200, height: 200, processed: false },
      ];
      state.sizeItems(items, 1000, 800, 60, 60);
      const item = items[0];
      expect(item.processed).toBe(true);
      expect(item.scale).toBe(1);
      expect(item.x).toBe(400);
      expect(item.y).toBe(300);
    });

    it("画面より大きい画像は screenY 基準で縮小する", () => {
      const items = [
        { loaded: true, width: 400, height: 2000, processed: false },
      ];
      state.sizeItems(items, 1000, 800, 60, 60);
      const item = items[0];
      expect(item.scale).toBeCloseTo(680 / 2000, 5);
    });

    it("縮小後も幅が画面を超える場合は幅基準で再縮小する", () => {
      const items = [
        { loaded: true, width: 3000, height: 700, processed: false },
      ];
      state.sizeItems(items, 1000, 800, 60, 60);
      const item = items[0];
      expect(item.scale).toBeCloseTo(1000 / 3000, 5);
      expect(item.x).toBeCloseTo(((1000 / 3000 - 1) / 2) * 3000, 5);
    });
  });

  describe("buildHash / findItemByHash", () => {
    it("現在のアイテムから group=…&photo=… を組み立てる", () => {
      const s = state.createState({});
      state.addItemToGroup(
        s,
        state.itemFromSlide({ src: "a.jpg", group: "g1", id: "camel" }, 0, 500),
      );
      expect(state.buildHash(s)).toBe("group=g1&photo=camel");
    });

    it("currentItem が無ければ空文字を返す", () => {
      const s = state.createState({});
      expect(state.buildHash(s)).toBe("");
    });

    it("group/photo が一致する Item を探す", () => {
      const s = state.createState({});
      const item = state.itemFromSlide(
        { src: "a.jpg", group: "g1", id: "camel" },
        0,
        500,
      );
      state.addItemToGroup(s, item);
      const found = state.findItemByHash(s, { group: "g1", photo: "camel" });
      expect(found).toBe(item);
    });

    it("一致しない場合は null を返す", () => {
      const s = state.createState({});
      state.addItemToGroup(
        s,
        state.itemFromSlide({ src: "a.jpg", group: "g1", id: "camel" }, 0, 500),
      );
      expect(
        state.findItemByHash(s, { group: "g1", photo: "lion" }),
      ).toBeNull();
    });
  });
});
