import { fireEvent, waitFor } from "@testing-library/dom";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import SmartPhoto from "../src/index";

// Image モック(vitest.setup.js)が非同期で解決するため、実際にダイアログが開くまで待つ。
// 内部実装(groupItems() 等)には一切依存しない
const openViewer = async (container: HTMLElement) => {
  fireEvent.click(container.querySelector(".js-smartphoto") as HTMLElement);
  await waitFor(() => {
    expect(document.querySelector("dialog.smartphoto")).toHaveAttribute("open");
  });
};

describe("SmartPhoto Accessibility", () => {
  let container: HTMLElement;
  let smartPhoto: SmartPhoto | undefined;

  beforeEach(() => {
    container = document.createElement("div");
    container.innerHTML = `
      <div class="gallery">
        <a href="./assets/large-lion.jpg" class="js-smartphoto" data-caption="Lion" data-id="lion" data-group="test">
          <img src="./assets/lion.jpg" width="360" alt="Lion" />
        </a>
        <a href="./assets/large-camel.jpg" class="js-smartphoto" data-caption="Camel" data-id="camel" data-group="test">
          <img src="./assets/camel.jpg" width="360" alt="Camel" />
        </a>
        <a href="./assets/large-hippo.jpg" class="js-smartphoto" data-caption="Hippo" data-id="hippo" data-group="test">
          <img src="./assets/hippo.jpg" width="360" alt="Hippo" />
        </a>
      </div>
    `;
    document.body.appendChild(container);
  });

  afterEach(() => {
    smartPhoto?.destroy();
    smartPhoto = undefined;
    document.body.removeChild(container);
    document.querySelectorAll("dialog.smartphoto").forEach((dialog) => {
      dialog.remove();
    });
  });

  describe("ARIA属性", () => {
    beforeEach(async () => {
      smartPhoto = new SmartPhoto(".js-smartphoto");
      await openViewer(container);
    });

    it("should have proper dialog element", () => {
      const dialog = document.querySelector("dialog.smartphoto");
      expect(dialog).toBeInTheDocument();
    });

    // APG button パターン: ネイティブ <button> なら Enter/Space での作動・フォーカス
    // 可能性・button ロールがブラウザによって保証される
    it("should use native buttons for all interactive controls", () => {
      const closeButton = document.querySelector(".smartphoto-dismiss");
      const prevButton = document.querySelector(
        ".smartphoto-arrow-left button",
      );
      const nextButton = document.querySelector(
        ".smartphoto-arrow-right button",
      );

      expect(closeButton?.tagName).toBe("BUTTON");
      expect(prevButton).toBeInTheDocument();
      expect(prevButton).toHaveAttribute("type", "button");
      expect(nextButton).toBeInTheDocument();
      expect(nextButton).toHaveAttribute("type", "button");
      // role="button" を持つ <a>(Space で作動しない)が残っていないこと
      expect(
        document.querySelectorAll('dialog.smartphoto a[role="button"]').length,
      ).toBe(0);
    });

    it("should have aria-hidden only for navigation buttons that have no image to go to", () => {
      const prevButton = document.querySelector(".smartphoto-arrow-left");
      const nextButton = document.querySelector(".smartphoto-arrow-right");

      // 最初の画像 (index=0, 全3件) では前の画像が存在しないため前ボタンのみ非表示
      expect(prevButton).toHaveAttribute("aria-hidden", "true");
      // 次の画像は存在するため、次ボタンは aria-hidden を持たない(操作可能)
      expect(nextButton).not.toHaveAttribute("aria-hidden");
    });

    it("should expose the carousel structure to assistive technology", () => {
      const list = document.querySelector(".smartphoto-list");
      expect(list).toHaveAttribute("aria-roledescription", "carousel");

      const slides = document.querySelectorAll(".smartphoto-list > li");
      expect(slides.length).toBe(3);
      slides.forEach((slide) => {
        expect(slide).toHaveAttribute("role", "group");
        expect(slide).toHaveAttribute("aria-roledescription", "slide");
      });
    });

    // APG carousel パターン: コンテナは region/group ロールと、"carousel" という語を
    // 含まないアクセシブルネームを持つ
    it("should give the carousel container a region role and an accessible name", () => {
      const list = document.querySelector(".smartphoto-list");
      expect(list).toHaveAttribute("role", "region");
      const label = list?.getAttribute("aria-label");
      expect(label).toBeTruthy();
      expect(label?.toLowerCase()).not.toContain("carousel");
    });

    // APG carousel パターン: 各スライドは「N of M」形式(または名前)のラベルを持つ。
    // ラベルに "slide" という語は含めない
    it("should label each slide with its position (N of M)", () => {
      const slides = document.querySelectorAll(".smartphoto-list > li");
      slides.forEach((slide, index) => {
        expect(slide).toHaveAttribute("aria-label", `${index + 1} of 3`);
      });
    });

    // APG carousel パターン: 表示中でないスライドは支援技術から隠し、
    // スライド切り替えがライブリージョン経由で通知されるようにする
    it("should hide non-current slides from assistive technology", async () => {
      const slides = document.querySelectorAll(".smartphoto-list > li");
      expect(slides[0]).not.toHaveAttribute("aria-hidden", "true");
      expect(slides[1]).toHaveAttribute("aria-hidden", "true");
      expect(slides[2]).toHaveAttribute("aria-hidden", "true");

      fireEvent.click(
        document.querySelector(".smartphoto-arrow-right button") as HTMLElement,
      );
      await waitFor(() => {
        expect(slides[1]).not.toHaveAttribute("aria-hidden", "true");
      });
      expect(slides[0]).toHaveAttribute("aria-hidden", "true");
    });

    it("should mark the current thumbnail with aria-current", () => {
      const thumbnails = document.querySelectorAll(".smartphoto-nav button");
      expect(thumbnails[0]).toHaveAttribute("aria-current", "true");
      expect(thumbnails[1]).not.toHaveAttribute("aria-current");
      expect(thumbnails[2]).not.toHaveAttribute("aria-current");
    });

    it("should never emit a duplicated aria-hidden attribute on the arrows/nav wrapper", () => {
      const arrows = document.querySelector(
        ".smartphoto-arrows",
      ) as HTMLElement;
      const nav = document.querySelector(".smartphoto-nav") as HTMLElement;
      // outerHTML の子要素側にも aria-hidden (各矢印個別の表示制御) が含まれるため、
      // ラッパー自身の開始タグだけを見て重複がないか検証する
      const arrowsOpenTag = arrows.outerHTML.match(/^<ul[^>]*>/)?.[0] ?? "";
      const navOpenTag = nav.outerHTML.match(/^<nav[^>]*>/)?.[0] ?? "";
      expect((arrowsOpenTag.match(/aria-hidden=/g) || []).length).toBe(1);
      expect(arrows).toHaveAttribute("aria-hidden", "false");
      expect((navOpenTag.match(/aria-hidden=/g) || []).length).toBe(1);
      expect(nav).toHaveAttribute("aria-hidden", "false");
    });
  });

  describe("スクリーンリーダー対応", () => {
    beforeEach(async () => {
      smartPhoto = new SmartPhoto(".js-smartphoto");
      await openViewer(container);
    });

    it("should have screen reader only text for all interactive elements", () => {
      const srElements = document.querySelectorAll(".smartphoto-sr-only");
      expect(srElements.length).toBeGreaterThan(0);

      srElements.forEach((element) => {
        expect(element).toBeInTheDocument();
        expect(element.textContent?.trim()).not.toBe("");
      });
    });

    // APG carousel パターン: スライドを含む要素に aria-live="polite"(自動回転なし)と
    // aria-atomic="false" を設定し、スライドの切り替えを通知する
    it("should announce slide changes via a live region on the slides container", () => {
      const list = document.querySelector(".smartphoto-list");
      expect(list).toHaveAttribute("aria-live", "polite");
      expect(list).toHaveAttribute("aria-atomic", "false");
    });

    it("should have descriptive text for navigation", () => {
      const prevButton = document.querySelector(
        ".smartphoto-arrow-left button",
      );
      const nextButton = document.querySelector(
        ".smartphoto-arrow-right button",
      );

      const prevText = prevButton?.querySelector(
        ".smartphoto-sr-only",
      )?.textContent;
      const nextText = nextButton?.querySelector(
        ".smartphoto-sr-only",
      )?.textContent;

      expect(prevText).toContain("previous");
      expect(nextText).toContain("next");
    });

    it("should have descriptive text for thumbnails", () => {
      const thumbnails = document.querySelectorAll(".smartphoto-nav button");
      thumbnails.forEach((thumbnail, index) => {
        const srText = thumbnail.querySelector(".smartphoto-sr-only");
        expect(srText?.textContent).toContain("go to");
        expect(srText?.textContent).toContain(
          ["Lion", "Camel", "Hippo"][index],
        );
      });
    });
  });

  describe("キーボードナビゲーション", () => {
    beforeEach(async () => {
      smartPhoto = new SmartPhoto(".js-smartphoto");
      await openViewer(container);
    });

    it("should not respond to arrow keys when dialog is closed", () => {
      const closeButton = document.querySelector(
        ".smartphoto-dismiss",
      ) as HTMLElement;
      fireEvent.click(closeButton);

      // ダイアログが閉じられた状態で矢印キーを押しても何も起こらない
      fireEvent.keyDown(document, { key: "ArrowRight", keyCode: 39 });

      // ダイアログが閉じられていることを確認
      const dialog = document.querySelector("dialog.smartphoto");
      expect(dialog).toBeInTheDocument();
    });

    // APG button パターン: Enter/Space 両方での作動が必要。ネイティブ <button> の
    // キーボード作動はブラウザが保証する(jsdom はキー→click の既定動作を実装しない)
    // ため、ここではネイティブ button であることと click での作動を保証する
    it("should navigate slides via native next/prev buttons", async () => {
      const caption = document.querySelector(".smartphoto-caption");
      const nextButton = document.querySelector(
        ".smartphoto-arrow-right button",
      ) as HTMLElement;
      expect(nextButton.tagName).toBe("BUTTON");

      expect(caption).toHaveTextContent("Lion");
      fireEvent.click(nextButton);
      await waitFor(() => {
        expect(caption).toHaveTextContent("Camel");
      });

      const prevButton = document.querySelector(
        ".smartphoto-arrow-left button",
      ) as HTMLElement;
      expect(prevButton.tagName).toBe("BUTTON");
      fireEvent.click(prevButton);
      await waitFor(() => {
        expect(caption).toHaveTextContent("Lion");
      });
    });

    it("should navigate slides via native thumbnail buttons", async () => {
      const caption = document.querySelector(".smartphoto-caption");
      const thumbnails = document.querySelectorAll(".smartphoto-nav button");
      expect(thumbnails.length).toBe(3);

      fireEvent.click(thumbnails[2] as HTMLElement);
      await waitFor(() => {
        expect(caption).toHaveTextContent("Hippo");
      });
    });

    it("should handle Tab navigation properly", () => {
      const dialog = document.querySelector("dialog.smartphoto") as HTMLElement;
      const focusableElements = dialog.querySelectorAll(
        'button, a, [tabindex]:not([tabindex="-1"])',
      );

      expect(focusableElements.length).toBeGreaterThan(0);

      const firstElement = focusableElements[0] as HTMLElement;
      firstElement.focus();
      expect(document.activeElement).toBe(firstElement);

      fireEvent.keyDown(firstElement, { key: "Tab" });
    });
  });

  describe("alt属性の処理", () => {
    it("should render the alt attribute on the current image", async () => {
      smartPhoto = new SmartPhoto(".js-smartphoto");
      await openViewer(container);
      const img = document.querySelector(".current .smartphoto-img");
      expect(img).toHaveAttribute("alt", "Lion");
    });

    it("should fallback to caption when alt is empty", async () => {
      container.innerHTML = `
        <div class="gallery">
          <a href="./assets/large-lion.jpg" class="js-smartphoto" data-caption="Lion" data-id="lion" data-group="test">
            <img src="./assets/lion.jpg" width="360" alt="" />
          </a>
        </div>
      `;

      smartPhoto = new SmartPhoto(".js-smartphoto");
      await openViewer(container);
      const img = document.querySelector(".current .smartphoto-img");
      expect(img).toHaveAttribute("alt", "Lion");
    });

    it("should fallback to src when alt and caption are empty", async () => {
      container.innerHTML = `
        <div class="gallery">
          <a href="./assets/large-lion.jpg" class="js-smartphoto" data-id="lion" data-group="test">
            <img src="./assets/lion.jpg" width="360" alt="" />
          </a>
        </div>
      `;

      smartPhoto = new SmartPhoto(".js-smartphoto");
      await openViewer(container);
      const img = document.querySelector(".current .smartphoto-img");
      expect(img?.getAttribute("alt")).toContain("large-lion.jpg");
    });
  });

  describe("フォーカス管理", () => {
    beforeEach(() => {
      smartPhoto = new SmartPhoto(".js-smartphoto");
    });

    it("ダイアログを開くとキャプション見出しにフォーカスが移動する", async () => {
      await openViewer(container);
      const caption = document.querySelector(".smartphoto-caption");
      expect(document.activeElement).toBe(caption);
    });

    it("閉じるボタンでダイアログを閉じると、開いたトリガー要素にフォーカスが戻る", async () => {
      const trigger = container.querySelector(".js-smartphoto") as HTMLElement;
      trigger.focus();
      await openViewer(container);
      const closeButton = document.querySelector(
        ".smartphoto-dismiss",
      ) as HTMLElement;
      fireEvent.click(closeButton);
      expect(document.activeElement).toBe(trigger);
    });
  });
});
