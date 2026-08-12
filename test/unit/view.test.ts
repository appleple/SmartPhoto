import { afterEach, describe, expect, it, vi } from "vitest";
import {
  addItemToGroup,
  createState,
  itemFromSlide,
  setArrow,
  sizeItems,
} from "../../src/core/state";
import { createView } from "../../src/core/view";

const buildHarness = (settings = {}) => {
  const state = createState(settings);
  const controller = new AbortController();
  const view = createView(
    { id: "T1", options: state.options },
    {
      onDismiss: vi.fn(),
      onPrev: vi.fn(),
      onNext: vi.fn(),
      onNavigate: vi.fn(),
      onBackdropClick: vi.fn(),
    },
    { signal: controller.signal },
  );
  document.body.appendChild(view.root);
  return { state, view, controller, handlers: view };
};

const addSlides = (state, slides) => {
  slides.forEach((slide, index) => {
    addItemToGroup(state, itemFromSlide(slide, index, 500));
  });
  state.viewer.total = slides.length;
};

describe("view", () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });

  describe("createView", () => {
    it("dialog を含む静的な骨格を構築する", () => {
      const { view, state } = buildHarness();
      expect(view.refs.dialog.tagName).toBe("DIALOG");
      expect(view.refs.dialog.className).toBe(
        state.options.classNames.smartPhoto,
      );
      expect(view.refs.dialog.getAttribute("aria-labelledby")).toBe(
        "smartphoto-T1-title",
      );
      expect(view.refs.caption.id).toBe("smartphoto-T1-title");
      expect(
        view.refs.dialog.style.getPropertyValue("--smartphoto-animation-speed"),
      ).toBe("450ms");
    });

    it("arrows/nav が有効なら構築する", () => {
      const { view } = buildHarness();
      expect(view.refs.arrows).not.toBeNull();
      expect(view.refs.nav).not.toBeNull();
    });

    it("arrows: false のとき矢印を構築しない", () => {
      const { view } = buildHarness({ arrows: false });
      expect(view.refs.arrows).toBeNull();
      expect(view.refs.arrowLeft).toBeNull();
      expect(view.refs.arrowRight).toBeNull();
    });

    it("nav: false のときナビを構築しない", () => {
      const { view } = buildHarness({ nav: false });
      expect(view.refs.nav).toBeNull();
      expect(view.refs.navList).toBeNull();
    });

    it("dismiss ボタンをクリックすると onDismiss が呼ばれる", () => {
      const { view } = buildHarness();
      view.refs.dismiss.click();
      expect(view).toBeDefined();
    });
  });

  describe("イベントハンドラ", () => {
    it("dismiss クリックで onDismiss を呼ぶ", () => {
      const onDismiss = vi.fn();
      const state = createState({});
      const view = createView(
        { id: "T2", options: state.options },
        {
          onDismiss,
          onPrev: vi.fn(),
          onNext: vi.fn(),
          onNavigate: vi.fn(),
          onBackdropClick: vi.fn(),
        },
        { signal: new AbortController().signal },
      );
      view.refs.dismiss.dispatchEvent(
        new MouseEvent("click", { bubbles: true }),
      );
      expect(onDismiss).toHaveBeenCalledTimes(1);
    });

    it("矢印クリックで onPrev/onNext を呼ぶ", () => {
      const onPrev = vi.fn();
      const onNext = vi.fn();
      const state = createState({});
      const view = createView(
        { id: "T3", options: state.options },
        {
          onDismiss: vi.fn(),
          onPrev,
          onNext,
          onNavigate: vi.fn(),
          onBackdropClick: vi.fn(),
        },
        { signal: new AbortController().signal },
      );
      view.refs.arrowLeft
        ?.querySelector("button")
        ?.dispatchEvent(
          new MouseEvent("click", { bubbles: true, cancelable: true }),
        );
      view.refs.arrowRight
        ?.querySelector("button")
        ?.dispatchEvent(
          new MouseEvent("click", { bubbles: true, cancelable: true }),
        );
      expect(onPrev).toHaveBeenCalledTimes(1);
      expect(onNext).toHaveBeenCalledTimes(1);
    });

    it("背景(content)自体のクリックで onBackdropClick を呼ぶ", () => {
      const onBackdropClick = vi.fn();
      const state = createState({});
      const view = createView(
        { id: "T4", options: state.options },
        {
          onDismiss: vi.fn(),
          onPrev: vi.fn(),
          onNext: vi.fn(),
          onNavigate: vi.fn(),
          onBackdropClick,
        },
        { signal: new AbortController().signal },
      );
      view.refs.content.dispatchEvent(
        new MouseEvent("click", { bubbles: true }),
      );
      expect(onBackdropClick).toHaveBeenCalledTimes(1);
    });

    it("content の子要素をクリックしても onBackdropClick は呼ばれない", () => {
      const onBackdropClick = vi.fn();
      const state = createState({});
      addSlides(state, [{ src: "a.jpg" }]);
      const view = createView(
        { id: "T5", options: state.options },
        {
          onDismiss: vi.fn(),
          onPrev: vi.fn(),
          onNext: vi.fn(),
          onNavigate: vi.fn(),
          onBackdropClick,
        },
        { signal: new AbortController().signal },
      );
      const child = document.createElement("span");
      view.refs.content.appendChild(child);
      child.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      expect(onBackdropClick).not.toHaveBeenCalled();
    });

    it("ナビクリックで onNavigate(index) を呼ぶ", () => {
      const onNavigate = vi.fn();
      const state = createState({});
      addSlides(state, [{ src: "a.jpg" }, { src: "b.jpg" }]);
      const view = createView(
        { id: "T6", options: state.options },
        {
          onDismiss: vi.fn(),
          onPrev: vi.fn(),
          onNext: vi.fn(),
          onNavigate,
          onBackdropClick: vi.fn(),
        },
        { signal: new AbortController().signal },
      );
      view.syncSlides(state.groups.get("nogroup"), state);
      const navLinks = view.refs.navList?.querySelectorAll("button");
      navLinks?.[1].dispatchEvent(
        new MouseEvent("click", { bubbles: true, cancelable: true }),
      );
      expect(onNavigate).toHaveBeenCalledWith(1);
    });

    it("signal を abort するとイベントが解除される", () => {
      const onDismiss = vi.fn();
      const controller = new AbortController();
      const state = createState({});
      const view = createView(
        { id: "T7", options: state.options },
        {
          onDismiss,
          onPrev: vi.fn(),
          onNext: vi.fn(),
          onNavigate: vi.fn(),
          onBackdropClick: vi.fn(),
        },
        { signal: controller.signal },
      );
      controller.abort();
      view.refs.dismiss.dispatchEvent(
        new MouseEvent("click", { bubbles: true }),
      );
      expect(onDismiss).not.toHaveBeenCalled();
    });
  });

  describe("syncSlides / render", () => {
    it("各スライドの li は item.translateX/Y の位置へオフセットする(横並び配置)", () => {
      const { state, view } = buildHarness();
      addSlides(state, [{ src: "a.jpg" }, { src: "b.jpg" }, { src: "c.jpg" }]);
      const items = state.groups.get("nogroup");
      items[1].translateX = 1000;
      items[2].translateX = 2000;
      view.syncSlides(items, state);
      const refsArr = [...view.refs.slides.values()];
      expect(refsArr[0].li.style.transform).toBe("translate(0px,0px)");
      expect(refsArr[1].li.style.transform).toBe("translate(1000px,0px)");
      expect(refsArr[2].li.style.transform).toBe("translate(2000px,0px)");
    });

    it("未ロードのアイテムはローダーを表示する", () => {
      const { state, view } = buildHarness();
      addSlides(state, [{ src: "a.jpg", caption: "A" }]);
      const items = state.groups.get("nogroup");
      view.syncSlides(items, state);
      const [, slideRefs] = [...view.refs.slides.entries()][0];
      expect(slideRefs.loaderWrap).not.toBeNull();
      expect(slideRefs.imgWrap).toBeNull();
    });

    it("ロード済みのアイテムは画像を表示する", () => {
      const { state, view } = buildHarness();
      addSlides(state, [{ src: "a.jpg", width: 100, height: 100 }]);
      const items = state.groups.get("nogroup");
      sizeItems(items, 1000, 800, 60, 60);
      view.syncSlides(items, state);
      const [, slideRefs] = [...view.refs.slides.entries()][0];
      expect(slideRefs.imgWrap).not.toBeNull();
      expect(slideRefs.img?.src).toContain("a.jpg");
    });

    it("img の dragstart はデフォルト動作を抑止する", () => {
      const { state, view } = buildHarness();
      addSlides(state, [{ src: "a.jpg", width: 100, height: 100 }]);
      const items = state.groups.get("nogroup");
      sizeItems(items, 1000, 800, 60, 60);
      view.syncSlides(items, state);
      const img = [...view.refs.slides.values()][0].img as HTMLImageElement;
      const event = new Event("dragstart", { cancelable: true });
      img.dispatchEvent(event);
      expect(event.defaultPrevented).toBe(true);
    });

    it("current クラスが currentIndex に一致するスライドに付与される", () => {
      const { state, view } = buildHarness();
      addSlides(state, [{ src: "a.jpg" }, { src: "b.jpg" }]);
      const items = state.groups.get("nogroup");
      state.viewer.currentIndex = 1;
      view.syncSlides(items, state);
      const refsArr = [...view.refs.slides.values()];
      expect(refsArr[0].li.classList.contains("current")).toBe(false);
      expect(refsArr[1].li.classList.contains("current")).toBe(true);
    });

    it("count と caption を currentIndex に応じて更新する", () => {
      const { state, view } = buildHarness();
      addSlides(state, [
        { src: "a.jpg", caption: "A" },
        { src: "b.jpg", caption: "B" },
      ]);
      const items = state.groups.get("nogroup");
      view.syncSlides(items, state);
      expect(view.refs.count.textContent).toBe("1/2");
      expect(view.refs.caption.textContent).toBe("A");

      state.viewer.currentIndex = 1;
      view.render(state);
      expect(view.refs.count.textContent).toBe("2/2");
      expect(view.refs.caption.textContent).toBe("B");
    });

    it("処理済みになったアイテムはローダーから画像へ一方向に昇格する", () => {
      const { state, view } = buildHarness();
      addSlides(state, [{ src: "a.jpg", width: 100, height: 100 }]);
      const items = state.groups.get("nogroup");
      view.syncSlides(items, state);
      const item = items[0];
      expect(view.refs.slides.get(item)?.loaderWrap).not.toBeNull();

      sizeItems(items, 1000, 800, 60, 60);
      view.render(state);
      const slideRefs = view.refs.slides.get(item);
      expect(slideRefs?.loaderWrap).toBeNull();
      expect(slideRefs?.imgWrap).not.toBeNull();
    });

    it("ナビの thumb に含まれる引用符をエスケープする", () => {
      const { state, view } = buildHarness();
      addSlides(state, [{ src: "a.jpg", thumb: '"><b>x</b>.jpg' }]);
      const items = state.groups.get("nogroup");
      view.syncSlides(items, state);
      const link = view.refs.navList?.querySelector(
        "button",
      ) as HTMLButtonElement;
      expect(link.querySelector("b")).toBeNull();
      expect(link.style.backgroundImage).toContain('\\"');
    });

    it("thumb が無いアイテムでも背景画像を設定できる", () => {
      const { state, view } = buildHarness();
      addSlides(state, [{ src: "a.jpg" }]);
      const items = state.groups.get("nogroup");
      items[0].thumb = null;
      expect(() => view.syncSlides(items, state)).not.toThrow();
    });

    it("caption に HTML を含めても textContent として扱われる(XSS対策)", () => {
      const { state, view } = buildHarness();
      addSlides(state, [
        { src: "a.jpg", caption: '<img src=x onerror="window.__xss=1">' },
      ]);
      const items = state.groups.get("nogroup");
      view.syncSlides(items, state);
      expect(view.refs.caption.querySelector("img")).toBeNull();
      expect((window as unknown as { __xss?: number }).__xss).toBeUndefined();
    });

    it("showPrevArrow/showNextArrow に応じて矢印の aria-hidden を切り替える", () => {
      const { state, view } = buildHarness();
      addSlides(state, [{ src: "a.jpg" }, { src: "b.jpg" }, { src: "c.jpg" }]);
      const items = state.groups.get("nogroup");
      state.viewer.currentIndex = 0;
      setArrow(state);
      view.syncSlides(items, state);
      expect(view.refs.arrowLeft?.hasAttribute("aria-hidden")).toBe(true);
      expect(view.refs.arrowRight?.hasAttribute("aria-hidden")).toBe(false);

      state.viewer.currentIndex = 2;
      setArrow(state);
      view.render(state);
      expect(view.refs.arrowLeft?.hasAttribute("aria-hidden")).toBe(false);
      expect(view.refs.arrowRight?.hasAttribute("aria-hidden")).toBe(true);
    });

    it("非表示にする矢印にフォーカスが残っている場合はキャプションへ逃がす", () => {
      // aria-hidden="true" はフォーカスを持つ子孫があるとブラウザにブロックされ、
      // コンソール警告になる(WAI-ARIA)。隠す前に確実にフォーカスを移す
      const { state, view } = buildHarness();
      addSlides(state, [{ src: "a.jpg" }, { src: "b.jpg" }]);
      const items = state.groups.get("nogroup");
      state.viewer.currentIndex = 0;
      setArrow(state);
      view.syncSlides(items, state);

      const nextLink = view.refs.arrowRight?.querySelector(
        "button",
      ) as HTMLButtonElement;
      nextLink.focus();
      expect(document.activeElement).toBe(nextLink);

      state.viewer.currentIndex = 1;
      setArrow(state);
      view.render(state);

      expect(view.refs.arrowRight?.getAttribute("aria-hidden")).toBe("true");
      expect(document.activeElement).toBe(view.refs.caption);
    });

    it("hideUi に応じて arrows/nav の aria-hidden を切り替える", () => {
      const { state, view } = buildHarness();
      addSlides(state, [{ src: "a.jpg" }]);
      const items = state.groups.get("nogroup");
      view.syncSlides(items, state);
      expect(view.refs.arrows?.getAttribute("aria-hidden")).toBe("false");
      expect(view.refs.nav?.getAttribute("aria-hidden")).toBe("false");

      state.viewer.hideUi = true;
      view.render(state);
      expect(view.refs.arrows?.getAttribute("aria-hidden")).toBe("true");
      expect(view.refs.nav?.getAttribute("aria-hidden")).toBe("true");
    });

    it("arrows/nav が無いオプションでも render は安全に動作する", () => {
      const { state, view } = buildHarness({ arrows: false, nav: false });
      addSlides(state, [{ src: "a.jpg" }]);
      const items = state.groups.get("nogroup");
      expect(() => view.syncSlides(items, state)).not.toThrow();
      expect(() => view.updatePhotoTransform(state)).not.toThrow();
    });

    it("src/thumb/alt が無いアイテムでも構築できる", () => {
      const { state, view } = buildHarness();
      addSlides(state, [{ src: "a.jpg" }]);
      const items = state.groups.get("nogroup");
      items[0].src = null;
      items[0].alt = null;
      items[0].thumb = null;
      items[0].processed = true;
      expect(() => view.syncSlides(items, state)).not.toThrow();
      const slideRefs = [...view.refs.slides.values()][0];
      expect(slideRefs.img?.getAttribute("src")).toBe("");
    });
  });

  describe("updatePhotoTransform / updateListTransform", () => {
    it("current スライドの transform とクラスを更新する", () => {
      const { state, view } = buildHarness();
      addSlides(state, [{ src: "a.jpg", width: 100, height: 100 }]);
      const items = state.groups.get("nogroup");
      sizeItems(items, 1000, 800, 60, 60);
      view.syncSlides(items, state);
      state.viewer.photoPosX = 10;
      state.viewer.photoPosY = 20;
      state.viewer.scaleSize = 2;
      state.viewer.scale = true;
      view.updatePhotoTransform(state);
      const img = [...view.refs.slides.values()][0].img;
      expect(img?.style.transform).toBe("translate(10px,20px) scale(2)");
      expect(
        img?.classList.contains(state.options.classNames.smartPhotoImgOnMove),
      ).toBe(true);
    });

    it("current スライドが見つからない場合は何もしない", () => {
      const { state, view } = buildHarness();
      expect(() => view.updatePhotoTransform(state)).not.toThrow();
    });

    it("hideUi のときは arrows/nav を aria-hidden にする", () => {
      const { state, view } = buildHarness();
      state.viewer.hideUi = true;
      view.updatePhotoTransform(state);
      expect(view.refs.arrows?.getAttribute("aria-hidden")).toBe("true");
      expect(view.refs.nav?.getAttribute("aria-hidden")).toBe("true");
    });

    it("複数スライドの中から currentIndex に一致するものだけを更新する", () => {
      const { state, view } = buildHarness();
      addSlides(state, [
        { src: "a.jpg", width: 100, height: 100 },
        { src: "b.jpg", width: 100, height: 100 },
      ]);
      const items = state.groups.get("nogroup");
      sizeItems(items, 1000, 800, 60, 60);
      view.syncSlides(items, state);
      state.viewer.currentIndex = 1;
      state.viewer.photoPosX = 5;
      view.updatePhotoTransform(state);
      const refsArr = [...view.refs.slides.values()];
      expect(refsArr[0].img?.style.transform).toBe("");
      expect(refsArr[1].img?.style.transform).toContain("5px");
    });

    it("list の transform とクラスを更新する", () => {
      const { state, view } = buildHarness();
      state.viewer.translateX = 100;
      state.viewer.translateY = 0;
      state.viewer.onMove = true;
      view.updateListTransform(state);
      expect(view.refs.list.style.transform).toBe("translate(100px,0px)");
      expect(
        view.refs.list.classList.contains(
          state.options.classNames.smartPhotoListOnMove,
        ),
      ).toBe(true);
    });
  });

  describe("appear effect", () => {
    it("showAppearEffect でクローン画像を追加し removeAppearEffect で消す", () => {
      const { view } = buildHarness();
      view.showAppearEffect({
        width: 100,
        height: 80,
        top: 10,
        left: 20,
        once: true,
        img: "thumb.jpg",
        afterX: 0,
        afterY: 0,
        scale: 1,
      });
      expect(view.refs.imgClone).not.toBeNull();
      expect(view.refs.imgClone?.style.transform).toBe(
        "translate(20px,10px) scale(1)",
      );
      view.removeAppearEffect();
      expect(view.refs.imgClone).toBeNull();
    });
  });

  describe("destroy", () => {
    it("root を DOM から取り除く", () => {
      const { view } = buildHarness();
      expect(document.body.contains(view.root)).toBe(true);
      view.destroy();
      expect(document.body.contains(view.root)).toBe(false);
    });
  });
});
